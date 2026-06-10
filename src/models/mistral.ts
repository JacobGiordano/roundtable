/**
 * Atlas — mistral.ts
 *
 * MistralModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the Mistral AI API (OpenAI-compatible Chat Completions endpoint) with
 * server-sent events (SSE) for streaming. No SDK dependency — raw fetch.
 *
 * Mistral's API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern. Implementation mirrors grok.ts;
 * differences are the API URL, model string, and credential key.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.mistral.ai
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

export const MISTRAL_CONFIG: ModelProviderConfig = {
  modelId: 'mistral',
  name: 'Mistral',
  color: 'orange',
  credentialKey: 'mistral',
};

// ─── Mistral API constants ────────────────────────────────────────────────────

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
/**
 * Model string sent to the Mistral AI API.
 * mistral-large-latest is the current flagship model.
 * Can be made configurable in a future issue.
 */
const MISTRAL_MODEL = 'mistral-large-latest';
const MAX_TOKENS = 8096;

// ─── SSE event types — Mistral uses the same format as OpenAI ─────────────────

interface MistralChoiceDelta {
  content?: string | null;
  role?: string;
}

interface MistralStreamChoice {
  index: number;
  delta: MistralChoiceDelta;
  finish_reason: string | null;
}

interface MistralStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: MistralStreamChoice[];
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

// ─── MistralModelProvider ─────────────────────────────────────────────────────

export class MistralModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = MISTRAL_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(MISTRAL_CONFIG.credentialKey);

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'Mistral API key is not set. Add it in Settings.');
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
    // Mistral's API accepts the same format as OpenAI's Chat Completions.
    // Prepend the system prompt as a system message if provided.
    const mistralMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      mistralMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      mistralMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: MISTRAL_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      // Request token usage in the final stream chunk (OpenAI-compatible extension)
      stream_options: { include_usage: true },
      messages: mistralMessages,
    };

    let response: Response;
    try {
      response = await fetch(MISTRAL_API_URL, {
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

          let event: MistralStreamChunk;
          try {
            event = JSON.parse(data) as MistralStreamChunk;
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

export const mistralProvider = new MistralModelProvider();
