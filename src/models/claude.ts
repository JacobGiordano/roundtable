/**
 * Atlas — claude.ts
 *
 * ClaudeModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the Anthropic Messages API with server-sent events (SSE) for streaming.
 * No @anthropic-ai/sdk dependency — raw fetch to avoid adding external packages.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.anthropic.com
 */

import type {
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  StreamChunk,
  TokenUsage,
  ModelError,
  ModelErrorCode,
} from '@/types';
import { getCredentials } from '@/auth';
import { MAX_TOKENS_CLAUDE } from './constants';

// ─── Provider config ──────────────────────────────────────────────────────────

export const CLAUDE_CONFIG: ModelProviderConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  credentialKey: 'anthropic',
};

// ─── Anthropic API constants ──────────────────────────────────────────────────

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
/**
 * Default model string sent to the Anthropic API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Claude.
 */
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';

// ─── SSE event types emitted by the Anthropic streaming API ──────────────────

interface AnthropicContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string };
}

interface AnthropicMessageDelta {
  type: 'message_delta';
  delta: { stop_reason: string };
  usage: { output_tokens: number };
}

interface AnthropicMessageStart {
  type: 'message_start';
  message: {
    usage: { input_tokens: number; output_tokens: number };
  };
}

type AnthropicStreamEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockDelta
  | AnthropicMessageDelta
  | { type: string };

// ─── Error mapping ────────────────────────────────────────────────────────────

function mapHttpStatusToErrorCode(status: number): ModelErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 429) return 'rate_limit';
  if (status === 400) return 'context_length_exceeded';
  return 'unknown';
}

function buildModelError(code: ModelErrorCode, message: string): ModelError {
  return { code, message };
}

// ─── ClaudeModelProvider ──────────────────────────────────────────────────────

export class ClaudeModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = CLAUDE_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials('anthropic');
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? ANTHROPIC_DEFAULT_MODEL;

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'Anthropic API key is not set. Add it in Settings.');
      const errChunk: StreamChunk = {
        modelId: this.config.modelId,
        content: '',
        isDone: true,
        error,
      };
      onChunk(errChunk);
      return {};
    }

    // Map Roundtable Message[] to Anthropic API format
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    const requestBody: Record<string, unknown> = {
      model: modelString,
      max_tokens: MAX_TOKENS_CLAUDE,
      stream: true,
      messages: anthropicMessages,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
        },
        body: JSON.stringify(requestBody),
      });
    } catch (networkErr) {
      const error = buildModelError(
        'network_error',
        networkErr instanceof Error ? networkErr.message : 'Network request failed'
      );
      onChunk({ modelId: this.config.modelId, content: '', isDone: true, error });
      return {};
    }

    if (!response.ok) {
      const code = mapHttpStatusToErrorCode(response.status);
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json() as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        // ignore JSON parse failure — use status code detail
      }
      const error = buildModelError(code, detail);
      onChunk({ modelId: this.config.modelId, content: '', isDone: true, error });
      return {};
    }

    // ─── Parse SSE stream ──────────────────────────────────────────────────────

    const reader = response.body?.getReader();
    if (!reader) {
      const error = buildModelError('network_error', 'Response body is not readable');
      onChunk({ modelId: this.config.modelId, content: '', isDone: true, error });
      return {};
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          let event: AnthropicStreamEvent;
          try {
            event = JSON.parse(data) as AnthropicStreamEvent;
          } catch {
            continue;
          }

          if (event.type === 'message_start') {
            const start = event as AnthropicMessageStart;
            inputTokens = start.message.usage.input_tokens;
            outputTokens = start.message.usage.output_tokens;
          } else if (event.type === 'content_block_delta') {
            const delta = event as AnthropicContentBlockDelta;
            if (delta.delta.type === 'text_delta') {
              onChunk({
                modelId: this.config.modelId,
                content: delta.delta.text,
                isDone: false,
              });
            }
          } else if (event.type === 'message_delta') {
            const msgDelta = event as AnthropicMessageDelta;
            outputTokens += msgDelta.usage.output_tokens;
          }
        }
      }
    } catch (streamErr) {
      const error = buildModelError(
        'network_error',
        streamErr instanceof Error ? streamErr.message : 'Stream read failed'
      );
      onChunk({ modelId: this.config.modelId, content: '', isDone: true, error });
      return {};
    } finally {
      reader.releaseLock();
    }

    // Emit final done chunk with token usage
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    onChunk({
      modelId: this.config.modelId,
      content: '',
      isDone: true,
      tokenUsage,
    });

    return { tokenUsage };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const claudeProvider = new ClaudeModelProvider();
