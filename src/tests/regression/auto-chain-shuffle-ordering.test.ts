/**
 * Regression: auto-chain — shuffleArray non-mutation and deterministic ordering
 *
 * Guards the shuffleArray() and runAutoChain() changes introduced in issue #313
 * (auto-chain non-linear response ordering).
 *
 * Issue #313: runAutoChain now passes shuffleArray(steps) to each pass loop
 * instead of iterating `steps` directly. Each pass produces an independent
 * random ordering of chain steps.
 *
 * What these tests guard:
 *   1. shuffleArray does NOT mutate the original steps array — runAutoChain
 *      must start each pass from the original step order, not a previously-
 *      shuffled one.
 *   2. With a seeded Math.random, shuffleArray produces the expected Fisher-
 *      Yates permutation — confirming the algorithm is correct.
 *   3. With different Math.random values per pass, each pass produces its own
 *      independent ordering — the shuffle is called once per pass, not once
 *      globally.
 *
 * Verification approach:
 *   runAutoChain executes steps sequentially and awaits each one before the
 *   next. With no credentials set in localStorage, every built-in provider
 *   emits an auth_failure done chunk immediately. The order of done chunks
 *   in the ChunkAccumulator therefore mirrors the exact order steps executed
 *   — making chunk ordering a faithful proxy for shuffle behavior without
 *   requiring export of the private shuffleArray function.
 *
 * Fisher-Yates derivation for a 3-element array [A, B, C]:
 *   result = [A, B, C]
 *   i=2: j = floor(r0 * 3), swap result[2] with result[j]
 *   i=1: j = floor(r1 * 2), swap result[1] with result[j]
 *
 *   With r0=0.1, r1=0.1:
 *     i=2: j=0, swap result[2] and result[0] → [C, B, A]
 *     i=1: j=0, swap result[1] and result[0] → [B, C, A]
 *     Permutation: [B, C, A] → step order: gpt-5.5, deepseek, claude
 *
 *   With r0=0.5, r1=0.0:
 *     i=2: j=1, swap result[2] and result[1] → [A, C, B]
 *     i=1: j=0, swap result[1] and result[0] → [C, A, B]
 *     Permutation: [C, A, B] → step order: deepseek, claude, gpt-5.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendMessage } from '@/models/sendMessage';
import {
  buildLocalStorageMock,
  makeConversation,
  resetIdSeq,
} from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { ChainStep } from '@/types/index';

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

// ─── Shared fixture ───────────────────────────────────────────────────────────

/**
 * A 3-model conversation with claude, gpt-5.5, and deepseek all active.
 * All three are built-in providers resolvable from the registry without
 * touching the custom roster or requiring real credentials.
 */
function makeChainConversation() {
  return makeConversation({
    models: [
      { modelId: 'claude', name: 'Claude', color: 'violet', isActive: true },
      { modelId: 'gpt-5.5', name: 'GPT-5.5', color: 'emerald', isActive: true },
      { modelId: 'deepseek', name: 'DeepSeek', color: 'sky', isActive: true },
    ],
  });
}

/**
 * Steps in original order: [claude → gpt-5.5 → deepseek].
 * The Fisher-Yates derivations in the file header assume this ordering.
 */
function makeThreeSteps(): ChainStep[] {
  return [
    { stepIndex: 0, modelId: 'claude', appendToContext: false },
    { stepIndex: 1, modelId: 'gpt-5.5', appendToContext: false },
    { stepIndex: 2, modelId: 'deepseek', appendToContext: false },
  ];
}

// ─── Non-mutation guard ───────────────────────────────────────────────────────

describe('auto-chain (#313) — shuffleArray does not mutate the original steps array', () => {
  it('chainConfig.steps is unchanged in modelId order after a shuffled pass', async () => {
    // Seed Math.random to produce a non-identity permutation so that a mutation
    // bug (shuffle in place) would produce an observably different array.
    // r0=0.1 → j=0 at i=2 (swap first and last), r1=0.1 → j=0 at i=1 (swap first two).
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.1);

    const conv = makeChainConversation();
    const steps = makeThreeSteps();
    const originalOrder = steps.map((s) => s.modelId);
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: { steps, maxPasses: 1 },
      },
      acc.onChunk,
    );

    // The shuffle must have fired (done chunks are not in original order).
    const executedOrder = acc.doneChunks.map((c) => c.modelId);
    expect(executedOrder).toEqual(['gpt-5.5', 'deepseek', 'claude']);

    // The original steps array must be untouched — no mutation.
    expect(steps.map((s) => s.modelId)).toEqual(originalOrder);
    expect(originalOrder).toEqual(['claude', 'gpt-5.5', 'deepseek']);
  });
});

// ─── Deterministic permutation ────────────────────────────────────────────────

describe('auto-chain (#313) — shuffleArray produces expected Fisher-Yates permutation', () => {
  it('with r0=0.1, r1=0.1 the three-step chain executes in order gpt-5.5 → deepseek → claude', async () => {
    // Derivation (see file header):
    //   [claude, gpt-5.5, deepseek]
    //   i=2: j=0, swap [2] and [0] → [deepseek, gpt-5.5, claude]
    //   i=1: j=0, swap [1] and [0] → [gpt-5.5, deepseek, claude]
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.1);

    const conv = makeChainConversation();
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: { steps: makeThreeSteps(), maxPasses: 1 },
      },
      acc.onChunk,
    );

    // Exactly 3 done chunks — one per step.
    expect(acc.doneChunks).toHaveLength(3);

    // Step execution order must match the predicted permutation.
    const executedOrder = acc.doneChunks.map((c) => c.modelId);
    expect(executedOrder).toEqual(['gpt-5.5', 'deepseek', 'claude']);

    // Every step must have produced an error (auth_failure — no credentials set).
    for (const chunk of acc.doneChunks) {
      expect(chunk.error).toBeDefined();
    }
  });

  it('with r0=0.5, r1=0.0 the three-step chain executes in order deepseek → claude → gpt-5.5', async () => {
    // Derivation (see file header):
    //   [claude, gpt-5.5, deepseek]
    //   i=2: j=1, swap [2] and [1] → [claude, deepseek, gpt-5.5]
    //   i=1: j=0, swap [1] and [0] → [deepseek, claude, gpt-5.5]
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.0);

    const conv = makeChainConversation();
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: { steps: makeThreeSteps(), maxPasses: 1 },
      },
      acc.onChunk,
    );

    expect(acc.doneChunks).toHaveLength(3);
    const executedOrder = acc.doneChunks.map((c) => c.modelId);
    expect(executedOrder).toEqual(['deepseek', 'claude', 'gpt-5.5']);
  });
});

// ─── Independent shuffle per pass ─────────────────────────────────────────────

describe('auto-chain (#313) — each pass receives an independent shuffle', () => {
  it('two passes with different Math.random seeds produce different step orderings', async () => {
    // Math.random is consumed left-to-right as runAutoChain iterates passes.
    // Pass 1 consumes r0=0.1, r1=0.1 → order: gpt-5.5, deepseek, claude
    // Pass 2 consumes r0=0.5, r1=0.0 → order: deepseek, claude, gpt-5.5
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.1)  // pass 1, i=2
      .mockReturnValueOnce(0.1)  // pass 1, i=1
      .mockReturnValueOnce(0.5)  // pass 2, i=2
      .mockReturnValueOnce(0.0); // pass 2, i=1

    const conv = makeChainConversation();
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: { steps: makeThreeSteps(), maxPasses: 2 },
      },
      acc.onChunk,
    );

    // 3 models × 2 passes = 6 done chunks total.
    expect(acc.doneChunks).toHaveLength(6);

    const pass1Order = acc.doneChunks.slice(0, 3).map((c) => c.modelId);
    const pass2Order = acc.doneChunks.slice(3, 6).map((c) => c.modelId);

    // Pass 1: gpt-5.5 → deepseek → claude
    expect(pass1Order).toEqual(['gpt-5.5', 'deepseek', 'claude']);

    // Pass 2: deepseek → claude → gpt-5.5
    expect(pass2Order).toEqual(['deepseek', 'claude', 'gpt-5.5']);

    // The two passes must differ — proving the shuffle is not applied once globally.
    expect(pass1Order).not.toEqual(pass2Order);
  });

  it('with a single-step chain, both passes target the same model (degenerate shuffle)', async () => {
    // A single-step chain has nothing to shuffle — shuffleArray([step]) always
    // returns [step] regardless of Math.random. This tests that the shuffle
    // does not error on a 1-element input and the single step runs maxPasses times.
    const conv = makeConversation({
      models: [{ modelId: 'claude', name: 'Claude', color: 'violet', isActive: true }],
    });
    const acc = new ChunkAccumulator();

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: {
          steps: [{ stepIndex: 0, modelId: 'claude', appendToContext: false }],
          maxPasses: 3,
        },
      },
      acc.onChunk,
    );

    // 1 model × 3 passes = 3 done chunks, all for claude.
    expect(acc.doneChunks).toHaveLength(3);
    expect(acc.doneChunks.every((c) => c.modelId === 'claude')).toBe(true);
  });
});
