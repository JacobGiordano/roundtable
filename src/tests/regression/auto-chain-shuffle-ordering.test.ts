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
  makeUserMessage,
  resetIdSeq,
} from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { ChainStep, Message } from '@/types/index';
import { claudeProvider } from '@/models/claude';
import { gpt55Provider } from '@/models/gpt';
import { deepseekProvider } from '@/models/deepseek';

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

// ─── #316: appendToContext + shuffle interaction ──────────────────────────────

/**
 * Regression: auto-chain — appendToContext context growth follows shuffled step order
 *
 * Issue #316: runAutoChain appends each appendToContext step's response to
 * sharedMessages before the next step runs. No test previously verified that a
 * shuffled step order drives the growth of sharedMessages correctly — i.e., that
 * the FIRST step in the SHUFFLED order is the one whose response appears earliest
 * in the shared context seen by subsequent steps, not the first step in roster order.
 *
 * Verification approach:
 *   Spy on each provider's sendMessage at the instance level (real provider
 *   instances are used — only the network call is replaced). Each spy emits a
 *   content chunk with known text, then a done chunk. This satisfies
 *   collectingChunkHandler so sharedMessages grows correctly.
 *
 *   The messages argument each spy receives reflects the state of sharedMessages
 *   after buildAttributedMessages transforms it for that provider. We count those
 *   messages and inspect their attribution content to prove that:
 *     1. The first shuffled step received the shortest context (1 msg).
 *     2. Each subsequent shuffled step received a longer context — with attribution
 *        framing that names the model that ran before it in shuffle order, not
 *        roster order.
 *
 * Fisher-Yates derivation for shuffle with r0=0.5, r1=0.0:
 *   [claude, gpt-5.5, deepseek]
 *   i=2: j=floor(0.5*3)=1, swap [2] and [1] → [claude, deepseek, gpt-5.5]
 *   i=1: j=floor(0.0*2)=0, swap [1] and [0] → [deepseek, claude, gpt-5.5]
 *   Shuffled order: [deepseek, claude, gpt-5.5]
 */
describe('auto-chain (#316) — appendToContext context growth follows shuffled step order', () => {
  it('each step in shuffle order receives a growing context with attribution from the prior shuffled step', async () => {
    // Seed: [deepseek, claude, gpt-5.5] (see derivation above).
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.0);

    // App.tsx pre-appends the user message to conversation.messages before
    // calling sendMessage. Replicate that here so sharedMessages starts with
    // one message — making message-count assertions meaningful (not trivially 0).
    const conv = makeConversation({
      messages: [makeUserMessage('test')],
      models: [
        { modelId: 'claude',   name: 'Claude',   color: 'violet',  isActive: true },
        { modelId: 'gpt-5.5', name: 'GPT-5.5',  color: 'emerald', isActive: true },
        { modelId: 'deepseek', name: 'DeepSeek', color: 'sky',     isActive: true },
      ],
    });
    const acc = new ChunkAccumulator();

    // Capture what each provider sees as its messages argument.
    // The argument is the attributed wire-format array, not raw sharedMessages,
    // so counts and attribution content are what we assert on.
    const seenMessages = new Map<string, Message[]>();

    vi.spyOn(deepseekProvider, 'sendMessage').mockImplementation(
      async (messages, _sp, onChunk) => {
        seenMessages.set('deepseek', [...messages]);
        onChunk({ modelId: 'deepseek', content: 'response from deepseek', isDone: false });
        onChunk({ modelId: 'deepseek', content: '', isDone: true });
        return {};
      },
    );

    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (messages, _sp, onChunk) => {
        seenMessages.set('claude', [...messages]);
        onChunk({ modelId: 'claude', content: 'response from claude', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    vi.spyOn(gpt55Provider, 'sendMessage').mockImplementation(
      async (messages, _sp, onChunk) => {
        seenMessages.set('gpt-5.5', [...messages]);
        onChunk({ modelId: 'gpt-5.5', content: 'response from gpt-5.5', isDone: false });
        onChunk({ modelId: 'gpt-5.5', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: {
          steps: [
            { stepIndex: 0, modelId: 'claude',   appendToContext: true },
            { stepIndex: 1, modelId: 'gpt-5.5',  appendToContext: true },
            { stepIndex: 2, modelId: 'deepseek', appendToContext: true },
          ],
          maxPasses: 1,
        },
      },
      acc.onChunk,
    );

    // All three steps ran — no abort, no error.
    expect(acc.doneChunks).toHaveLength(3);

    // Shuffle order: [deepseek, claude, gpt-5.5].
    // Execution order is confirmed by the done-chunk sequence.
    expect(acc.doneChunks.map((c) => c.modelId)).toEqual(['deepseek', 'claude', 'gpt-5.5']);

    // deepseek runs first: sees only the initial user message.
    expect(seenMessages.get('deepseek')).toHaveLength(1);

    // claude runs second: sees user msg + deepseek's response.
    // buildAttributedMessages re-casts deepseek's assistant msg as a user-role
    // attribution: "[DeepSeek responded: response from deepseek]".
    expect(seenMessages.get('claude')).toHaveLength(2);
    expect(seenMessages.get('claude')![1].content).toContain('DeepSeek responded');

    // gpt-5.5 runs last: sees user msg + deepseek's + claude's responses.
    // claude's response is attributed as "[Claude responded: response from claude]".
    expect(seenMessages.get('gpt-5.5')).toHaveLength(3);
    expect(seenMessages.get('gpt-5.5')![2].content).toContain('Claude responded');
  });
});

// ─── #317: Abort mid-shuffle ──────────────────────────────────────────────────

/**
 * Regression: auto-chain — abort signal stops chain at the correct shuffled step
 *
 * Issue #317: runAutoChain checks signal.aborted at the TOP of each step's loop
 * iteration. No test previously verified that an aborted chain stops at the
 * expected step in the SHUFFLED order — i.e., that the post-abort silence
 * applies to the remaining shuffled steps, not the remaining roster steps.
 *
 * Verification approach:
 *   Use the same shuffle as #316 (r0=0.5, r1=0.0 → [deepseek, claude, gpt-5.5]).
 *   The deepseek spy emits its chunks and then calls controller.abort().
 *   After deepseek's sendMessage resolves, runAutoChain advances to the next loop
 *   iteration (claude's step) and checks signal?.aborted — finding it true, it
 *   returns immediately. Claude and gpt-5.5 never execute.
 *
 *   The key invariant: if the abort were applied in ROSTER order, deepseek (3rd
 *   in roster) would never have run at all — the abort would have fired before
 *   the first roster step (claude). Instead, deepseek ran because it was FIRST
 *   in the shuffled order, proving the abort check walks the shuffled list.
 */
describe('auto-chain (#317) — abort signal stops chain at correct shuffled step', () => {
  it('chain halts after the first shuffled step when signal is aborted mid-chain', async () => {
    // Seed: [deepseek, claude, gpt-5.5] (see derivation in #316 block above).
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.0);

    const conv = makeChainConversation();
    const acc = new ChunkAccumulator();
    const controller = new AbortController();

    // deepseek runs first (shuffle order). It completes normally, then aborts
    // the controller. The signal.aborted check at the start of claude's iteration
    // (the next shuffled step) will catch this and exit the chain.
    vi.spyOn(deepseekProvider, 'sendMessage').mockImplementation(
      async (_messages, _sp, onChunk) => {
        onChunk({ modelId: 'deepseek', content: 'response from deepseek', isDone: false });
        onChunk({ modelId: 'deepseek', content: '', isDone: true });
        controller.abort();
        return {};
      },
    );

    // These spies should never be called. If they emit chunks, the abort failed.
    vi.spyOn(claudeProvider, 'sendMessage').mockImplementation(
      async (_messages, _sp, onChunk) => {
        onChunk({ modelId: 'claude', content: 'from claude', isDone: false });
        onChunk({ modelId: 'claude', content: '', isDone: true });
        return {};
      },
    );

    vi.spyOn(gpt55Provider, 'sendMessage').mockImplementation(
      async (_messages, _sp, onChunk) => {
        onChunk({ modelId: 'gpt-5.5', content: 'from gpt-5.5', isDone: false });
        onChunk({ modelId: 'gpt-5.5', content: '', isDone: true });
        return {};
      },
    );

    await sendMessage(
      {
        conversationId: conv.id,
        content: 'test',
        conversation: conv,
        chainConfig: {
          steps: makeThreeSteps(),
          maxPasses: 1,
        },
        signal: controller.signal,
      },
      acc.onChunk,
    );

    // Only deepseek's done chunk arrived — it was first in shuffle order.
    // Claude and gpt-5.5 (next in shuffle order) never started.
    // If the abort were applied in ROSTER order, the roster-first step (claude)
    // would have been the one to run; instead it is the shuffle-first step (deepseek).
    const executedOrder = acc.doneChunks.map((c) => c.modelId);
    expect(executedOrder).toEqual(['deepseek']);

    // No chunks from claude or gpt-5.5 at all — not even the content chunks that
    // the spies would have emitted if invoked.
    expect(acc.all.filter((c) => c.modelId === 'claude')).toHaveLength(0);
    expect(acc.all.filter((c) => c.modelId === 'gpt-5.5')).toHaveLength(0);
  });
});
