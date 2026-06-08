/**
 * Atlas — gpt.ts
 *
 * GPT55ModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the OpenAI Chat Completions API with server-sent events (SSE) for streaming.
 * No openai SDK dependency — raw fetch to avoid adding external packages.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.openai.com
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

export const GPT55_CONFIG: ModelProviderConfig = {
  modelId: 'gpt-5.5',
  name: 'GPT-5.5',
  color: 'emerald',
  credentialKey: 'openai',
};

// ─── OpenAI API constants ─────────────────────────────────────────────────────

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
/**
 * Model string sent to the OpenAI API.
 * "gpt-5.5" maps to the gpt-5.5 preview model. Can be made configurable
 * in a future issue if OpenAI changes the model identifier.
 */
const OPENAI_MODEL = 'gpt-5.5';
const MAX_TOKENS = 8096;

// ─── SSE event types emitted by the OpenAI streaming API ─────────────────────

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
  /** Present in some chunks when stream_options.include_usage is true */
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

// ─── GPT55ModelProvider ───────────────────────────────────────────────────────

export class GPT55ModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = GPT55_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials('openai');

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'OpenAI API key is not set. Add it in Settings.');
      const errChunk: StreamChunk = {
        modelId: this.config.modelId,
        content: '',
        isDone: true,
        error,
      };
      onChunk(errChunk);
      return {};
    }

    // Map Roundtable Message[] to OpenAI Chat API format.
    // Prepend the system prompt as a system message if provided.
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      // Request token usage in the final stream chunk
      stream_options: { include_usage: true },
      messages: openaiMessages,
    };

    let response: Response;
    try {
      response = await fetch(OPENAI_API_URL, {
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

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gpt55Provider = new GPT55ModelProvider();
