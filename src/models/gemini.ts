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
 *   - The API key is only transmitted to the resolved Google endpoint (direct or via proxy)
 */

import type {
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  TokenUsage,
} from '@/types';
import { getCredentials } from '@/auth';
// permitted cross-agent import — see ProxyConfig JSDoc in @/types
import { getProxyConfig } from './proxyConfig';
import { MAX_TOKENS_GEMINI } from './constants';
import {
  mapHttpStatusToErrorCode,
  buildModelError,
  parseSSEStream,
  emitErrorChunk,
  filterMessagesForApi,
} from './openai-sse';

// ─── Provider config ──────────────────────────────────────────────────────────

export const GEMINI_CONFIG: ModelProviderConfig = {
  modelId: 'gemini',
  name: 'Gemini',
  color: 'emerald',
  credentialKey: 'google',
};

// ─── Google Generative Language API URL resolution ────────────────────────────

/**
 * Default model string sent to the Google API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Gemini.
 */
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

/**
 * Resolve the Gemini API base URL at request time.
 *
 * Priority chain (evaluated fresh on every call — proxy settings take effect
 * without a page reload):
 *   1. getProxyConfig()?.url + '/gemini'           — runtime Cloudflare Workers proxy
 *   2. /google-proxy                               — Vite dev server proxy (DEV only)
 *   3. https://generativelanguage.googleapis.com   — direct (CORS may fail in browser)
 *
 * Note: Google's API requires the key as a query parameter (?key=...). When using
 * the Cloudflare Workers proxy, the key is passed as part of the URL and forwarded
 * to googleapis.com unchanged — the workers script passes the full URL including
 * query params to the upstream.
 */
function resolveGeminiBase(): string {
  const proxy = getProxyConfig();
  if (proxy?.url) return `${proxy.url}/gemini`;
  if (import.meta.env.DEV) return '/google-proxy';
  return 'https://generativelanguage.googleapis.com';
}

/**
 * Build the Gemini streaming URL for a given model string.
 * The model is embedded in the URL path — selectedVersionId changes the path.
 * Calls resolveGeminiBase() at request time so proxy settings are always current.
 */
function buildGeminiUrl(modelString: string): string {
  return `${resolveGeminiBase()}/v1beta/models/${modelString}:streamGenerateContent`;
}

// ─── Google API response types ────────────────────────────────────────────────

interface GeminiContentPart {
  text?: string;
  /**
   * Inline image data (Phase 5, issue #285). Gemini uses `inlineData` for
   * base64-encoded images rather than data-URLs. `data` is raw base64 — no
   * "data:<mimeType>;base64," prefix (unlike the OpenAI image_url format).
   */
  inlineData?: {
    mimeType: string; // e.g. "image/jpeg"
    data: string;     // raw base64, no prefix
  };
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
  // Phase 5 (#285): user messages with attachments include inlineData parts.
  // sendMessage.ts strips attachments before dispatch for non-vision providers,
  // so inlineData parts are only emitted when capabilities.vision is true.
  const contents = messages.map((msg) => {
    const parts: GeminiContentPart[] = [];
    if (msg.content) {
      parts.push({ text: msg.content });
    }
    if (msg.attachments?.length && msg.role === 'user') {
      for (const attachment of msg.attachments) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.base64, // raw base64 — Attachment.base64 carries no prefix
          },
        });
      }
    }
    // Gemini rejects an empty parts array. Fall back to empty text if there is
    // genuinely nothing to send (defensive — filterMessagesForApi prevents most
    // empty-content messages, but user messages could theoretically have no text
    // and no attachments after stripping).
    if (parts.length === 0) {
      parts.push({ text: '' });
    }
    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });

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
    selectedVersionId?: string,
    signal?: AbortSignal
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(GEMINI_CONFIG.credentialKey);
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? GEMINI_DEFAULT_MODEL;

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'Google API key is not set. Add it in Settings.');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Filter error-only assistant messages from history before sending to the Google API.
    // The Gemini API rejects requests containing 'model' role turns with empty text parts.
    // Such messages are produced when a previous turn failed before emitting any content.
    // filterMessagesForApi strips them to prevent corrupt API calls.
    const filteredMessages = filterMessagesForApi(messages);

    const requestBody = buildGeminiRequest(filteredMessages, systemPrompt);

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
        signal,
      });
    } catch (networkErr) {
      // AbortError — user triggered stop before the request completed.
      // Re-throw so runProviderIsolated can identify and swallow it.
      if (networkErr instanceof Error && networkErr.name === 'AbortError') {
        throw networkErr;
      }
      const error = buildModelError(
        'network_error',
        networkErr instanceof Error ? networkErr.message : 'Network request failed'
      );
      emitErrorChunk(this.config.modelId, error, onChunk);
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
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // ─── Parse SSE stream ──────────────────────────────────────────────────────
    //
    // The Google streaming API returns SSE with `data:` lines containing JSON
    // GeminiStreamChunk objects. The final chunk includes usageMetadata.

    if (!response.body) {
      const error = buildModelError('network_error', 'Response body is not readable');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const data of parseSSEStream(response)) {
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
    } catch (streamErr) {
      // AbortError — user triggered stop mid-stream.
      // Emit a clean done chunk with whatever tokens were counted so far,
      // then re-throw so runProviderIsolated can identify and swallow it.
      if (streamErr instanceof Error && streamErr.name === 'AbortError') {
        onChunk({
          modelId: this.config.modelId,
          content: '',
          isDone: true,
          tokenUsage: {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
          },
        });
        throw streamErr;
      }
      const error = buildModelError(
        'network_error',
        streamErr instanceof Error ? streamErr.message : 'Stream read failed'
      );
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
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
