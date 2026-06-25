/**
 * Atlas — generic.ts
 *
 * GenericOpenAIProvider — a ModelProvider implementation that targets any
 * OpenAI-compatible streaming endpoint (OpenRouter, Ollama, LM Studio,
 * private endpoints, etc.).
 *
 * The endpoint URL, model string, and credential key all come from a
 * CustomProviderConfig supplied at construction time. SSE parsing is
 * identical to GPT55ModelProvider (OpenAI Chat Completions format).
 *
 * Security rules (non-negotiable):
 *   - The API key is retrieved at call-time via getCredentials() and never stored in state
 *   - The API key is NEVER logged
 *   - The API key is only transmitted to the endpoint URL supplied by the user's config
 *
 * Phase extension note: per-model token limits could be made configurable
 * via CustomProviderConfig in a future phase. For now MAX_TOKENS_GENERIC is used
 * as a conservative default (see /src/models/constants.ts).
 */

import type {
  ModelProvider,
  ModelProviderConfig,
  Message,
  StreamHandler,
  TokenUsage,
  CustomProviderConfig,
} from '@/types';
import { getCredentials } from '@/auth';
import { MAX_TOKENS_GENERIC } from './constants';
import {
  mapHttpStatusToErrorCode,
  buildModelError,
  parseSSEStream,
  emitErrorChunk,
  filterMessagesForApi,
} from './openai-sse';

// ─── SSE event types emitted by the OpenAI-compatible streaming API ───────────

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
  object: string;
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

// ─── GenericOpenAIProvider ────────────────────────────────────────────────────

export class GenericOpenAIProvider implements ModelProvider {
  readonly config: ModelProviderConfig;

  /** The full CustomProviderConfig supplied at construction. */
  private readonly customConfig: CustomProviderConfig;

  constructor(customConfig: CustomProviderConfig) {
    this.customConfig = customConfig;
    this.config = {
      modelId: customConfig.id,
      name: customConfig.displayName,
      // color may be a CSS token or hex; fall back to 'gray' as a safe Tailwind token
      // if the field is absent. Aria renders color via accent overrides — this field
      // is present to satisfy ModelProviderConfig but Aria will prefer customConfig.color.
      color: customConfig.color ?? 'gray',
      credentialKey: customConfig.credentialKey ?? '',
    };
  }

  async sendMessage(
    messages: Message[],
    systemPrompt: string | undefined,
    onChunk: StreamHandler,
    selectedVersionId?: string,
    signal?: AbortSignal
  ): Promise<{ tokenUsage?: TokenUsage }> {
    const { endpointUrl, modelString: defaultModelString, credentialKey, id: modelId } = this.customConfig;

    // selectedVersionId allows callers to override the configured model string.
    // Phase extension point: when sendMessage.ts passes selectedVersionId for custom
    // providers, this resolves to that version rather than the config default.
    const resolvedModelString = selectedVersionId ?? defaultModelString;

    // Retrieve API key at call-time — never store in state.
    //
    // No pre-flight auth failure check here. If credentialKey is present but no
    // key is stored, we proceed with no Authorization header and let the endpoint
    // respond. Local endpoints (Ollama, LM Studio) require no auth — blocking on
    // a missing key would silence them entirely. Remote endpoints that genuinely
    // need a key will respond with 401/403, which mapHttpStatusToErrorCode maps
    // to auth_failure below. This approach correctly handles both cases:
    //   - No-auth endpoint (Ollama): succeeds without a key.
    //   - Auth-required endpoint (OpenRouter): server returns 401 → auth_failure error.
    const apiKey = credentialKey ? getCredentials(credentialKey) : undefined;

    // Filter error-only assistant messages from history before sending to the API.
    // OpenAI-compatible endpoints reject requests containing assistant messages with
    // empty content. Such messages are produced when a previous turn failed before
    // emitting any text. filterMessagesForApi strips them to prevent corrupt API calls.
    const filteredMessages = filterMessagesForApi(messages);

    // Map Roundtable Message[] to OpenAI Chat API format.
    // Prepend the system prompt as a system message if provided.
    const openaiMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    if (systemPrompt) {
      openaiMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of filteredMessages) {
      openaiMessages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }

    const requestBody = {
      model: resolvedModelString,
      max_tokens: MAX_TOKENS_GENERIC,
      stream: true,
      // Request token usage in the final stream chunk.
      // Not all OpenAI-compatible endpoints honour this option — if the field is
      // absent in the response, inputTokens and outputTokens remain zero and we
      // still emit a valid done chunk rather than failing.
      stream_options: { include_usage: true },
      messages: openaiMessages,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
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
      emitErrorChunk(modelId, error, onChunk);
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
      emitErrorChunk(modelId, error, onChunk);
      return {};
    }

    // ─── Parse SSE stream ──────────────────────────────────────────────────────

    if (!response.body) {
      const error = buildModelError('network_error', 'Response body is not readable');
      emitErrorChunk(modelId, error, onChunk);
      return {};
    }

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      for await (const data of parseSSEStream(response)) {
        let event: OpenAIStreamChunk;
        try {
          event = JSON.parse(data) as OpenAIStreamChunk;
        } catch {
          continue;
        }

        // Capture token usage from the final usage chunk (stream_options.include_usage).
        // If the endpoint does not return usage, inputTokens and outputTokens stay zero
        // and we still emit a valid done chunk.
        if (event.usage) {
          inputTokens = event.usage.prompt_tokens;
          outputTokens = event.usage.completion_tokens;
        }

        // Emit content deltas
        for (const choice of event.choices) {
          const text = choice.delta.content;
          if (text) {
            onChunk({
              modelId,
              content: text,
              isDone: false,
            });
          }
        }
      }
    } catch (streamErr) {
      // AbortError — user triggered stop mid-stream.
      // Emit a clean done chunk with whatever tokens were counted so far,
      // then re-throw so runProviderIsolated can identify and swallow it.
      if (streamErr instanceof Error && streamErr.name === 'AbortError') {
        onChunk({
          modelId,
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
      emitErrorChunk(modelId, error, onChunk);
      return {};
    }

    // Emit final done chunk with token usage
    const tokenUsage: TokenUsage = {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    };

    onChunk({
      modelId,
      content: '',
      isDone: true,
      tokenUsage,
    });

    return { tokenUsage };
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Construct a GenericOpenAIProvider from a CustomProviderConfig.
 * Used by sendMessage.ts dispatch (ticket #95) when building the active
 * provider list from the user's ProviderRoster.
 */
export function createCustomProvider(config: CustomProviderConfig): GenericOpenAIProvider {
  return new GenericOpenAIProvider(config);
}
