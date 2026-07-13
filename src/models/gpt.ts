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
 *   POST /v1/images/generations with model: "gpt-image-2", parses the b64_json response
 *   into GeneratedImage[], and emits a single done StreamChunk with images populated.
 *   This is a synchronous POST → response (no SSE streaming).
 *
 *   Two-condition gate (matches Gemini pattern from issue #379):
 *     1. selectedVersionId === 'gpt-image-2'  (version selection is the capability signal)
 *     2. requestImageGeneration === true       (per-model user opt-in toggle via ModelConfig.imageGenerationEnabled)
 *   When both are true, the request is routed to /v1/images/generations.
 *   When either is false, the request falls through to the normal chat completions path.
 *
 *   Token usage: the images/generations endpoint returns no token counts. The done
 *   chunk is emitted with tokenUsage undefined (cost unknown — no pricing entry for
 *   image generation yet).
 *
 *   gpt-image-1 is a legacy model deprecated October 23 2026. It is registered as a
 *   version option with a comment only — do NOT add runtime deprecation UI. The
 *   same generateImage() path handles it via the same routing logic.
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
import { buildModelError, emitErrorChunk, mapHttpStatusToErrorCode } from './openai-sse';

// ─── Image-generation capable model strings ───────────────────────────────────

/**
 * Model strings that route to /v1/images/generations instead of /v1/chat/completions.
 * When the resolved selectedVersionId is in this set AND requestImageGeneration is true,
 * sendMessage() calls generateImage() for the dedicated image generation endpoint.
 *
 * gpt-image-2 — current GA image generation model (as of 2026).
 * gpt-image-1 — legacy model; deprecated October 23 2026. Comment-only notice — no runtime UI.
 *   The same generateImage() path handles gpt-image-1 while it remains available.
 */
const IMAGE_GEN_MODEL_STRINGS = new Set<string>([
  'gpt-image-2',
  // gpt-image-1: DEPRECATED — scheduled for removal October 23 2026 (OpenAI deprecation notice).
  // Keep in this set until that date so existing sessions using gpt-image-1 still route correctly.
  'gpt-image-1',
]);

// ─── OpenAI Images API response types ─────────────────────────────────────────

interface OpenAIImageData {
  /** Base64-encoded image. Present when response_format is "b64_json". */
  b64_json?: string;
  /** MIME type. Not returned by the API; we default to "image/png" for gpt-image-2. */
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

    // Two-condition gate: model must be an image-gen string AND user must have enabled
    // the toggle for this model (requestImageGeneration from ModelConfig.imageGenerationEnabled).
    if (IMAGE_GEN_MODEL_STRINGS.has(modelString) && requestImageGeneration === true) {
      return this.generateImage(messages, modelString, onChunk, signal);
    }

    // Not an image-gen request — delegate to the base chat completions implementation.
    return super.sendMessage(messages, systemPrompt, onChunk, selectedVersionId, signal);
  }

  /**
   * Call POST /v1/images/generations and deliver the result as a StreamChunk.
   *
   * Request shape:
   *   { model, prompt, n: 1, size: "1024x1024", response_format: "b64_json" }
   *
   * Prompt: the text content of the last user message in the conversation.
   * When no user message is found (edge case — empty or all-assistant history),
   * emits an auth_failure-shaped error with a descriptive message.
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
   *   - unknown:         any other non-OK status
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

    // gpt-image-2 uses `output_format` (the new Images API parameter name).
    // gpt-image-1 (deprecated Oct 23 2026) uses the older `response_format` name.
    // Sending `response_format` to gpt-image-2 returns:
    //   Error: Unknown parameter: 'response_format'
    // because the new endpoint strictly validates parameter names.
    const formatKey = modelString === 'gpt-image-2' ? 'output_format' : 'response_format';

    const requestBody = {
      model: modelString,
      prompt,
      n: 1,
      size: '1024x1024',
      [formatKey]: 'b64_json',
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

    // Parse the images/generations JSON response.
    let parsed: OpenAIImagesResponse;
    try {
      parsed = await response.json() as OpenAIImagesResponse;
    } catch {
      const error = buildModelError('network_error', 'Failed to parse image generation response');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Map each b64_json entry to a GeneratedImage.
    // gpt-image-2 returns PNG by default — the API does not return a mimeType field,
    // so we default to "image/png" per OpenAI documentation for this model.
    const images: GeneratedImage[] = parsed.data
      .filter((item) => !!item.b64_json)
      .map((item) => ({
        id: crypto.randomUUID(),
        // The OpenAI images/generations endpoint does not return a MIME type in
        // the response body. gpt-image-2 produces PNG images per the OpenAI docs.
        mimeType: 'image/png',
        // b64_json is raw base64 with no data-URL prefix, matching GeneratedImage.base64 convention.
        base64: item.b64_json!,
        // revised_prompt may be present when OpenAI rewrites the input prompt.
        // Use it as altText when available so Aria has a meaningful description.
        ...(item.revised_prompt ? { altText: item.revised_prompt } : {}),
        // width and height: not returned by the images/generations endpoint.
        // The size parameter (1024x1024) is what we requested, but the response
        // carries no explicit dimensions. Leave absent — Aria renders without hints.
      }));

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
