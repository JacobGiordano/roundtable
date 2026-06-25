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
 *   - The API key is only transmitted to https://api.anthropic.com
 */

import type {
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  TokenUsage,
} from '@/types';
import { getCredentials } from '@/auth';
import { MAX_TOKENS_CLAUDE } from './constants';
import {
  mapHttpStatusToErrorCode,
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

// ─── Anthropic API constants ──────────────────────────────────────────────────

/**
 * Anthropic blocks browser-direct API calls — all Origins receive a 400
 * "Disallowed CORS origin" on the OPTIONS preflight. We route through a local
 * proxy instead:
 *
 *   - In development: Vite's server.proxy forwards /anthropic-proxy/* →
 *     https://api.anthropic.com/* server-side, bypassing CORS entirely.
 *     Configured in vite.config.ts.
 *
 *   - In production: the VITE_ANTHROPIC_PROXY_URL environment variable must be
 *     set to the base URL of a compatible proxy (e.g. the self-hosted backend's
 *     /api/proxy/anthropic route). When unset, this falls back to the direct
 *     Anthropic URL — which will fail in browser contexts due to CORS; only safe
 *     when the app is served from a backend that already handles the proxy.
 *
 * The proxy must forward the x-api-key, anthropic-version, and Content-Type
 * headers to Anthropic unchanged.
 */
const ANTHROPIC_API_BASE =
  import.meta.env.VITE_ANTHROPIC_PROXY_URL ??
  (import.meta.env.DEV ? '/anthropic-proxy' : 'https://api.anthropic.com');
const ANTHROPIC_API_URL = `${ANTHROPIC_API_BASE}/v1/messages`;
const ANTHROPIC_API_VERSION = '2023-06-01';
/**
 * Default model string sent to the Anthropic API when no version is selected.
 * Matches the `id` of the first entry in MODEL_REGISTRY's availableVersions for Claude.
 */
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';

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

type AnthropicStreamEvent =
  | AnthropicMessageStart
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

    // Map Roundtable Message[] to Anthropic API format
    const anthropicMessages = filteredMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
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
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
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

    if (!response.body) {
      const error = buildModelError('network_error', 'Response body is not readable');
      emitErrorChunk(this.config.modelId, error, onChunk);
      return {};
    }

    let inputTokens = 0;
    let outputTokens = 0;

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

export const claudeProvider = new ClaudeModelProvider();
