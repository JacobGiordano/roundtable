/**
 * Atlas — attribution.ts
 *
 * Wire-format transforms for model attribution in multi-model conversations.
 * These are pure functions — they never mutate their inputs and produce
 * values used only at dispatch time (never persisted to storage).
 *
 * Two options are implemented:
 *
 * Option B — buildAttributedMessages
 *   Transforms a raw message array into a per-provider-safe message array.
 *   Other models' assistant messages are re-cast as user-role messages with
 *   "[ModelName responded: ...]" framing so each provider clearly distinguishes
 *   its own prior responses from other participants' responses.
 *
 * Option C — buildAttributionSystemPrompt
 *   Prepends a framing block to the model's effective system prompt that tells
 *   the provider its name, who the other participants are, and how to interpret
 *   the "[ModelName responded: ...]" pattern in the history.
 */

import type { Message, ModelConfig, ModelId } from '@/types';

/**
 * Build a per-provider message array from the stored conversation history.
 *
 * Transform rules applied in order:
 *   1. Skip messages where isStreaming === true — not yet settled; including
 *      them would send partial content to the provider.
 *   2. Skip error sentinel messages (error field set AND content === 'Error') —
 *      these are UI-only markers synthesized by the error path and must never
 *      be transmitted to a provider.
 *   3. User messages pass through unchanged.
 *   4. Assistant messages whose modelId matches thisModelId pass through
 *      unchanged — the provider sees its own prior responses as assistant turns.
 *   5. Assistant messages from any other model (or with no modelId) are
 *      re-cast as user-role messages:
 *        { role: 'user', content: '[Name responded: {original content}]' }
 *      Name is resolved from conversationModels by modelId; falls back to
 *      'Another model' when modelId is absent or not found in the roster.
 *
 * The returned array is composed of new Message objects — stored messages
 * are never mutated. Object spread is used so all other fields (id, timestamp,
 * tokenUsage, etc.) are preserved on re-attributed messages.
 *
 * Consecutive other-model messages will produce consecutive role:'user' turns
 * in the wire format. Modern providers handle non-alternating sequences
 * correctly; this is noted in the issue spec as an acceptable edge case.
 *
 * @param messages            Raw messages from conversation.messages
 * @param thisModelId         The modelId of the provider this array is built for
 * @param conversationModels  Models array from conversation.models — used to
 *                            look up attribution display names
 */
export function buildAttributedMessages(
  messages: Message[],
  thisModelId: ModelId,
  conversationModels?: ModelConfig[]
): Message[] {
  return messages
    .filter((msg) => {
      // Skip in-flight streaming messages — partial content must never be sent
      if (msg.isStreaming === true) return false;
      // Skip error sentinel: assistant messages where error is set and content is
      // empty or whitespace-only are synthesized UI markers that must never be
      // transmitted to a provider. Uses the same predicate as filterMessagesForApi
      // in openai-sse.ts so both filter paths behave identically.
      // Prior predicate (msg.content === 'Error') was wrong in two directions:
      //   - Did not strip content:'' error messages (the actual pattern from emitErrorChunk)
      //   - Stripped content:'Error' messages which have real (if odd) content
      if (msg.error && !msg.content.trim()) return false;
      return true;
    })
    .map((msg) => {
      // User messages are not attributed — pass through unchanged
      if (msg.role === 'user') return msg;

      // This model's own assistant messages are its own — pass through as-is
      if (msg.modelId === thisModelId) return msg;

      // Another model's assistant message (or absent modelId):
      // Re-cast as a user-role message with attribution framing.
      // The provider will see its own prior responses as assistant turns and
      // all other participants' responses as attributed user-role turns.
      const attributionName = msg.modelId
        ? (conversationModels?.find((m) => m.modelId === msg.modelId)?.name ??
          'Another model')
        : 'Another model';

      return {
        ...msg,
        role: 'user' as const,
        content: `[${attributionName} responded: ${msg.content}]`,
      };
    });
}

/**
 * Build the effective system prompt for a model in a multi-model conversation.
 *
 * When otherActiveModels is non-empty (multi-model session), prepends a framing
 * block that explains to the provider:
 *   - Its own name within the conversation
 *   - Who the other active participants are
 *   - That "[ModelName responded: ...]" messages in the history are from others,
 *     not from the provider itself
 *
 * When otherActiveModels is empty (single-model session), the framing is skipped
 * entirely — there are no other participants to describe, and the framing would
 * be confusing noise.
 *
 * When a base system prompt is present, the framing is prepended with a blank
 * line separator so both sections remain clearly readable.
 *
 * When no base system prompt is present and framing is needed, the framing
 * becomes the entire system prompt for that call.
 *
 * @param baseSystemPrompt    The model's configured system prompt (may be undefined)
 * @param thisModel           The ModelConfig entry for the model being dispatched
 * @param otherActiveModels   All other currently active models in the conversation
 *                            (must exclude thisModel)
 */
export function buildAttributionSystemPrompt(
  baseSystemPrompt: string | undefined,
  thisModel: ModelConfig,
  otherActiveModels: ModelConfig[]
): string | undefined {
  // Single-model session: no other participants — skip framing entirely
  if (otherActiveModels.length === 0) return baseSystemPrompt;

  const otherNames = otherActiveModels.map((m) => m.name).join(', ');
  const framing =
    `You are ${thisModel.name}, one of several AI participants in this conversation.\n` +
    `Other participants: ${otherNames}.\n` +
    `In the conversation history, messages formatted as "[ModelName responded: ...]" are responses from those other participants — not from you. Your own prior responses appear as standard assistant messages.`;

  if (!baseSystemPrompt) return framing;
  return `${framing}\n\n${baseSystemPrompt}`;
}
