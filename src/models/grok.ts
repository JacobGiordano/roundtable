/**
 * Atlas — grok.ts
 *
 * GrokModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the xAI API (OpenAI-compatible Chat Completions endpoint) with
 * server-sent events (SSE) for streaming. No SDK dependency — raw fetch.
 *
 * The xAI API is OpenAI-compatible: same request format, same SSE chunk structure,
 * same `Authorization: Bearer <key>` header pattern. The implementation mirrors
 * gpt.ts closely; differences are the API URL, model string, and credential key.
 *
 * ACTIVATION STATUS: Implementation complete. NOT yet registered in the model
 * registry (registry.ts) or exported from index.ts.
 *
 * Blocked on Arch types PR — requires these additions to /src/types/index.ts:
 *   - 'grok' added to ModelId union
 *   - 'xai' added to CredentialKey union
 *
 * Also blocked on Gate PR — requires in /src/auth/credentials.ts:
 *   - 'grok' → 'xai' added to MODEL_CREDENTIAL_MAP
 *   - 'xai' entry added to CREDENTIAL_LABELS
 *
 * To activate after types land:
 *   1. Remove the `as unknown as ModelId` cast on GROK_MODEL_ID (line ~46)
 *   2. Remove the `as unknown as CredentialKey` cast on credentialKey (line ~57)
 *   3. Import grokProvider in registry.ts and add to PROVIDERS
 *   4. Add the Grok entry to MODEL_REGISTRY in registry.ts
 *   5. Export GrokModelProvider and grokProvider from index.ts
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://api.x.ai
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

// ─── Type forward-compatibility casts ─────────────────────────────────────────
//
// The casts below are load-bearing stubs that will be removed once Arch extends
// ModelId and CredentialKey in /src/types/index.ts to include 'grok' and 'xai'.
// They are intentional and documented — NOT a pattern to copy elsewhere.

// TODO(arch): replace with `'grok' satisfies ModelId` once types PR lands
const GROK_MODEL_ID = 'grok' as unknown as import('@/types').ModelId;
// TODO(arch): replace with `'xai' satisfies CredentialKey` once types PR lands
const GROK_CREDENTIAL_KEY = 'xai' as unknown as import('@/types').CredentialKey;

// ─── Provider config ──────────────────────────────────────────────────────────

export const GROK_CONFIG: ModelProviderConfig = {
  modelId: GROK_MODEL_ID,
  name: 'Grok',
  color: 'sky',
  credentialKey: GROK_CREDENTIAL_KEY,
};

// ─── xAI API constants ────────────────────────────────────────────────────────

const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
/**
 * Model string sent to the xAI API.
 * grok-beta is the current flagship model available via the API.
 * Can be made configurable in a future issue.
 */
const XAI_MODEL = 'grok-beta';
const MAX_TOKENS = 8096;

// ─── SSE event types — xAI uses the same format as OpenAI ─────────────────────

interface XAIChoiceDelta {
  content?: string | null;
  role?: string;
}

interface XAIStreamChoice {
  index: number;
  delta: XAIChoiceDelta;
  finish_reason: string | null;
}

interface XAIStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: XAIStreamChoice[];
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

// ─── GrokModelProvider ────────────────────────────────────────────────────────

export class GrokModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = GROK_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(GROK_CREDENTIAL_KEY);

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'xAI API key is not set. Add it in Settings.');
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
    // xAI's API accepts the same format as OpenAI's Chat Completions.
    // Prepend the system prompt as a system message if provided.
    const xaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      xaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      xaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: XAI_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      // Request token usage in the final stream chunk (OpenAI-compatible extension)
      stream_options: { include_usage: true },
      messages: xaiMessages,
    };

    let response: Response;
    try {
      response = await fetch(XAI_API_URL, {
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

          let event: XAIStreamChunk;
          try {
            event = JSON.parse(data) as XAIStreamChunk;
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

export const grokProvider = new GrokModelProvider();
