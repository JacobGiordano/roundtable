/**
 * Atlas — gemini.ts
 *
 * GeminiModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the Google Generative Language API (v1beta) with server-sent events
 * (SSE) for streaming. No @google/generative-ai SDK dependency — raw fetch.
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
import { MAX_TOKENS_GEMINI } from './constants';

// ─── Provider config ──────────────────────────────────────────────────────────

export const GEMINI_CONFIG: ModelProviderConfig = {
  modelId: 'gemini',
  name: 'Gemini',
  color: 'emerald',
  credentialKey: 'google',
};

// ─── Google Generative Language API constants ─────────────────────────────────

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com';
/**
 * Default model string sent to the Google API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Gemini.
 */
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Build the Gemini streaming URL for a given model string.
 * The model is embedded in the URL path — selectedVersionId changes the path.
 */
function buildGeminiUrl(modelString: string): string {
  return `${GEMINI_API_BASE}/v1beta/models/${modelString}:streamGenerateContent`;
}

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
      maxOutputTokens: MAX_TOKENS_GEMINI,
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
    onChunk: StreamHandler,
    selectedVersionId?: string
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(GEMINI_CONFIG.credentialKey);
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? GEMINI_DEFAULT_MODEL;

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
    // The model string is embedded in the path — build the URL from the resolved version.
    const url = `${buildGeminiUrl(modelString)}?key=${apiKey}&alt=sse`;

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
