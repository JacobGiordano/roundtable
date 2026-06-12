/**
 * Integration tests for getSessionTokenUsage() — issue #85
 *
 * getSessionTokenUsage is a pure utility exported from @/models that computes
 * per-model token totals from a Conversation's message array. These tests
 * exercise the four edge-case paths identified in #85:
 *
 *   1. Empty messages array → returns []
 *   2. Messages with no tokenUsage are skipped without throwing
 *   3. Messages with no modelId are skipped without throwing
 *   4. Two messages from the same model → totals are accumulated, not overwritten
 *
 * This is an integration-level test because it exercises the public contract
 * between Atlas's models layer and any consumer (Aria, Vault) that calls
 * getSessionTokenUsage() to display or record session-level usage.
 */

import { describe, it, expect } from 'vitest';
import { getSessionTokenUsage } from '@/models';
import type { Conversation, Message, ModelConfig } from '@/types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

/** Minimal valid Conversation shell — tests mutate .messages as needed. */
function makeConversation(messages: Message[]): Conversation {
  return {
    id: 'test-conv-1',
    messages,
    models: [] as ModelConfig[],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1000,
    updatedAt: 1000,
  };
}

/** User message — no modelId, no tokenUsage by design. */
function userMessage(id: string): Message {
  return {
    id,
    role: 'user',
    content: 'hello',
    timestamp: 1000,
  };
}

/** Assistant message with a full tokenUsage payload. */
function assistantMessage(
  id: string,
  modelId: 'claude' | 'gpt-5.5' | 'gemini',
  inputTokens: number,
  outputTokens: number,
): Message {
  return {
    id,
    role: 'assistant',
    content: 'response',
    modelId,
    timestamp: 1001,
    tokenUsage: {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
    },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('getSessionTokenUsage — edge cases (#85)', () => {
  it('returns an empty array when the conversation has no messages', () => {
    const conversation = makeConversation([]);

    const result = getSessionTokenUsage(conversation);

    expect(result).toEqual([]);
  });

  it('skips messages that have no tokenUsage without throwing', () => {
    // A user message never carries tokenUsage; an assistant message in-flight
    // may also lack it if the stream has not yet completed.
    const messages: Message[] = [
      userMessage('u1'),
      {
        id: 'a1',
        role: 'assistant',
        content: 'streaming…',
        modelId: 'claude',
        timestamp: 1001,
        // tokenUsage intentionally absent
      },
    ];
    const conversation = makeConversation(messages);

    // Must not throw; the incomplete assistant message is silently skipped.
    expect(() => getSessionTokenUsage(conversation)).not.toThrow();

    const result = getSessionTokenUsage(conversation);
    expect(result).toEqual([]);
  });

  it('skips messages that have no modelId without throwing', () => {
    // A user message has tokenUsage only in unusual edge cases (e.g. a message
    // object constructed by a future feature). This guard ensures modelId-less
    // entries never cause a map-key insertion with undefined.
    const messages: Message[] = [
      {
        id: 'u1',
        role: 'user',
        content: 'hello',
        timestamp: 1000,
        // tokenUsage present but no modelId
        tokenUsage: { inputTokens: 5, outputTokens: 0, totalTokens: 5 },
      },
    ];
    const conversation = makeConversation(messages);

    expect(() => getSessionTokenUsage(conversation)).not.toThrow();

    const result = getSessionTokenUsage(conversation);
    expect(result).toEqual([]);
  });

  it('accumulates totals across two messages from the same model', () => {
    // Two completed Claude responses in the same conversation. The second
    // response must add to the first's totals, not replace them.
    const messages: Message[] = [
      userMessage('u1'),
      assistantMessage('a1', 'claude', 100, 200),
      userMessage('u2'),
      assistantMessage('a2', 'claude', 50, 75),
    ];
    const conversation = makeConversation(messages);

    const result = getSessionTokenUsage(conversation);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      modelId: 'claude',
      inputTokens: 150,   // 100 + 50
      outputTokens: 275,  // 200 + 75
      totalTokens: 425,   // 300 + 125
    });
  });

  it('accumulates totals independently for each model when multiple models are present', () => {
    // Bonus coverage: ensures the Map keying is per-modelId and different
    // models do not bleed into each other's totals.
    const messages: Message[] = [
      userMessage('u1'),
      assistantMessage('a1', 'claude', 100, 200),
      assistantMessage('a2', 'gpt-5.5', 60, 120),
      userMessage('u2'),
      assistantMessage('a3', 'claude', 50, 80),
    ];
    const conversation = makeConversation(messages);

    const result = getSessionTokenUsage(conversation);

    expect(result).toHaveLength(2);

    const claudeUsage = result.find(r => r.modelId === 'claude');
    const gptUsage = result.find(r => r.modelId === 'gpt-5.5');

    expect(claudeUsage).toEqual({
      modelId: 'claude',
      inputTokens: 150,
      outputTokens: 280,
      totalTokens: 430,
    });
    expect(gptUsage).toEqual({
      modelId: 'gpt-5.5',
      inputTokens: 60,
      outputTokens: 120,
      totalTokens: 180,
    });
  });
});
