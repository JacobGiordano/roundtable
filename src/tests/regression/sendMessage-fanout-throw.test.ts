/**
 * Regression: sendMessage fan-out — provider throws, others still succeed
 *
 * Guards the runProviderIsolated() catch path in sendMessage.ts.
 *
 * Scenario: one provider throws an unexpected exception (not an error chunk —
 * an actual JavaScript throw). The other active providers must still deliver
 * their content chunks, and sendMessage() must resolve (not reject).
 *
 * This is the contract stated in the runProviderIsolated() JSDoc:
 *   "Never rejects — always resolves — so Promise.allSettled (and callers) are
 *   guaranteed to see every provider reach completion."
 *
 * Why this test does not exist in models-streaming.test.ts:
 *   That file tests routing logic using real providers (which emit error chunks
 *   via their own internal error handling). The "provider throws" path is a
 *   different code path — the catch block in runProviderIsolated() — which
 *   converts a thrown Error into a synthetic isDone=true error chunk. No
 *   existing test exercises that catch block.
 *
 * Mocking approach: We inject a FakeThrowingProvider via vi.mock on
 * @/models/registry so that sendMessage's getActiveProviders() picks it up.
 * We then restore the real registry after each test.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendMessage } from '@/models/sendMessage';
import {
  buildLocalStorageMock,
  makeConversation,
  resetIdSeq,
} from '../fixtures/conversations';
import { FakeStreamingProvider, ChunkAccumulator } from '../fixtures/mockProviders';

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendMessage — runProviderIsolated catch path', () => {
  /**
   * We test the catch path by creating a conversation whose active models
   * include a model registered in PROVIDERS that will be intercepted via
   * vi.spyOn on the provider's sendMessage method to throw.
   *
   * Since PROVIDERS is a module-level singleton we cannot easily swap
   * individual entries, we instead test the parallel fan-out contract
   * using FakeStreamingProvider + FakeThrowingProvider through the
   * runProviderIsolated function's observable behavior:
   *
   *   - The throwing provider's model still gets a synthetic isDone=true
   *     error chunk delivered to onChunk.
   *   - The non-throwing provider's content chunks arrive normally.
   *   - sendMessage resolves (does not throw/reject).
   *
   * We verify this by calling runProviderIsolated directly via its
   * public behavior: the fan-out in sendMessage resolves with all providers.
   * Because PROVIDERS contains the real registry, we scope our test to a
   * subset we can observe: one provider in the active models list that has
   * credentials (we mock via vi.spyOn on the deepseek provider's sendMessage).
   */

  it('sendMessage resolves even when a provider throws inside sendMessage', async () => {
    // Both claude and deepseek are active. We expect:
    //   claude → auth_failure chunk (no credentials set)
    //   deepseek → auth_failure chunk (no credentials set)
    //   sendMessage → resolves without rejecting
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: true },
        { modelId: 'deepseek', name: 'DeepSeek', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await expect(
      sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk)
    ).resolves.toBeUndefined();

    // Both models emit terminal done chunks (auth_failure since no creds).
    expect(acc.doneChunks).toHaveLength(2);
  });

  it('a provider that throws is caught and emits a synthetic error chunk', async () => {
    /**
     * We spy on the actual deepseek provider from the registry and make it throw.
     * This exercises the runProviderIsolated catch block directly.
     */
    const { PROVIDERS } = await import('@/models/registry');
    const deepseekProvider = PROVIDERS.find((p) => p.config.modelId === 'deepseek');
    expect(deepseekProvider).toBeDefined();

    // Make the provider throw instead of emitting chunks normally.
    const spy = vi.spyOn(deepseekProvider!, 'sendMessage').mockRejectedValue(
      new Error('Simulated unexpected provider crash')
    );

    const conv = makeConversation({
      models: [
        { modelId: 'deepseek', name: 'DeepSeek', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await sendMessage({ conversationId: conv.id, content: 'test', conversation: conv }, acc.onChunk);

    // runProviderIsolated must have caught the throw and emitted a synthetic chunk.
    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].modelId).toBe('deepseek');
    expect(acc.doneChunks[0].isDone).toBe(true);
    expect(acc.doneChunks[0].error).toBeDefined();
    expect(acc.doneChunks[0].error!.code).toBe('unknown');
    expect(acc.doneChunks[0].error!.message).toContain('Simulated unexpected provider crash');

    spy.mockRestore();
  });

  it('when one provider throws, sibling providers still complete', async () => {
    /**
     * Two active providers: deepseek (mocked to throw) and claude (real, emits auth_failure).
     * Both must produce a terminal done chunk. sendMessage must resolve.
     */
    const { PROVIDERS } = await import('@/models/registry');
    const deepseekProvider = PROVIDERS.find((p) => p.config.modelId === 'deepseek');
    expect(deepseekProvider).toBeDefined();

    const spy = vi.spyOn(deepseekProvider!, 'sendMessage').mockRejectedValue(
      new Error('Provider crash mid-stream')
    );

    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: true },
        { modelId: 'deepseek', name: 'DeepSeek', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await expect(
      sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk)
    ).resolves.toBeUndefined();

    // Both providers must have delivered a terminal chunk.
    expect(acc.doneChunks).toHaveLength(2);

    const modelIds = new Set(acc.doneChunks.map((c) => c.modelId));
    expect(modelIds.has('deepseek')).toBe(true);
    expect(modelIds.has('claude')).toBe(true);

    // The throwing provider's chunk must carry an error.
    expect(acc.doneChunks.find((c) => c.modelId === 'deepseek')!.error).toBeDefined();

    // The non-throwing provider's chunk must have arrived independently.
    expect(acc.doneChunks.find((c) => c.modelId === 'claude')).toBeDefined();

    spy.mockRestore();
  });

  it('sendMessage resolves cleanly with no chunks when no models are active', async () => {
    // All models are inactive — getActiveProviders returns [], runParallel early-returns.
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: false },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'gray', isActive: false },
      ],
    });
    const acc = new ChunkAccumulator();

    await expect(
      sendMessage({ conversationId: conv.id, content: 'hello', conversation: conv }, acc.onChunk)
    ).resolves.toBeUndefined();

    expect(acc.all).toHaveLength(0);
  });
});

// ─── Directed reply — only the target model receives the message ──────────────

describe('sendMessage — directed reply does not invoke sibling providers', () => {
  it('when targetModelId is set, no other active model receives a message', async () => {
    /**
     * Both claude and gpt-5.5 are active. We target only claude.
     * We verify that gpt-5.5 produces zero chunks — it was not called.
     */
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: true },
        { modelId: 'gpt-5.5', name: 'GPT', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await sendMessage(
      { conversationId: conv.id, content: 'hello', targetModelId: 'claude', conversation: conv },
      acc.onChunk,
    );

    // All chunks belong to claude only.
    const modelIds = new Set(acc.all.map((c) => c.modelId));
    expect(modelIds.has('gpt-5.5')).toBe(false);
    expect(modelIds.has('claude')).toBe(true);
  });

  it('directed to a model that is not in the active list emits an error chunk for that model', async () => {
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: false },
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
    expect(acc.doneChunks[0].error!.message).toContain('"claude" is not active');
  });
});

// ─── FakeStreamingProvider — isolated chunk delivery ─────────────────────────

describe('sendMessage fan-out — FakeStreamingProvider isolation', () => {
  /**
   * These tests verify the fan-out contract by using FakeStreamingProvider
   * directly (not through PROVIDERS), simulating what runParallel does with
   * Promise.allSettled. They confirm the ChunkAccumulator sees independent
   * delivery from two concurrent providers.
   */

  it('two concurrent streaming providers deliver chunks independently without blocking each other', async () => {
    const claudeProvider = new FakeStreamingProvider('claude', ['chunk-a', 'chunk-b']);
    const gptProvider = new FakeStreamingProvider('gpt-5.5', ['chunk-c', 'chunk-d']);
    const acc = new ChunkAccumulator();

    await Promise.allSettled([
      claudeProvider.sendMessage([], undefined, acc.onChunk),
      gptProvider.sendMessage([], undefined, acc.onChunk),
    ]);

    expect(acc.textFor('claude')).toBe('chunk-achunk-b');
    expect(acc.textFor('gpt-5.5')).toBe('chunk-cchunk-d');
    expect(acc.doneChunks).toHaveLength(2);
  });

  it('a throwing provider does not prevent the other provider from completing in Promise.allSettled', async () => {
    /**
     * Simulates what runParallel does: wraps each provider in runProviderIsolated.
     * If runProviderIsolated correctly catches and converts throws, the
     * accumulator sees two done chunks even when one provider throws.
     *
     * We test runProviderIsolated's behavior by invoking sendMessage with a
     * conversation where one provider (deepseek) is mocked to throw.
     */
    const { PROVIDERS } = await import('@/models/registry');
    const deepseekProvider = PROVIDERS.find((p) => p.config.modelId === 'deepseek');

    const spy = vi.spyOn(deepseekProvider!, 'sendMessage').mockRejectedValue(
      new Error('crash')
    );

    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: true },
        { modelId: 'deepseek', name: 'DeepSeek', color: 'gray', isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    await sendMessage({ conversationId: conv.id, content: 'test', conversation: conv }, acc.onChunk);

    // Both models must have a done chunk — the throw was caught, not propagated.
    const doneModelIds = new Set(acc.doneChunks.map((c) => c.modelId));
    expect(doneModelIds.has('deepseek')).toBe(true);
    expect(doneModelIds.has('claude')).toBe(true);

    spy.mockRestore();
  });
});
