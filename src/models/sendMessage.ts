/**
 * Atlas — sendMessage.ts
 *
 * Top-level SendMessageFn implementation. Fans out to all active ModelProviders
 * in parallel and streams each model's response via onChunk.
 *
 * Aria calls this function; it is the primary public surface of /src/models.
 */

import type { SendMessageOptions, StreamHandler, Conversation } from '@/types';
import { claudeProvider } from './claude';

// Registry of all active providers — extend when new providers are added.
const PROVIDERS = [claudeProvider];

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
 * SendMessageFn — fans out to all active providers in parallel.
 * Each provider streams incremental chunks back via onChunk.
 * Resolves when all providers have completed.
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

  await Promise.all(
    providers.map((provider) =>
      provider.sendMessage(messages, systemPrompt, onChunk)
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
