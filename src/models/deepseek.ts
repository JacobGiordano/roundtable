/**
 * Atlas — deepseek.ts
 *
 * DeepSeekModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the DeepSeek API (OpenAI-compatible Chat Completions endpoint) with
 * server-sent events (SSE) for streaming. No SDK dependency — raw fetch.
 *
 * DeepSeek's API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern. Implementation mirrors grok.ts;
 * differences are the API URL, model string, and credential key.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.deepseek.com
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

// ─── Provider config ──────────────────────────────────────────────────────────

export const DEEPSEEK_CONFIG: ModelProviderConfig = {
  modelId: 'deepseek',
  name: 'DeepSeek',
  color: 'sky',
  credentialKey: 'deepseek',
};

// ─── DeepSeek API constants ───────────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
/**
 * Default model string sent to the DeepSeek API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for DeepSeek.
 */
const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat';
const MAX_TOKENS = 8096;

// ─── SSE event types — DeepSeek uses the same format as OpenAI ────────────────

interface DeepSeekChoiceDelta {
  content?: string | null;
  role?: string;
}

interface DeepSeekStreamChoice {
  index: number;
  delta: DeepSeekChoiceDelta;
  finish_reason: string | null;
}

interface DeepSeekStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: DeepSeekStreamChoice[];
  /** Present in the final chunk when stream_options.include_usage is true */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

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

// ─── DeepSeekModelProvider ────────────────────────────────────────────────────

export class DeepSeekModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = DEEPSEEK_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(DEEPSEEK_CONFIG.credentialKey);
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? DEEPSEEK_DEFAULT_MODEL;

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'DeepSeek API key is not set. Add it in Settings.');
      const errChunk: StreamChunk = {
        modelId: this.config.modelId,
        content: '',
        isDone: true,
        error,
      };
      onChunk(errChunk);
      return {};
    }

    // Map Roundtable Message[] to OpenAI-compatible Chat API format.
    // DeepSeek's API accepts the same format as OpenAI's Chat Completions.
    // Prepend the system prompt as a system message if provided.
    const deepseekMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      deepseekMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      deepseekMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: modelString,
      max_tokens: MAX_TOKENS,
      stream: true,
      // Request token usage in the final stream chunk (OpenAI-compatible extension)
      stream_options: { include_usage: true },
      messages: deepseekMessages,
    };

    let response: Response;
    try {
      response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
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

          let event: DeepSeekStreamChunk;
          try {
            event = JSON.parse(data) as DeepSeekStreamChunk;
          } catch {
            continue;
          }

          // Capture token usage from the final usage chunk
          if (event.usage) {
            inputTokens = event.usage.prompt_tokens;
            outputTokens = event.usage.completion_tokens;
          }

          // Emit content deltas
          for (const choice of event.choices) {
            const text = choice.delta.content;
            if (text) {
              onChunk({
                modelId: this.config.modelId,
                content: text,
                isDone: false,
              });
            }
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

export const deepseekProvider = new DeepSeekModelProvider();
