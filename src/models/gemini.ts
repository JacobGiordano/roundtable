/**
 * Atlas — gemini.ts
 *
 * GeminiModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the Google Generative Language API (v1beta) with server-sent events
 * (SSE) for streaming. No @google/generative-ai SDK dependency — raw fetch.
 *
 * ACTIVATION STATUS: Implementation complete. NOT yet registered in the model
 * registry (registry.ts) or exported from index.ts.
 *
 * Blocked on Arch types PR — requires these additions to /src/types/index.ts:
 *   - 'gemini' added to ModelId union
 *   - 'google' added to CredentialKey union
 *
 * Also blocked on Gate PR — requires in /src/auth/credentials.ts:
 *   - 'gemini' → 'google' added to MODEL_CREDENTIAL_MAP
 *   - 'google' entry added to CREDENTIAL_LABELS
 *
 * To activate after types land:
 *   1. Remove the `as unknown as ModelId` cast on GEMINI_MODEL_ID (line ~45)
 *   2. Remove the `as unknown as CredentialKey` cast on credentialKey (line ~56)
 *   3. Import geminiProvider in registry.ts and add to PROVIDERS
 *   4. Add the Gemini entry to MODEL_REGISTRY in registry.ts
 *   5. Export GeminiModelProvider and geminiProvider from index.ts
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to https://generativelanguage.googleapis.com
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
// ModelId and CredentialKey in /src/types/index.ts to include 'gemini' and 'google'.
// They are intentional and documented — NOT a pattern to copy elsewhere.

// TODO(arch): replace with `'gemini' satisfies ModelId` once types PR lands
const GEMINI_MODEL_ID = 'gemini' as unknown as import('@/types').ModelId;
// TODO(arch): replace with `'google' satisfies CredentialKey` once types PR lands
const GEMINI_CREDENTIAL_KEY = 'google' as unknown as import('@/types').CredentialKey;

// ─── Provider config ──────────────────────────────────────────────────────────

export const GEMINI_CONFIG: ModelProviderConfig = {
  modelId: GEMINI_MODEL_ID,
  name: 'Gemini',
  color: 'emerald',
  credentialKey: GEMINI_CREDENTIAL_KEY,
};

// ─── Google Generative Language API constants ─────────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
/**
 * Default model string sent to the Google API.
 * gemini-1.5-flash balances capability, speed, and cost for a chat interface.
 * Can be made configurable in a future issue.
 */
const GEMINI_API_MODEL = 'gemini-1.5-flash';
const GEMINI_API_URL = `${GEMINI_API_BASE}/v1beta/models/${GEMINI_API_MODEL}:streamGenerateContent`;

// ─── Google API response types ────────────────────────────────────────────────

interface GeminiContentPart {
  text?: string;
}

interface GeminiContent {
  parts: GeminiContentPart[];
  role: string;
}

interface GeminiCandidate {
  content: GeminiContent;
  finishReason?: string;
  index: number;
}

interface GeminiUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

interface GeminiStreamChunk {
  candidates?: GeminiCandidate[];
  usageMetadata?: GeminiUsageMetadata;
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

// ─── Message format conversion ────────────────────────────────────────────────

/**
 * Map Roundtable Message[] to the Google Generative Language API format.
 * The Google API uses 'user' and 'model' roles (not 'assistant').
 * System prompts are prepended as a user turn followed by a model acknowledgment,
 * since the v1beta API does not have a dedicated system_instruction field at the
 * top level of generateContent (it does in some SDK versions — raw API uses contents).
 *
 * Note: The Google API does have a `system_instruction` field in the request body
 * at the root level for the generateContent endpoint. We use that approach here
 * for clean separation of system context from the conversation history.
 */
function buildGeminiRequest(
  messages: Message[],
  systemPrompt: string | undefined
): Record<string, unknown> {
  const contents = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const request: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: 8192,
    },
  };

  if (systemPrompt) {
    request.system_instruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  return request;
}

// ─── GeminiModelProvider ──────────────────────────────────────────────────────

export class GeminiModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = GEMINI_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(GEMINI_CREDENTIAL_KEY);

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'Google API key is not set. Add it in Settings.');
      const errChunk: StreamChunk = {
        modelId: this.config.modelId,
        content: '',
        isDone: true,
        error,
      };
      onChunk(errChunk);
      return {};
    }

    const requestBody = buildGeminiRequest(messages, systemPrompt);

    // Google API key is passed as a query parameter (not a header) for the REST API.
    // The key is appended to the URL — never logged, never stored.
    const url = `${GEMINI_API_URL}?key=${apiKey}&alt=sse`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    //
    // The Google streaming API returns SSE with `data:` lines containing JSON
    // GeminiStreamChunk objects. The final chunk includes usageMetadata.

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
          if (!data || data === '[DONE]') continue;

          let event: GeminiStreamChunk;
          try {
            event = JSON.parse(data) as GeminiStreamChunk;
          } catch {
            continue;
          }

          // Capture usage metadata (present on the final chunk)
          if (event.usageMetadata) {
            inputTokens = event.usageMetadata.promptTokenCount;
            outputTokens = event.usageMetadata.candidatesTokenCount;
          }

          // Emit content deltas from candidates
          if (event.candidates) {
            for (const candidate of event.candidates) {
              for (const part of candidate.content.parts) {
                if (part.text) {
                  onChunk({
                    modelId: this.config.modelId,
                    content: part.text,
                    isDone: false,
                  });
                }
              }
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

export const geminiProvider = new GeminiModelProvider();
