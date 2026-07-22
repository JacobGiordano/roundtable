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
  GeneratedImage,
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  TokenUsage,
} from '@/types';
import { getCredentials } from '@/auth';
// permitted cross-agent import — see ProxyConfig JSDoc in @/types
import { getProxyConfig } from '@/auth';
// permitted cross-agent import — pricing table read at send time per issue #352
import { getPricingTable } from '@/auth';
import {
  classifyHttpError,
  buildModelError,
  parseSSEStream,
  emitErrorChunk,
  filterMessagesForApi,
} from './openai-sse';

// ─── OpenAI request content types (Phase 5, issue #285) ─────────────────────
//
// The OpenAI Chat Completions API accepts multimodal content in user messages.
// Content can be either a plain string (text-only, all prior patterns) or an
// array of typed content parts (user turns with image attachments).
//
// Image parts use the `image_url` format with a data-URL:
//   `data:<mimeType>;base64,<raw-base64>`
// Note: Attachment.base64 is raw (no prefix) — we prepend "data:...;base64,"
// here when constructing the image_url value.

interface OpenAITextPart {
  type: 'text';
  text: string;
}

interface OpenAIImageUrlPart {
  type: 'image_url';
  image_url: { url: string }; // "data:<mimeType>;base64,<base64>"
}

type OpenAIContentPart = OpenAITextPart | OpenAIImageUrlPart;

// ─── SSE event types for the OpenAI Chat Completions streaming format ─────────
// All four built-in OpenAI-compatible providers share this exact wire format.

interface OpenAIChoiceDelta {
  /**
   * Content delta from the model. Normally a `string` (text token), `null`
   * (non-text chunk, e.g. finish-reason chunk), or absent.
   *
   * Newer multimodal-output models may return an array of typed content parts
   * instead of a plain string — the same `OpenAIContentPart` shape defined
   * above for inputs. We handle `image_url` parts with data-URL values here to
   * extract base64 image content when a model returns generated images inline.
   */
  content?: string | null | OpenAIContentPart[];
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

// ─── Models requiring max_completion_tokens ───────────────────────────────────
//
// OpenAI's newer reasoning models and gpt-5.5 require `max_completion_tokens`
// instead of `max_tokens` in the request body. Sending `max_tokens` to these
// models returns a 400: "Unsupported parameter: 'max_tokens' is not supported
// with this model. Use 'max_completion_tokens' instead."
//
// `gpt-4o` and `gpt-4o-mini` use `max_tokens` and do NOT accept
// `max_completion_tokens` — so this must be detected per resolved model string,
// not at the provider class level (GPT55ModelProvider serves all six versions).
//
// This Set lives at the module level so it is allocated once, not per request.
const MAX_COMPLETION_TOKENS_MODELS = new Set([
  'gpt-5.5',
  // gpt-5.6 is the first/default version in MODEL_REGISTRY's availableVersions
  // and requires max_completion_tokens rather than max_tokens. Omitting it caused
  // a 400 API error whenever the user selected gpt-5.6 as their model version.
  // Issue #525.
  'gpt-5.6',
  'o3',
  'o1',
  'o1-mini',
]);

// ─── BaseOpenAIProvider ───────────────────────────────────────────────────────

export abstract class BaseOpenAIProvider implements ModelProvider {
  /** ModelProviderConfig — must be declared by subclass as a readonly property. */
  abstract readonly config: ModelProviderConfig;

  /** Full URL of the OpenAI-compatible /v1/chat/completions endpoint. */
  protected abstract get apiUrl(): string;

  /** Default API model string used when no selectedVersionId is provided. */
  protected abstract get defaultModel(): string;

  /**
   * Output token ceiling for this provider. Sent as `max_tokens` for gpt-4o
   * and gpt-4o-mini; sent as `max_completion_tokens` for gpt-5.5, o3, o1, and
   * o1-mini. The key is selected at request-build time via MAX_COMPLETION_TOKENS_MODELS.
   */
  protected abstract get maxTokens(): number;

  /**
   * Human-readable message shown to the user when the API key is not set.
   * Example: "OpenAI API key is not set. Add it in Settings."
   */
  protected abstract get authErrorMessage(): string;

  /**
   * Resolve the provider API base URL at request time.
   *
   * Priority chain (evaluated fresh on every sendMessage call — proxy settings
   * take effect without a page reload):
   *   1. getProxyConfig()?.url + proxySegment  — runtime Cloudflare Workers proxy
   *   2. legacyEnvVar                           — legacy build-time env var (kept for compat)
   *   3. devPath                                — Vite dev server proxy (DEV only)
   *   4. directUrl                              — direct provider URL (CORS-blocked in most
   *                                               browser contexts without a proxy)
   *
   * Called by each subclass's `apiUrl` getter, which is itself called inside
   * `sendMessage()` — so URL resolution always happens at request time.
   *
   * @param proxySegment  - Provider path segment appended to the proxy base URL,
   *                        e.g. '/openai', '/grok'. Must start with '/'.
   * @param legacyEnvVar  - Build-time env var value (e.g. VITE_OPENAI_PROXY_URL),
   *                        or undefined if no legacy env var exists for this provider.
   * @param devPath       - Vite dev proxy path, e.g. '/openai-proxy'.
   * @param directUrl     - The provider's canonical API base URL.
   */
  protected resolveBaseUrl(
    proxySegment: string,
    legacyEnvVar: string | undefined,
    devPath: string,
    directUrl: string,
  ): string {
    const proxy = getProxyConfig();
    if (proxy?.url) return proxy.url + proxySegment;
    if (legacyEnvVar) return legacyEnvVar;
    if (import.meta.env.DEV) return devPath;
    return directUrl;
  }

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string,
    signal?: AbortSignal
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(this.config.credentialKey);
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? this.defaultModel;

    if (!apiKey) {
      const error = buildModelError('auth_failure', this.authErrorMessage);
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Filter error-only assistant messages from history before sending to the API.
    // OpenAI-compatible APIs reject requests containing assistant messages with empty
    // content. Such messages are produced when a previous turn failed before emitting
    // any text. filterMessagesForApi strips them to prevent corrupt API calls.
    const filteredMessages = filterMessagesForApi(messages);

    // Map Roundtable Message[] to OpenAI-compatible Chat API format.
    // Prepend the system prompt as a system message if provided.
    // Phase 5 (#285): user messages with attachments use typed content-part arrays
    // (image_url parts) instead of plain strings. sendMessage.ts strips attachments
    // before dispatch for non-vision providers, so this branch is only reached when
    // capabilities.vision is true for this provider.
    const apiMessages: Array<{
      role: 'system' | 'user' | 'assistant';
      content: string | OpenAIContentPart[];
    }> = [];

    if (systemPrompt) {
      apiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of filteredMessages) {
      if (msg.attachments?.length && msg.role === 'user') {
        const parts: OpenAIContentPart[] = [];
        if (msg.content) {
          parts.push({ type: 'text', text: msg.content });
        }
        for (const attachment of msg.attachments) {
          parts.push({
            type: 'image_url',
            // Prepend the data-URL prefix — Attachment.base64 is raw (no prefix).
            image_url: { url: `data:${attachment.mimeType};base64,${attachment.base64}` },
          });
        }
        apiMessages.push({ role: 'user', content: parts });
      } else {
        apiMessages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // gpt-5.5, o3, o1, and o1-mini require `max_completion_tokens`; gpt-4o
    // and gpt-4o-mini require `max_tokens`. The two keys are mutually exclusive
    // on their respective models — sending the wrong one returns a 400.
    const tokenLimitKey = MAX_COMPLETION_TOKENS_MODELS.has(modelString)
      ? 'max_completion_tokens'
      : 'max_tokens';

    const requestBody = {
      model: modelString,
      [tokenLimitKey]: this.maxTokens,
      stream: true,
      // Request token usage in the final stream chunk (OpenAI-compatible extension).
      //
      // Spike #345 — confirmed safe with o1 and o1-mini:
      // Both models support streaming (since Nov 2024) and stream_options.include_usage
      // is documented by OpenAI as working with all streaming-capable Chat Completions
      // requests. Tested against the o1-mini and o1 model pages on platform.openai.com
      // — no known incompatibility. No per-model exclusion set needed.
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
      let detail = `HTTP ${response.status}`;
      try {
        const body = await response.json() as { error?: { message?: string } };
        if (body.error?.message) detail = body.error.message;
      } catch {
        // ignore JSON parse failure — use status code detail
      }
      // classifyHttpError inspects the error message body for auth keywords.
      // This correctly handles providers (e.g. xAI/Grok) that return HTTP 400
      // for a bad API key rather than the conventional 401 (issue #544).
      const code = classifyHttpError(response.status, detail);
      const error = buildModelError(code, detail);
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // ─── Parse SSE stream ──────────────────────────────────────────────────────

    if (!response.body) {
      const error = buildModelError('network_error', 'Response body is not readable');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    let inputTokens = 0;
    let outputTokens = 0;
    // Accumulate image content encountered in multimodal-output delta chunks.
    // OpenAI-compatible providers may return image_url content parts with data
    // URLs when a model generates images. Emitted on the final chunk only;
    // undefined (not []) when no images were returned.
    const collectedImages: GeneratedImage[] = [];

    try {
      for await (const data of parseSSEStream(response)) {
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

        // Emit content deltas and collect any image content parts
        for (const choice of event.choices) {
          const deltaContent = choice.delta.content;
          if (typeof deltaContent === 'string' && deltaContent) {
            // Common path: plain text delta
            onChunk({
              modelId: this.config.modelId,
              content: deltaContent,
              isDone: false,
            });
          } else if (Array.isArray(deltaContent)) {
            // Multimodal-output path: content parts array.
            // Extract base64 image_url parts; skip text parts (emitted as plain
            // string deltas in conformant chunks) and non-base64 URL references
            // (downloading remote URLs is out of scope for this client).
            for (const part of deltaContent) {
              if (part.type === 'image_url') {
                const url = (part as OpenAIImageUrlPart).image_url.url;
                // Only handle data URLs — format: "data:<mimeType>;base64,<data>"
                const match = url.match(/^data:([^;]+);base64,(.+)$/);
                if (match) {
                  collectedImages.push({
                    id: crypto.randomUUID(),
                    mimeType: match[1],
                    base64: match[2],
                  });
                }
              }
            }
          }
        }
      }
    } catch (streamErr) {
      // AbortError — user triggered stop mid-stream.
      // Emit a clean done chunk with whatever tokens and images were collected
      // so far, then re-throw so runProviderIsolated can identify and swallow it.
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
          images: collectedImages.length > 0 ? collectedImages : undefined,
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

    // Emit final done chunk with token usage and any images returned by the model.
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    // Compute estimated cost if pricing data is available for this model.
    // Missing entry or null table means cost is unknown — do not set to 0.
    const pricingTable = getPricingTable();
    const pricingEntry = pricingTable?.[modelString];
    if (pricingEntry) {
      tokenUsage.estimatedCost =
        (tokenUsage.inputTokens / 1_000_000) * pricingEntry.inputPer1M +
        (tokenUsage.outputTokens / 1_000_000) * pricingEntry.outputPer1M;
    }

    onChunk({
      modelId: this.config.modelId,
      content: '',
      isDone: true,
      tokenUsage,
      // images is undefined (not []) when no images were returned, per StreamChunk contract.
      images: collectedImages.length > 0 ? collectedImages : undefined,
    });

    return { tokenUsage };
  }
}
