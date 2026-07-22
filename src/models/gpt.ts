/**
 * Atlas — gpt.ts
 *
 * GPT55ModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Extends BaseOpenAIProvider — streaming logic, SSE parsing, error handling, and
 * token counting all live there. This file declares only the GPT-specific config:
 * API URL, default model, max tokens, and credential key.
 *
 * Image generation (issue #377):
 *   When selectedVersionId === 'gpt-image-2', sendMessage() is overridden to call
 *   generateImage() instead of the base chat completions path. generateImage() calls
 *   POST /v1/images/generations and emits a single done StreamChunk with images populated.
 *   This is a synchronous POST → response (no SSE streaming).
 *
 *   Two-condition gate (matches Gemini pattern from issue #379):
 *     1. selectedVersionId === 'gpt-image-2'  (version selection is the capability signal)
 *     2. requestImageGeneration === true       (per-model user opt-in toggle via ModelConfig.imageGenerationEnabled)
 *   When both are true, the request is routed to /v1/images/generations.
 *   When either is false, the request falls through to the normal chat completions path.
 *
 *   API response format for both gpt-image-2 and gpt-image-1:
 *     Both models return base64-encoded image data in the `b64_json` field of each
 *     data item. The delivery mechanism is always base64 — there is no URL-based
 *     delivery path.
 *
 *     gpt-image-2: uses output_format parameter (values: 'png', 'webp', 'jpeg').
 *       output_format controls the image encoding format, not the delivery method.
 *       The API returns raw base64 in item.b64_json regardless of output_format.
 *     gpt-image-1 (deprecated Oct 23 2026): uses response_format: 'b64_json' parameter.
 *       The API returns base64 directly in the b64_json field of each data item.
 *
 *   Token usage: the images/generations endpoint returns no token counts. The done
 *   chunk is emitted with tokenUsage undefined (cost unknown — no pricing entry for
 *   image generation yet).
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the resolved OpenAI endpoint (direct or via proxy)
 *
 * URL resolution (evaluated at request time — proxy settings take effect without reload):
 *   1. getProxyConfig()?.url + '/openai'  — runtime Cloudflare Workers proxy (new)
 *   2. VITE_OPENAI_PROXY_URL              — legacy build-time proxy (kept for compat)
 *   3. /openai-proxy                      — Vite dev server proxy (DEV only)
 *   4. https://api.openai.com             — direct (CORS-blocked in many browser environments)
 */

import type { GeneratedImage, Message, ModelProviderConfig, StreamHandler, TokenUsage } from '@/types';
import { getCredentials } from '@/auth';
import { MAX_TOKENS_GPT } from './constants';
import { BaseOpenAIProvider } from './BaseOpenAIProvider';
import { buildModelError, classifyHttpError, emitErrorChunk } from './openai-sse';

// ─── Image-model config map (#399) ────────────────────────────────────────────

/**
 * Per-model configuration for the OpenAI images/generations endpoint.
 *
 * Encodes the parameter shape divergence between GPT image model generations so
 * the generation code reads from this map rather than branching on model ID strings.
 * Adding a new image model is a data change here, not a code change in generateImage().
 *
 * `formatParams` — the format control parameter(s) to spread into the request body.
 *   gpt-image-2: { output_format: 'png' }
 *     output_format controls the image encoding format (valid: 'png', 'webp', 'jpeg').
 *     Sending 'b64_json' to gpt-image-2 is invalid; sending 'response_format' returns
 *     "Unknown parameter: 'response_format'". Must use output_format.
 *   gpt-image-1 (deprecated Oct 23 2026): { response_format: 'b64_json' }
 *     Older parameter name. Accepted by gpt-image-1; rejected by gpt-image-2.
 *
 * `mimeType` — MIME type for the GeneratedImage output. Both current models return PNG.
 *   Included in the config so new models with different default encodings (e.g. WebP)
 *   can be added without touching generateImage().
 *
 * Both models always deliver base64 in item.b64_json — response parsing is unified.
 */
interface GptImageModelConfig {
  /** Format control parameters spread into the images/generations request body. */
  formatParams: Record<string, string>;
  /** MIME type for the GeneratedImage output (e.g. "image/png"). */
  mimeType: string;
}

const GPT_IMAGE_MODEL_CONFIG = new Map<string, GptImageModelConfig>([
  ['gpt-image-2', {
    // output_format: controls encoding format (png/webp/jpeg), not delivery mechanism.
    // Delivery is always base64 in item.b64_json regardless of this value.
    formatParams: { output_format: 'png' },
    mimeType: 'image/png',
  }],
  // gpt-image-1: DEPRECATED — scheduled for removal October 23 2026 (OpenAI deprecation notice).
  // Keep in the map until that date so existing sessions using gpt-image-1 still route correctly.
  ['gpt-image-1', {
    // response_format: 'b64_json' — the older parameter name; accepted only by gpt-image-1.
    // Delivery is base64 in item.b64_json, same as gpt-image-2.
    formatParams: { response_format: 'b64_json' },
    mimeType: 'image/png',
  }],
]);

// ─── OpenAI Images API response types ─────────────────────────────────────────

interface OpenAIImageData {
  /**
   * Base64-encoded image. Present for both gpt-image-2 and gpt-image-1.
   *
   * gpt-image-2 (output_format: 'png'/'webp'/'jpeg'): the API always returns
   *   base64 in b64_json regardless of output_format. output_format controls
   *   the image encoding format, not the delivery mechanism.
   * gpt-image-1 (deprecated Oct 23 2026, response_format: 'b64_json'): same field.
   *
   * Value is raw base64 with no data-URL prefix, matching GeneratedImage.base64.
   */
  b64_json?: string;
  /** Optional revised prompt returned when OpenAI rewrites the input prompt. */
  revised_prompt?: string;
}

interface OpenAIImagesResponse {
  created: number;
  data: OpenAIImageData[];
}

// ─── Provider config ──────────────────────────────────────────────────────────

export const GPT55_CONFIG: ModelProviderConfig = {
  modelId: 'gpt-5.5',
  name: 'ChatGPT',
  color: 'emerald',
  credentialKey: 'openai',
};

// ─── GPT55ModelProvider ───────────────────────────────────────────────────────

export class GPT55ModelProvider extends BaseOpenAIProvider {
  readonly config: ModelProviderConfig = GPT55_CONFIG;

  protected get apiUrl(): string {
    const base = this.resolveBaseUrl(
      '/openai',
      import.meta.env.VITE_OPENAI_PROXY_URL,
      '/openai-proxy',
      'https://api.openai.com',
    );
    return `${base}/v1/chat/completions`;
  }

  /**
   * Resolve the base URL for the OpenAI API at request time.
   * Shared by both apiUrl (chat completions) and generateImage (images/generations).
   */
  private get openAiBaseUrl(): string {
    return this.resolveBaseUrl(
      '/openai',
      import.meta.env.VITE_OPENAI_PROXY_URL,
      '/openai-proxy',
      'https://api.openai.com',
    );
  }

  /**
   * Default model string sent to the OpenAI API when no version is selected.
   * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for GPT.
   *
   * Spike #346 — gpt-5.5 availability confirmed:
   * GPT-5.5 is broadly available to all paid API tiers (Tier 1+) as of
   * April 24, 2026. A live 500 error observed in a 3-model conversation was a
   * transient server-side error, not a model-not-found failure — OpenAI docs
   * classify 500s as temporary and recommend exponential backoff retries. The
   * default remains gpt-5.5; no fallback to gpt-4o is needed.
   */
  protected get defaultModel(): string {
    return 'gpt-5.5';
  }

  protected get maxTokens(): number {
    return MAX_TOKENS_GPT;
  }

  protected get authErrorMessage(): string {
    return 'OpenAI API key is not set. Add it in Settings.';
  }

  /**
   * Override sendMessage to intercept image-generation requests.
   *
   * Two-condition gate (matching the Gemini imageGeneration pattern, issue #379):
   *   1. The resolved model string is in IMAGE_GEN_MODEL_STRINGS
   *   2. requestImageGeneration === true (user has enabled the toggle for this model)
   *
   * When both conditions are met, route to generateImage() instead of the base
   * chat completions path. All other cases fall through to the base implementation.
   *
   * The extra optional parameters (selectedVersionId, signal, requestImageGeneration)
   * match the VersionAwareProvider signature in sendMessage.ts so the cast works
   * without type errors.
   */
  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string,
    signal?: AbortSignal,
    requestImageGeneration?: boolean
  ): Promise<{ tokenUsage?: TokenUsage }> {
    const modelString = selectedVersionId ?? this.defaultModel;

    // Two-condition gate: model must be in the image-gen config map AND user must have
    // enabled the toggle for this model (requestImageGeneration from ModelConfig.imageGenerationEnabled).
    if (GPT_IMAGE_MODEL_CONFIG.has(modelString) && requestImageGeneration === true) {
      return this.generateImage(messages, modelString, onChunk, signal);
    }

    // Not an image-gen request — delegate to the base chat completions implementation.
    return super.sendMessage(messages, systemPrompt, onChunk, selectedVersionId, signal);
  }

  /**
   * Call POST /v1/images/generations and deliver the result as a StreamChunk.
   *
   * Request shape differs by model:
   *   gpt-image-2: { model, prompt, n: 1, size: "1024x1024", output_format: "png" }
   *     output_format controls the image encoding format, not delivery mechanism.
   *     Response data items carry raw base64 in b64_json regardless of output_format.
   *   gpt-image-1 (deprecated Oct 23 2026):
   *     { model, prompt, n: 1, size: "1024x1024", response_format: "b64_json" }
   *     Response data items carry b64_json directly.
   *   Both models deliver base64 in item.b64_json — response parsing is unified.
   *
   * Prompt: the text content of the last user message in the conversation.
   * When no user message is found (edge case — empty or all-assistant history),
   * emits an error with a descriptive message.
   *
   * Response: a single done StreamChunk with:
   *   - content: '' (empty — image responses carry no text)
   *   - images: GeneratedImage[] (one entry per returned image)
   *   - isDone: true
   *   - tokenUsage: undefined (images/generations returns no token counts)
   *
   * Error handling covers all ModelErrorCode variants:
   *   - auth_failure:    401 from the API (bad or missing key)
   *   - rate_limit:      429 from the API
   *   - network_error:   fetch throw or unreadable response body
   *   - context_length_exceeded: 400 with prompt-too-long message
   *   - unknown:         any other non-OK status or empty response data
   *
   * No streaming — this is a synchronous POST → JSON response. The single done
   * chunk is emitted after the full response has been parsed.
   */
  private async generateImage(
    messages: Message[],
    modelString: string,
    onChunk: StreamHandler,
    signal?: AbortSignal
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials(this.config.credentialKey);

    if (!apiKey) {
      const error = buildModelError('auth_failure', this.authErrorMessage);
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Extract the prompt from the last user message in the conversation.
    // The images/generations endpoint takes a text prompt — not a message array.
    const lastUserMsg = messages.slice().reverse().find((m) => m.role === 'user');
    if (!lastUserMsg?.content) {
      const error = buildModelError(
        'unknown',
        'No user message found to use as image prompt.'
      );
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    const prompt = lastUserMsg.content;

    // Look up per-model parameter config from GPT_IMAGE_MODEL_CONFIG (#399).
    // formatParams encodes the model-specific format control parameter(s):
    //   gpt-image-2: { output_format: 'png' }
    //   gpt-image-1: { response_format: 'b64_json' }
    // mimeType is used when constructing GeneratedImage entries below.
    // The config entry is always present here because generateImage() is only called
    // when GPT_IMAGE_MODEL_CONFIG.has(modelString) is true (see sendMessage override).
    const imageModelConfig = GPT_IMAGE_MODEL_CONFIG.get(modelString)!;

    const requestBody = {
      model: modelString,
      prompt,
      n: 1,
      size: '1024x1024',
      ...imageModelConfig.formatParams,
    };

    const url = `${this.openAiBaseUrl}/v1/images/generations`;

    let response: Response;
    try {
      response = await fetch(url, {
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
      // OpenAI returns standard 401 for bad keys, but body-aware classification
      // is applied consistently for correctness (issue #544).
      const code = classifyHttpError(response.status, detail);
      const error = buildModelError(code, detail);
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Parse the images/generations JSON response.
    let parsed: OpenAIImagesResponse;
    try {
      parsed = await response.json() as OpenAIImagesResponse;
    } catch {
      const error = buildModelError('network_error', 'Failed to parse image generation response');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Map each response item to a GeneratedImage.
    //
    // Both gpt-image-2 and gpt-image-1 return raw base64 in item.b64_json.
    // The delivery mechanism is always base64 regardless of format control parameters.
    //
    // mimeType comes from imageModelConfig.mimeType (GPT_IMAGE_MODEL_CONFIG entry for this
    // model string). Both current models request PNG output (output_format: 'png' for
    // gpt-image-2; response_format: 'b64_json' with default PNG for gpt-image-1), so
    // mimeType is "image/png" for both. Future models with different default encodings
    // can be added to GPT_IMAGE_MODEL_CONFIG without changing this code.
    //
    // The OpenAI images/generations endpoint does not return width/height — the size
    // parameter (1024x1024) is what we requested, but the response carries no explicit
    // dimensions. Leave absent — Aria renders without hints.
    const images: GeneratedImage[] = [];
    for (const item of parsed.data) {
      // Both model generations deliver base64 in b64_json — skip items missing it.
      if (!item.b64_json) continue;

      images.push({
        id: crypto.randomUUID(),
        mimeType: imageModelConfig.mimeType,
        base64: item.b64_json,
        // revised_prompt may be present when OpenAI rewrites the input prompt.
        // Use it as altText when available so Aria has a meaningful description.
        ...(item.revised_prompt ? { altText: item.revised_prompt } : {}),
      });
    }

    if (images.length === 0) {
      const error = buildModelError('unknown', 'Image generation returned no images');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Emit single done chunk. No token usage — images/generations returns none.
    // images is undefined (not []) when empty, per StreamChunk contract, but we
    // already guarded above so images.length >= 1 here.
    onChunk({
      modelId: this.config.modelId,
      content: '',
      isDone: true,
      images,
    });

    return {};
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const gpt55Provider = new GPT55ModelProvider();
