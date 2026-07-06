/**
 * Regression: dispatch-time priming chunks — issue #349
 *
 * Guards that sendMessage emits a priming non-done chunk ({ content: '', isDone: false })
 * for each active provider at dispatch time — BEFORE the first real content chunk
 * from that provider's stream.
 *
 * Purpose: useStreamingMessages in Aria creates an accumulator entry on any
 * non-done chunk. Emitting a priming chunk at dispatch time lets Aria render a
 * placeholder bubble immediately, before the first byte of real content arrives.
 *
 * Scope: runParallel and runDirected only. runAutoChain is excluded by design —
 * auto-chain steps are sequential and self-paced; placeholder bubbles are a
 * parallel-mode concern.
 *
 * Test strategy:
 *   Spy on real provider instances (claudeProvider, gpt55Provider) and emit
 *   controlled chunks. Capture all onChunk calls in order to verify that the
 *   priming chunk for each model arrives BEFORE any real content from that model.
 *
 * Acceptance criteria (from issue #349):
 *   1. Priming chunks are emitted before runProviderIsolated is called in parallel mode
 *   2. Priming chunks are emitted before runProviderIsolated is called in directed mode
 *   3. No double-priming in parallel mode (exactly one priming chunk per model
 *      before any real content — the error-path priming from emitErrorChunk is a
 *      second non-done chunk, but occurs after dispatch, not before)
 *   4. No regression on the error path — error messages still arrive and are
 *      correctly terminated with a done+error chunk
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendMessage } from '@/models/sendMessage';
import {
  buildLocalStorageMock,
  makeConversation,
  resetIdSeq,
} from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { Conversation, ModelId, StreamChunk } from '@/types/index';
import { claudeProvider } from '@/models/claude';
import { gpt55Provider } from '@/models/gpt';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Returns the index of the first chunk for modelId in the full chunk list. */
function firstChunkIndex(chunks: StreamChunk[], modelId: ModelId): number {
  return chunks.findIndex((c) => c.modelId === modelId);
}

/** Returns the index of the first content chunk (non-empty content, non-done) for modelId. */
function firstContentChunkIndex(chunks: StreamChunk[], modelId: ModelId): number {
  return chunks.findIndex((c) => c.modelId === modelId && !c.isDone && c.content !== '');
}

// ─── Parallel mode: priming chunks arrive before content ─────────────────────

describe('parallel mode — dispatch-time priming chunks (#349)', () => {
  it('emits a priming non-done chunk for each model before real content arrives', async () => {
    const conv = convWithModels('claude', 'gpt-5.5');
    const allChunks: StreamChunk[] = [];

    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'claude', content: 'hello from claude', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    vi.spyOn(gpt55Provider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'gpt-5.5', content: 'hello from gpt', isDone: false });
        onChunk({ modelId: 'gpt-5.5', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      { conversationId: conv.id, content: 'test', conversation: conv },
      (chunk) => { allChunks.push(chunk); },
    );

    // Both models must have at least one priming non-done chunk before real content.
    const claudePrimingIdx = firstChunkIndex(allChunks, 'claude');
    const claudeContentIdx = firstContentChunkIndex(allChunks, 'claude');
    const gptPrimingIdx = firstChunkIndex(allChunks, 'gpt-5.5');
    const gptContentIdx = firstContentChunkIndex(allChunks, 'gpt-5.5');

    // Priming must come before real content for each model.
    expect(claudePrimingIdx).toBeLessThan(claudeContentIdx);
    expect(gptPrimingIdx).toBeLessThan(gptContentIdx);

    // Priming chunks have empty content and isDone: false.
    expect(allChunks[claudePrimingIdx].content).toBe('');
    expect(allChunks[claudePrimingIdx].isDone).toBe(false);
    expect(allChunks[gptPrimingIdx].content).toBe('');
    expect(allChunks[gptPrimingIdx].isDone).toBe(false);
  });

  it('single-model parallel: priming chunk arrives before real content', async () => {
    const conv = convWithModels('claude');
    const allChunks: StreamChunk[] = [];

    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'claude', content: 'response text', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      { conversationId: conv.id, content: 'test', conversation: conv },
      (chunk) => { allChunks.push(chunk); },
    );

    // First claude chunk must be the priming empty chunk.
    const firstClaude = allChunks.find((c) => c.modelId === 'claude');
    expect(firstClaude).toBeDefined();
    expect(firstClaude!.content).toBe('');
    expect(firstClaude!.isDone).toBe(false);

    // Real content must follow.
    const contentChunk = allChunks.find((c) => c.modelId === 'claude' && c.content !== '');
    expect(contentChunk).toBeDefined();
    expect(contentChunk!.content).toBe('response text');
  });

  it('parallel: all priming chunks are emitted before any provider calls complete', async () => {
    // Verify that both priming chunks are emitted BEFORE either provider runs.
    // We check this by asserting the first two chunks in the stream are
    // both priming (empty, non-done) — proving they were emitted at dispatch,
    // before any provider had a chance to emit real content.
    const conv = convWithModels('claude', 'gpt-5.5');
    const allChunks: StreamChunk[] = [];

    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'claude', content: 'claude reply', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    vi.spyOn(gpt55Provider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'gpt-5.5', content: 'gpt reply', isDone: false });
        onChunk({ modelId: 'gpt-5.5', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      { conversationId: conv.id, content: 'test', conversation: conv },
      (chunk) => { allChunks.push(chunk); },
    );

    // The first two chunks must both be priming (empty, non-done) — one per model.
    expect(allChunks.length).toBeGreaterThanOrEqual(2);
    const firstTwo = allChunks.slice(0, 2);
    expect(firstTwo.every((c) => c.content === '' && !c.isDone)).toBe(true);
    const primedModelIds = new Set(firstTwo.map((c) => c.modelId));
    expect(primedModelIds.has('claude')).toBe(true);
    expect(primedModelIds.has('gpt-5.5')).toBe(true);
  });
});

// ─── Directed mode: priming chunk arrives before content ─────────────────────

describe('directed mode — dispatch-time priming chunk (#349)', () => {
  it('emits a priming chunk for the directed model before real content', async () => {
    const conv = convWithModels('claude', 'gpt-5.5');
    const allChunks: StreamChunk[] = [];

    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (_msgs, _sp, onChunk) => {
        onChunk({ modelId: 'claude', content: 'directed reply', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        targetModelId: 'claude',
        conversation: conv,
      },
      (chunk) => { allChunks.push(chunk); },
    );

    // First claude chunk must be priming.
    const firstClaude = allChunks.find((c) => c.modelId === 'claude');
    expect(firstClaude).toBeDefined();
    expect(firstClaude!.content).toBe('');
    expect(firstClaude!.isDone).toBe(false);

    // Real content follows.
    const contentChunk = allChunks.find((c) => c.modelId === 'claude' && c.content !== '');
    expect(contentChunk).toBeDefined();
    expect(contentChunk!.content).toBe('directed reply');
  });

  it('directed to non-existent model emits no dispatch priming — error from emitErrorChunk', async () => {
    // The priming should NOT be emitted for models that are not found.
    // The not-found path uses emitErrorChunk (which has its own priming).
    const conv = makeConversation({
      models: [
        { modelId: 'claude', name: 'Claude', color: 'gray', isActive: false },
      ],
    });
    const allChunks: StreamChunk[] = [];

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        targetModelId: 'claude',
        conversation: conv,
      },
      (chunk) => { allChunks.push(chunk); },
    );

    // emitErrorChunk emits priming + done+error = 2 total chunks, not 3.
    // There must be exactly one non-done priming chunk and one done+error chunk.
    const claudeChunks = allChunks.filter((c) => c.modelId === 'claude');
    const doneChunks = claudeChunks.filter((c) => c.isDone);
    expect(doneChunks).toHaveLength(1);
    expect(doneChunks[0].error).toBeDefined();
    // Non-done priming from emitErrorChunk only (not from dispatch).
    const nonDoneChunks = claudeChunks.filter((c) => !c.isDone);
    expect(nonDoneChunks).toHaveLength(1);
    expect(nonDoneChunks[0].content).toBe('');
  });
});

// ─── Error path: no regression ────────────────────────────────────────────────

describe('no regression on error path — priming chunks still produced (#349)', () => {
  it('parallel mode: auth_failure path produces priming chunk + done+error for each model', async () => {
    // With no credentials, all built-in providers emit auth_failure via emitErrorChunk.
    // After the dispatch-time priming, each model will have:
    //   1. Dispatch-time priming (content:'', isDone:false) — NEW
    //   2. emitErrorChunk priming (content:'', isDone:false) — EXISTING
    //   3. Done+error chunk (isDone:true, error set) — EXISTING
    // Total: 3 chunks per model (2 non-done, 1 done).
    const conv = convWithModels('claude', 'gpt-5.5');
    const acc = new ChunkAccumulator();

    await sendMessage(
      { conversationId: conv.id, content: 'test', conversation: conv },
      acc.onChunk,
    );

    // Both models must have a terminal done+error chunk (error path not regressed).
    expect(acc.hasErrorFor('claude')).toBe(true);
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('claude')!.code).toBe('auth_failure');
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');

    // Each model must have at least one priming non-done chunk (dispatch-time priming).
    const claudeNonDone = acc.all.filter((c) => c.modelId === 'claude' && !c.isDone);
    const gptNonDone = acc.all.filter((c) => c.modelId === 'gpt-5.5' && !c.isDone);
    expect(claudeNonDone.length).toBeGreaterThanOrEqual(1);
    expect(gptNonDone.length).toBeGreaterThanOrEqual(1);
  });

  it('directed mode: auth_failure path still produces priming + done+error', async () => {
    const conv = convWithModels('claude');
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        targetModelId: 'claude',
        conversation: conv,
      },
      acc.onChunk,
    );

    // Error path not regressed.
    expect(acc.hasErrorFor('claude')).toBe(true);
    expect(acc.errorFor('claude')!.code).toBe('auth_failure');

    // Priming chunk present.
    const nonDone = acc.all.filter((c) => c.modelId === 'claude' && !c.isDone);
    expect(nonDone.length).toBeGreaterThanOrEqual(1);
  });
});
