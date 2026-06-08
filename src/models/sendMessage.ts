/**
 * Atlas — sendMessage.ts
 *
 * Top-level SendMessageFn implementation. Fans out to all active ModelProviders
 * in parallel and streams each model's response via onChunk.
 *
 * Parallel broadcast guarantees (issue #7):
 *   - All active providers fire simultaneously (no sequencing)
 *   - Each provider's stream is fully independent — one failure never
 *     cancels or delays another provider's stream
 *   - If a provider throws unexpectedly (outside its own error handling),
 *     a synthetic error StreamChunk is emitted and the broadcast continues
 *   - Resolves only when every provider has completed (success or error)
 *
 * Aria calls this function; it is the primary public surface of /src/models.
 */

import type {
  SendMessageOptions,
  StreamHandler,
  StreamChunk,
  Conversation,
  ModelId,
} from '@/types';
import { claudeProvider } from './claude';
import { gpt55Provider } from './gpt';

// Registry of all active providers — extend when new providers are added.
const PROVIDERS = [claudeProvider, gpt55Provider];

/**
 * Given a conversation, return providers whose modelId is active in the
 * conversation's model list.
 */
function getActiveProviders(conversation: Conversation) {
  const activeIds = new Set(
    conversation.models.filter((m) => m.isActive).map((m) => m.modelId)
  );
  return PROVIDERS.filter((p) => activeIds.has(p.config.modelId));
}

/**
 * Runs a single provider's sendMessage call in isolation.
 *
 * If the provider throws at any point (unexpected exception beyond its own
 * internal error handling), this function catches the error and emits a
 * synthetic isDone=true StreamChunk with an error payload so the UI always
 * receives a terminal event for every model, regardless of failure mode.
 *
 * Never rejects — always resolves — so Promise.allSettled (and callers) are
 * guaranteed to see every provider reach completion.
 */
async function runProviderIsolated(
  provider: (typeof PROVIDERS)[number],
  messages: Parameters<(typeof PROVIDERS)[number]['sendMessage']>[0],
  systemPrompt: string | undefined,
  onChunk: StreamHandler
): Promise<void> {
  try {
    await provider.sendMessage(messages, systemPrompt, onChunk);
  } catch (err) {
    // Unexpected throw from a provider (shouldn't happen given the providers'
    // own try/catch, but we guard here for robustness).
    const errorChunk: StreamChunk = {
      modelId: provider.config.modelId as ModelId,
      content: '',
      isDone: true,
      error: {
        code: 'unknown',
        message:
          err instanceof Error
            ? err.message
            : `Unexpected error from ${provider.config.name}`,
      },
    };
    onChunk(errorChunk);
  }
}

/**
 * SendMessageFn — fans out to all active providers in parallel.
 *
 * Each provider streams incremental chunks back via onChunk independently.
 * One model's failure (including unexpected throws) never blocks or cancels
 * the other models' streams. Resolves when all providers have completed.
 *
 * Usage by Aria:
 *   import { sendMessage } from '@/models';
 *   await sendMessage({ conversationId, content }, onChunk);
 *
 * Note: This overload accepts an optional conversation parameter so callers
 * can scope active providers to a specific conversation. If omitted, all
 * registered providers are used.
 */
export async function sendMessage(
  options: SendMessageOptions & { conversation?: Conversation; systemPrompt?: string },
  onChunk: StreamHandler
): Promise<void> {
  const { conversation, systemPrompt, content } = options;

  const providers = conversation ? getActiveProviders(conversation) : PROVIDERS;

  if (providers.length === 0) return;

  // Build message history from the conversation, if provided.
  // The current user message is appended at the end.
  const history = conversation?.messages ?? [];
  const messages = [
    ...history,
    {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content,
      timestamp: Date.now(),
    },
  ];

  // Fire all providers in parallel. Promise.allSettled ensures every provider
  // runs to completion regardless of whether siblings succeed or fail.
  // runProviderIsolated never rejects, so allSettled is defensive redundancy.
  await Promise.allSettled(
    providers.map((provider) =>
      runProviderIsolated(provider, messages, systemPrompt, onChunk)
    )
  );
}

/**
 * Utility: sum token usage across all messages in a session.
 * Exported here (not from /src/ui) per the cross-agent exception rule in CLAUDE.md:
 * "Pure utility functions exported from /src/models/index.ts may be imported by Aria."
 */
export function getSessionTokenUsage(conversation: Conversation) {
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  for (const msg of conversation.messages) {
    if (msg.tokenUsage) {
      inputTokens += msg.tokenUsage.inputTokens;
      outputTokens += msg.tokenUsage.outputTokens;
      totalTokens += msg.tokenUsage.totalTokens;
    }
  }
  return { inputTokens, outputTokens, totalTokens };
}
