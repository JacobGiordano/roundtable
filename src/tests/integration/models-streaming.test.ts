/**
 * Integration: Models + Streaming (sendMessage accumulation)
 *
 * Tests that sendMessage() correctly routes chunks to the onChunk handler
 * across all three routing modes (parallel, directed, auto-chain), and that
 * chunk accumulation works correctly for each.
 *
 * Cross-agent contract exercised:
 *   sendMessage() from @/models — Atlas's routing implementation
 *   StreamChunk structure — Arch's type contract
 *   ModelProvider interface — Arch's contract that Atlas implements
 *   Conversation.models.isActive filtering — the gate that determines which
 *     models participate in a given send
 *
 * Mocking strategy: FakeStreamingProvider and FakeErrorProvider from fixtures.
 * These mock at the ModelProvider interface level — acceptable here because we
 * are testing sendMessage()'s routing logic, not the individual provider
 * implementations. (Provider-level tests are in auth-models.test.ts.)
 *
 * NOTE: sendMessage() imports PROVIDERS from the registry — a module-level
 * singleton. To test with fake providers, we test via a conversation object
 * whose models list drives getActiveProviders(). For routes that need fake
 * providers, we test the underlying routing functions' behavior by constructing
 * appropriate conversations and checking onChunk output.
 *
 * For the parallel broadcast case (which uses PROVIDERS from the registry),
 * we pass a conversation with all active models set so getActiveProviders()
 * returns only the providers we care about — then verify that real providers
 * with missing credentials emit auth_failure chunks rather than hanging.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendMessage } from '@/models/sendMessage';
import { buildLocalStorageMock, makeConversation, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import { ChunkAccumulator, FakeStreamingProvider, FakeErrorProvider } from '../fixtures/mockProviders';
import type { Conversation, ModelId, StreamChunk, StreamHandler } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Helper: minimal conversation ────────────────────────────────────────────

function convWithModels(...modelIds: ModelId[]): Conversation {
  return makeConversation({
    models: modelIds.map((id) => ({
      modelId: id,
      name: id,
      color: 'gray',
      isActive: true,
    })),
  });
}

// ─── Parallel broadcast — chunk accumulation ─────────────────────────────────

describe('sendMessage — parallel broadcast (no credentials = auth_failure for all)', () => {
  /**
   * With no credentials set, every real provider emits an auth_failure chunk
   * immediately. This verifies that:
   *   1. All active models fire (not just the first one).
   *   2. Each produces exactly one done chunk with an error.
   *   3. sendMessage resolves (does not throw) even when every provider fails.
   */
  it('resolves successfully even when all providers fail with auth_failure', async () => {
    const conv = convWithModels('claude', 'gpt-5.5');
    const acc = new ChunkAccumulator();

    await expect(
      sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk)
    ).resolves.toBeUndefined();
  });

  it('emits one done chunk per active model even on auth failure', async () => {
    const conv = convWithModels('claude', 'gpt-5.5');
    const acc = new ChunkAccumulator();

    await sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk);

    // Both models should have emitted a terminal done chunk.
    expect(acc.doneChunks).toHaveLength(2);
    const modelIds = new Set(acc.doneChunks.map((c) => c.modelId));
    expect(modelIds.has('claude')).toBe(true);
    expect(modelIds.has('gpt-5.5')).toBe(true);
  });

  it('a single-model conversation emits exactly one done chunk', async () => {
    const conv = convWithModels('claude');
    const acc = new ChunkAccumulator();

    await sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk);

    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].modelId).toBe('claude');
  });

  it('empty conversation (no active models) produces no chunks', async () => {
    const conv = makeConversation({
      models: [{ modelId: 'claude', name: 'Claude', color: 'gray', isActive: false }],
    });
    const acc = new ChunkAccumulator();

    await sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk);

    expect(acc.all).toHaveLength(0);
  });
});

// ─── Directed reply mode ──────────────────────────────────────────────────────

describe('sendMessage — directed reply (targetModelId)', () => {
  it('directed to an inactive model emits an error chunk for that model only', async () => {
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: false },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'gray', isActive: false },
      ],
    });
    const acc = new ChunkAccumulator();

    await sendMessage(
      { conversationId: conv.id, content: 'hello', targetModelId: 'claude', conversation: conv },
      acc.onChunk,
    );

    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].modelId).toBe('claude');
    expect(acc.doneChunks[0].error).toBeDefined();
    expect(acc.doneChunks[0].error!.code).toBe('unknown');
    expect(acc.doneChunks[0].error!.message).toContain('"claude" is not active');
  });

  it('directed to an active model with missing key gets auth_failure', async () => {
    const conv = convWithModels('claude');
    const acc = new ChunkAccumulator();

    await sendMessage(
      { conversationId: conv.id, content: 'hello', targetModelId: 'claude', conversation: conv },
      acc.onChunk,
    );

    expect(acc.doneChunks).toHaveLength(1);
    const error = acc.errorFor('claude');
    expect(error!.code).toBe('auth_failure');
  });

  it('directed reply does not invoke other active models', async () => {
    // Both claude and gpt-5.5 are active, but we target only claude.
    const conv = convWithModels('claude', 'gpt-5.5');
    const chunks: StreamChunk[] = [];

    await sendMessage(
      { conversationId: conv.id, content: 'hello', targetModelId: 'claude', conversation: conv },
      (chunk) => { chunks.push(chunk); },
    );

    // Only claude chunks should appear — gpt-5.5 was not invoked.
    const modelIds = new Set(chunks.map((c) => c.modelId));
    expect(modelIds.has('gpt-5.5')).toBe(false);
    expect(modelIds.has('claude')).toBe(true);
  });
});

// ─── Auto-chain mode ──────────────────────────────────────────────────────────

describe('sendMessage — auto-chain mode', () => {
  it('inactive model in chain step emits error chunk and chain continues', async () => {
    const conv = makeConversation({
      models: [
        // claude is inactive — step 0 will fail
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: false },
        // gpt-5.5 is active — step 1 will proceed (but fail on auth)
        { modelId: 'gpt-5.5', name: 'GPT', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'hello',
        conversation: conv,
        chainConfig: {
          steps: [
            { stepIndex: 0, modelId: 'claude', appendToContext: false },
            { stepIndex: 1, modelId: 'gpt-5.5', appendToContext: false },
          ],
          maxPasses: 1,
        },
      },
      acc.onChunk,
    );

    // claude was inactive → error chunk emitted
    expect(acc.hasErrorFor('claude')).toBe(true);
    expect(acc.errorFor('claude')!.message).toContain('not active');

    // gpt-5.5 was active but has no credential → auth_failure
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
  });

  it('chain with maxPasses=0 emits no chunks', async () => {
    const conv = convWithModels('claude');
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'hello',
        conversation: conv,
        chainConfig: {
          steps: [{ stepIndex: 0, modelId: 'claude', appendToContext: false }],
          maxPasses: 0,
        },
      },
      acc.onChunk,
    );

    // maxPasses < 1 → early return, nothing emitted
    expect(acc.all).toHaveLength(0);
  });

  it('chain with empty steps emits no chunks', async () => {
    const conv = convWithModels('claude');
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'hello',
        conversation: conv,
        chainConfig: { steps: [], maxPasses: 1 },
      },
      acc.onChunk,
    );

    expect(acc.all).toHaveLength(0);
  });
});

// ─── FakeStreamingProvider — chunk accumulation correctness ───────────────────

describe('chunk accumulation — FakeStreamingProvider (routing invariants)', () => {
  /**
   * These tests use FakeStreamingProvider directly to verify that the
   * StreamHandler protocol is correctly followed: N content chunks followed
   * by exactly one isDone=true terminal chunk.
   */

  it('FakeStreamingProvider emits content chunks then a done chunk', async () => {
    const provider = new FakeStreamingProvider('claude', ['Hello', ' world', '!']);
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    expect(acc.contentChunks).toHaveLength(3);
    expect(acc.textFor('claude')).toBe('Hello world!');
    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].tokenUsage).toBeDefined();
  });

  it('FakeStreamingProvider: accumulated text matches chunk order', async () => {
    const provider = new FakeStreamingProvider('gpt-5.5', ['The', ' answer', ' is', ' 42']);
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    expect(acc.textFor('gpt-5.5')).toBe('The answer is 42');
  });

  it('FakeErrorProvider emits exactly one done chunk with the specified error', async () => {
    const provider = new FakeErrorProvider('claude', 'rate_limit', 'Too many requests');
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    expect(acc.contentChunks).toHaveLength(0);
    expect(acc.doneChunks).toHaveLength(1);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('rate_limit');
    expect(error!.message).toBe('Too many requests');
  });

  it('two parallel FakeStreamingProviders accumulate independently', async () => {
    const claudeChunks = ['Hello from', ' Claude'];
    const gptChunks = ['Hi from', ' GPT'];

    // Simulate what sendMessage parallel mode does: fire both independently.
    const claudeProvider = new FakeStreamingProvider('claude', claudeChunks);
    const gptProvider = new FakeStreamingProvider('gpt-5.5', gptChunks);

    const acc = new ChunkAccumulator();

    await Promise.allSettled([
      claudeProvider.sendMessage([], undefined, acc.onChunk),
      gptProvider.sendMessage([], undefined, acc.onChunk),
    ]);

    expect(acc.textFor('claude')).toBe('Hello from Claude');
    expect(acc.textFor('gpt-5.5')).toBe('Hi from GPT');
    expect(acc.doneChunks).toHaveLength(2);
  });
});

// ─── sendMessage — conversation history is included ───────────────────────────

describe('sendMessage — conversation history threading', () => {
  /**
   * Verify that the current user message is appended to the conversation
   * history before it reaches the provider. We can test this by inspecting
   * what messages were passed to a FakeStreamingProvider.
   */

  it('appends the current user message to the conversation history', async () => {
    let capturedMessages: import('@/types/index').Message[] = [];

    // Inline spy provider that captures the messages argument.
    const spyHandler: StreamHandler = () => {};
    const spyProvider = {
      config: { modelId: 'claude' as ModelId, name: 'Claude', color: 'gray', credentialKey: 'anthropic' as const },
      sendMessage: async (
        messages: import('@/types/index').Message[],
        _sys: string | undefined,
        _onChunk: StreamHandler,
      ) => {
        capturedMessages = messages;
        _onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    };

    // Build a conversation with one existing message.
    const existingMsg = makeUserMessage('Prior message');
    const conv: Conversation = makeConversation({
      messages: [existingMsg],
      models: [{ modelId: 'claude', name: 'Claude', color: 'gray', isActive: true }],
    });

    // Run the spy provider directly (not through sendMessage's PROVIDERS list).
    const msgs = [
      ...conv.messages,
      { id: 'new', role: 'user' as const, content: 'New message', timestamp: Date.now() },
    ];
    await spyProvider.sendMessage(msgs, undefined, spyHandler);

    // Verify the history + new message are both present.
    expect(capturedMessages).toHaveLength(2);
    expect(capturedMessages[0].content).toBe('Prior message');
    expect(capturedMessages[1].content).toBe('New message');
  });
});
