/**
 * Atlas — claude.ts
 *
 * ClaudeModelProvider implementing the ModelProvider interface from /src/types/index.ts.
 * Uses fetch + the Anthropic Messages API with server-sent events (SSE) for streaming.
 * No @anthropic-ai/sdk dependency — raw fetch to avoid adding external packages.
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the resolved Anthropic endpoint (direct or via proxy)
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
import { MAX_TOKENS_CLAUDE } from './constants';
import {
  classifyHttpError,
  buildModelError,
  parseSSEStream,
  emitErrorChunk,
  filterMessagesForApi,
} from './openai-sse';

// ─── Provider config ──────────────────────────────────────────────────────────

export const CLAUDE_CONFIG: ModelProviderConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  credentialKey: 'anthropic',
};

// ─── Anthropic API URL resolution ─────────────────────────────────────────────

const ANTHROPIC_API_VERSION = '2023-06-01';

/**
 * Resolve the Anthropic Messages API URL at request time.
 *
 * Priority chain (evaluated fresh on every call — proxy settings take effect
 * without a page reload):
 *   1. getProxyConfig()?.url + '/anthropic'  — runtime Cloudflare Workers proxy
 *   2. VITE_ANTHROPIC_PROXY_URL              — legacy build-time proxy (kept for compat)
 *   3. /anthropic-proxy                      — Vite dev server proxy (DEV only)
 *   4. https://api.anthropic.com             — direct (CORS-blocked in most browser contexts)
 *
 * Anthropic blocks browser-direct API calls — all Origins receive a 400
 * "Disallowed CORS origin" on the OPTIONS preflight. Options 1–3 route through
 * a server-side or worker-side proxy that bypasses CORS.
 */
function resolveAnthropicApiUrl(): string {
  const proxy = getProxyConfig();
  if (proxy?.url) return `${proxy.url}/anthropic/v1/messages`;
  const legacyBase = import.meta.env.VITE_ANTHROPIC_PROXY_URL;
  if (legacyBase) return `${legacyBase}/v1/messages`;
  if (import.meta.env.DEV) return '/anthropic-proxy/v1/messages';
  return 'https://api.anthropic.com/v1/messages';
}
/**
 * Default model string sent to the Anthropic API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Claude.
 */
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';

// ─── Anthropic request content types (Phase 5, issue #285) ──────────────────
//
// User messages can carry multimodal content (text + image parts). The content
// field on an Anthropic message is either a plain string (text-only, all prior
// turns and assistant turns) or an array of typed content parts (user turns
// with attachments). Both forms are valid in the Anthropic Messages API.
//
// Image parts carry raw base64 (no data-URL prefix) — Anthropic's API expects
// the media_type and data as separate fields in the source object.

interface AnthropicTextPart {
  type: 'text';
  text: string;
}

interface AnthropicImagePart {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string; // e.g. "image/jpeg"
    data: string;       // raw base64, no "data:..." prefix
  };
}

type AnthropicContentPart = AnthropicTextPart | AnthropicImagePart;
type AnthropicMessageContent = string | AnthropicContentPart[];

/**
 * Build the Anthropic API `content` value for a single message.
 *
 * For user messages with attachments, returns an array of typed content parts
 * (text part first if non-empty, then one image part per attachment). The text
 * part is omitted when `msg.content` is empty — image-only user turns are valid.
 *
 * For all other messages (assistant turns, user turns without attachments),
 * returns `msg.content` as a plain string — this is the common fast path and
 * matches the existing wire format exactly.
 *
 * Attachment presence here means capabilities.vision was true for this provider
 * — sendMessage.ts strips attachments before dispatch for non-vision providers.
 */
function buildAnthropicContent(msg: Message): AnthropicMessageContent {
  if (!msg.attachments?.length || msg.role !== 'user') {
    return msg.content;
  }
  const parts: AnthropicContentPart[] = [];
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content });
  }
  for (const attachment of msg.attachments) {
    parts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: attachment.mimeType,
        data: attachment.base64, // raw base64 — Attachment.base64 carries no prefix
      },
    });
  }
  return parts;
}

// ─── SSE event types emitted by the Anthropic streaming API ──────────────────

interface AnthropicContentBlockDelta {
  type: 'content_block_delta';
  index: number;
  delta: { type: 'text_delta'; text: string };
}

interface AnthropicMessageDelta {
  type: 'message_delta';
  delta: { stop_reason: string };
  usage: { output_tokens: number };
}

interface AnthropicMessageStart {
  type: 'message_start';
  message: {
    usage: { input_tokens: number; output_tokens: number };
  };
}

/**
 * Anthropic image content block, returned as part of a `content_block_start`
 * event when the model response includes an image (e.g. from a tool result or
 * a model that natively generates image content). The full image arrives in the
 * start event — images are not streamed incrementally via content_block_delta.
 *
 * `source.data` is raw base64 with no data-URL prefix, matching the
 * `GeneratedImage.base64` convention: Atlas stores it as-is; Aria prepends the
 * appropriate prefix when rendering.
 */
interface AnthropicImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string; // e.g. "image/png"
    data: string;       // raw base64, no "data:...;base64," prefix
  };
}

interface AnthropicContentBlockStart {
  type: 'content_block_start';
  index: number;
  content_block: { type: string } | AnthropicImageContentBlock;
}

type AnthropicStreamEvent =
  | AnthropicMessageStart
  | AnthropicContentBlockStart
  | AnthropicContentBlockDelta
  | AnthropicMessageDelta
  | { type: string };

// ─── ClaudeModelProvider ──────────────────────────────────────────────────────

export class ClaudeModelProvider implements ModelProvider {
  readonly config: ModelProviderConfig = CLAUDE_CONFIG;

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string,
    signal?: AbortSignal
  ): Promise<{ tokenUsage?: TokenUsage }> {
    // Retrieve API key at call-time — never store in state
    const apiKey = getCredentials('anthropic');
    // Resolve the API model string: use selectedVersionId if provided, fall back to default.
    const modelString = selectedVersionId ?? ANTHROPIC_DEFAULT_MODEL;

    if (!apiKey) {
      const error = buildModelError('auth_failure', 'Anthropic API key is not set. Add it in Settings.');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    // Filter error-only assistant messages from history before sending to Anthropic.
    // The Anthropic API rejects requests containing assistant messages with empty content.
    // Such messages are produced when a previous turn failed before emitting any text.
    // filterMessagesForApi strips them so they do not corrupt future API calls.
    const filteredMessages = filterMessagesForApi(messages);

    // Map Roundtable Message[] to Anthropic API format.
    // For user messages with attachments, content is an array of typed parts
    // (text + image). For all other messages, content is a plain string.
    // Phase 5 (#285): buildAnthropicContent handles multimodal formatting.
    const anthropicMessages: Array<{
      role: 'user' | 'assistant';
      content: AnthropicMessageContent;
    }> = filteredMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: buildAnthropicContent(msg),
    }));

    const requestBody: Record<string, unknown> = {
      model: modelString,
      max_tokens: MAX_TOKENS_CLAUDE,
      stream: true,
      messages: anthropicMessages,
    };

    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    let response: Response;
    try {
      response = await fetch(resolveAnthropicApiUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (networkErr) {
      // AbortError — user triggered stop before the request completed.
      // Resolve cleanly; runProviderIsolated handles the AbortError at the outer level.
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
      // Anthropic returns standard 401 for bad keys, but body-aware classification
      // is applied consistently across all providers for correctness (issue #544).
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
    // Accumulate image content blocks encountered during streaming.
    // Images arrive complete in content_block_start events — never as incremental deltas.
    // Emitted on the final chunk only; undefined (not []) when no images were returned.
    const collectedImages: GeneratedImage[] = [];

    try {
      for await (const data of parseSSEStream(response)) {
        let event: AnthropicStreamEvent;
        try {
          event = JSON.parse(data) as AnthropicStreamEvent;
        } catch {
          continue;
        }

        if (event.type === 'message_start') {
          const start = event as AnthropicMessageStart;
          inputTokens = start.message.usage.input_tokens;
          outputTokens = start.message.usage.output_tokens;
        } else if (event.type === 'content_block_start') {
          // Detect image content blocks. The full image data arrives here —
          // Anthropic does not stream image bytes incrementally via content_block_delta.
          // Only base64-source blocks are handled; URL-source blocks are skipped
          // because downloading remote URLs is out of scope for this client.
          const blockStart = event as AnthropicContentBlockStart;
          if (blockStart.content_block.type === 'image') {
            const block = blockStart.content_block as AnthropicImageContentBlock;
            if (block.source.type === 'base64') {
              collectedImages.push({
                id: crypto.randomUUID(),
                mimeType: block.source.media_type,
                base64: block.source.data,
              });
            }
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event as AnthropicContentBlockDelta;
          if (delta.delta.type === 'text_delta') {
            onChunk({
              modelId: this.config.modelId,
              content: delta.delta.text,
              isDone: false,
            });
          }
        } else if (event.type === 'message_delta') {
          const msgDelta = event as AnthropicMessageDelta;
          outputTokens += msgDelta.usage.output_tokens;
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

// ─── Singleton ────────────────────────────────────────────────────────────────

export const claudeProvider = new ClaudeModelProvider();
