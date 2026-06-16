/**
 * Atlas — BaseOpenAIProvider.ts
 *
 * Abstract base class for OpenAI-compatible built-in providers (GPT, Grok,
 * DeepSeek, Mistral). All four share identical streaming logic, SSE chunk
 * parsing, error classification, and token counting. The only per-provider
 * differences are the API endpoint URL, the credential key name, the default
 * model string, the per-provider max_tokens limit, and the human-readable
 * auth error message.
 *
 * Subclasses must implement four abstract getters:
 *   - apiUrl        — the full /v1/chat/completions endpoint URL
 *   - defaultModel  — the default API model string (used when no version is selected)
 *   - maxTokens     — output token ceiling for this provider
 *   - authErrorMessage — human-readable error surfaced when the API key is missing
 *
 * Subclasses declare their ModelProviderConfig via the `config` property
 * (required by the ModelProvider interface).
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the URL returned by this.apiUrl
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

// ─── SSE event types for the OpenAI Chat Completions streaming format ─────────
// All four built-in OpenAI-compatible providers share this exact wire format.

interface OpenAIChoiceDelta {
  content?: string | null;
  role?: string;
}

interface OpenAIStreamChoice {
  index: number;
  delta: OpenAIChoiceDelta;
  finish_reason: string | null;
}

interface OpenAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAIStreamChoice[];
  /** Present in the final chunk when stream_options.include_usage is true */
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── Error helpers ────────────────────────────────────────────────────────────

function mapHttpStatusToErrorCode(status: number): ModelErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 429) return 'rate_limit';
  if (status === 400) return 'context_length_exceeded';
  return 'unknown';
}

function buildModelError(code: ModelErrorCode, message: string): ModelError {
  return { code, message };
}

// ─── BaseOpenAIProvider ───────────────────────────────────────────────────────

export abstract class BaseOpenAIProvider implements ModelProvider {
  /** ModelProviderConfig — must be declared by subclass as a readonly property. */
  abstract readonly config: ModelProviderConfig;

  /** Full URL of the OpenAI-compatible /v1/chat/completions endpoint. */
  protected abstract get apiUrl(): string;

  /** Default API model string used when no selectedVersionId is provided. */
  protected abstract get defaultModel(): string;

  /** Output token ceiling for this provider (sent as max_tokens in the request body). */
  protected abstract get maxTokens(): number;

  /**
   * Human-readable message shown to the user when the API key is not set.
   * Example: "OpenAI API key is not set. Add it in Settings."
   */
  protected abstract get authErrorMessage(): string;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(this.config.credentialKey);
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? this.defaultModel;

    if (!apiKey) {
      const error = buildModelError('auth_failure', this.authErrorMessage);
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
    // Prepend the system prompt as a system message if provided.
    const apiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      apiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: modelString,
      max_tokens: this.maxTokens,
      stream: true,
      // Request token usage in the final stream chunk (OpenAI-compatible extension)
      stream_options: { include_usage: true },
      messages: apiMessages,
    };

    let response: Response;
    try {
      response = await fetch(this.apiUrl, {
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

          let event: OpenAIStreamChunk;
          try {
            event = JSON.parse(data) as OpenAIStreamChunk;
          } catch {
            continue;
          }

          // Capture token usage from the final usage chunk (stream_options.include_usage)
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
