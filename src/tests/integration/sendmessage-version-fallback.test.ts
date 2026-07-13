/**
 * Regression: sendMessage() version fallback from Gate when conversation.models is stale (#393)
 *
 * Root cause: handleSelectModelVersion (Aria / App.tsx) writes the selected version
 * to Gate's localStorage via setModelVersion(), then updates React state via setModels(),
 * but does NOT call store.updateConversation(). As a result, the conversation object
 * passed to sendMessage() carries a stale (or absent) selectedVersionId in
 * conversation.models[n].selectedVersionId.
 *
 * Fix (Atlas, #393): all three dispatch paths (runParallel, runDirected, runAutoChain)
 * now use:
 *   const selectedVersionId = modelConfig?.selectedVersionId ?? getModelVersion(modelId);
 * so that when the conversation-stored value is absent, Gate's authoritative stored
 * selection is used instead.
 *
 * These tests verify the fix by calling the top-level sendMessage() with a conversation
 * that has no selectedVersionId set (simulating the stale state), while Gate has
 * 'gpt-image-2' stored. They assert that the image-generation endpoint is reached.
 *
 * Message array note: when sendMessage() receives a conversation, it uses
 * conversation.messages directly (not options.content). This mirrors how App.tsx
 * works — handleSend appends the user message to conversation.messages BEFORE
 * calling sendMessage, so options.content is unused in the conversation path.
 * Tests must therefore include the user message in conversation.messages explicitly.
 *
 * Cross-agent contracts exercised:
 *   sendMessage()             — Atlas routing dispatcher
 *   getModelVersion()         — Gate credential/version store cross-agent import
 *   GPT55ModelProvider        — Atlas provider implementation
 *   roundtable:model-versions — Gate localStorage storage key (tested indirectly)
 *   roundtable:provider-roster — Gate roster (needed to build imageGenEnabled set)
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

// ─── Constants ────────────────────────────────────────────────────────────────

const ROSTER_KEY = 'roundtable:provider-roster';
const MODEL_VERSION_KEY = 'roundtable:model-versions';
const OPENAI_KEY = 'roundtable:key:openai';

// Minimal 1×1 transparent PNG base64 — no data-URL prefix.
const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * A valid BuiltInProviderConfig for gpt-5.5. The roster validator requires
 * kind, modelId, credentialKey, and isVisible. The BUILTIN_CAPABILITIES_MAP
 * in providerRoster.ts overwrites stored capabilities on read — so we do not
 * need to set imageGeneration here; it arrives automatically from the map.
 */
const GPT_ROSTER_ENTRY = {
  kind: 'builtin',
  modelId: 'gpt-5.5',
  credentialKey: 'openai',
  isVisible: true,
};

/**
 * Build a mock JSON Response as returned by POST /v1/images/generations.
 */
function makeImageGenResponse(): Response {
  return new Response(
    JSON.stringify({
      created: 1700000000,
      data: [{ b64_json: SAMPLE_BASE64 }],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Build a conversation with gpt-5.5 active, no selectedVersionId, and a
 * user message in conversation.messages.
 *
 * sendMessage() uses conversation.messages as the message array when a
 * conversation is provided — App.tsx appends the user message to
 * conversation.messages BEFORE calling sendMessage. Tests must replicate
 * this by including the user message in messages.
 */
function makeGptConversationWithMessage(
  userContent: string,
  selectedVersionId?: string
) {
  return makeConversation({
    models: [{
      modelId: 'gpt-5.5',
      name: 'GPT',
      color: 'emerald',
      isActive: true,
      ...(selectedVersionId ? { selectedVersionId } : {}),
    }],
    messages: [makeUserMessage(userContent)],
  });
}

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

// ─── Version fallback from Gate (#393) ───────────────────────────────────────

describe('sendMessage — version fallback from Gate when conversation.models is stale (#393)', () => {
  /**
   * Core regression case: Gate has gpt-image-2 stored, conversation has no
   * selectedVersionId for gpt-5.5. Before the fix, sendMessage used
   * gpt-5.5 (the defaultModel), which is not in IMAGE_GEN_MODEL_STRINGS, so
   * the image gen gate failed silently. After the fix, the Gate fallback
   * supplies gpt-image-2 and the image endpoint is reached.
   */
  it('Gate has gpt-image-2, conversation.models has no selectedVersionId → image endpoint called', async () => {
    // Set up Gate: API key + model version selection
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    globalThis.localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify({ 'gpt-5.5': 'gpt-image-2' }));
    // Set up roster so getActiveProviders() finds gpt-5.5 and sets imageGenEnabled
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));

    const fetchMock = vi.fn().mockResolvedValue(makeImageGenResponse());
    vi.stubGlobal('fetch', fetchMock);

    // Conversation has gpt-5.5 active but NO selectedVersionId — simulates stale state.
    // User message is in conversation.messages (mirrors App.tsx handleSend behavior).
    const conv = makeGptConversationWithMessage('Generate an image of a sunrise.');

    const acc = new ChunkAccumulator();
    await sendMessage(
      { conversationId: conv.id, content: 'Generate an image of a sunrise.', conversation: conv },
      acc.onChunk
    );

    // fetch must have been called on the image-gen endpoint — not chat completions
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/v1/images/generations');
    expect(url).not.toContain('/v1/chat/completions');
  });

  it('image gen endpoint receives gpt-image-2 as the model in the request body', async () => {
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    globalThis.localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify({ 'gpt-5.5': 'gpt-image-2' }));
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));

    const fetchMock = vi.fn().mockResolvedValue(makeImageGenResponse());
    vi.stubGlobal('fetch', fetchMock);

    const conv = makeGptConversationWithMessage('A red fox.');

    const acc = new ChunkAccumulator();
    await sendMessage(
      { conversationId: conv.id, content: 'A red fox.', conversation: conv },
      acc.onChunk
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe('gpt-image-2');
  });

  it('sendMessage resolves and emits a done chunk with images on success', async () => {
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    globalThis.localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify({ 'gpt-5.5': 'gpt-image-2' }));
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeImageGenResponse()));

    const conv = makeGptConversationWithMessage('A mountain lake.');

    const acc = new ChunkAccumulator();
    await sendMessage(
      { conversationId: conv.id, content: 'A mountain lake.', conversation: conv },
      acc.onChunk
    );

    const done = acc.doneChunks.find((c) => c.modelId === 'gpt-5.5');
    expect(done).toBeDefined();
    expect(done!.images).toBeDefined();
    expect(done!.images!.length).toBeGreaterThan(0);
    expect(done!.error).toBeUndefined();
  });

  /**
   * Priority test: conversation.models.selectedVersionId wins over Gate when both
   * are set. If the conversation has 'gpt-4o' explicitly stored, that should be
   * used — not the Gate-stored 'gpt-image-2'. 'gpt-4o' is not in
   * IMAGE_GEN_MODEL_STRINGS, so the chat completions path fires. With no streaming
   * mock, the request will error — but the image endpoint must not be called.
   */
  it('conversation.models.selectedVersionId wins over Gate fallback when both are set', async () => {
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    // Gate has gpt-image-2 — this should be IGNORED because conversation has gpt-4o
    globalThis.localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify({ 'gpt-5.5': 'gpt-image-2' }));
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    // conversation explicitly has gpt-4o — takes priority over Gate
    const conv = makeGptConversationWithMessage('Hello.', 'gpt-4o');

    const acc = new ChunkAccumulator();
    await sendMessage(
      { conversationId: conv.id, content: 'Hello.', conversation: conv },
      acc.onChunk
    );

    // gpt-4o is not an image model — image endpoint must NOT be called
    if (fetchMock.mock.calls.length > 0) {
      const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
      expect(url).not.toContain('/v1/images/generations');
    }
    // Key assertion: no images in the done chunk.
    const done = acc.doneChunks.find((c) => c.modelId === 'gpt-5.5');
    expect(done?.images).toBeUndefined();
  });

  /**
   * Neither conversation nor Gate has a version set. Provider falls back to its
   * hardcoded defaultModel ('gpt-5.5') — not in IMAGE_GEN_MODEL_STRINGS — so chat
   * completions path fires. Image endpoint must never be called.
   */
  it('neither conversation nor Gate has version set → provider default → no image endpoint', async () => {
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    // No model-versions in localStorage
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const conv = makeGptConversationWithMessage('Hello.');

    const acc = new ChunkAccumulator();
    await sendMessage(
      { conversationId: conv.id, content: 'Hello.', conversation: conv },
      acc.onChunk
    );

    // No image endpoint call — provider defaulted to gpt-5.5 which is chat-only
    if (fetchMock.mock.calls.length > 0) {
      const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
      expect(url).not.toContain('/v1/images/generations');
    }
    const done = acc.doneChunks.find((c) => c.modelId === 'gpt-5.5');
    expect(done?.images).toBeUndefined();
  });

  /**
   * Gate fallback also applies in directed reply mode — runDirected uses the same
   * fallback pattern. Verify the image endpoint is reached when targetModelId is set.
   */
  it('directed reply: Gate fallback resolves gpt-image-2 when conversation lacks selectedVersionId', async () => {
    globalThis.localStorage.setItem(OPENAI_KEY, 'sk-test');
    globalThis.localStorage.setItem(MODEL_VERSION_KEY, JSON.stringify({ 'gpt-5.5': 'gpt-image-2' }));
    globalThis.localStorage.setItem(ROSTER_KEY, JSON.stringify([GPT_ROSTER_ENTRY]));

    const fetchMock = vi.fn().mockResolvedValue(makeImageGenResponse());
    vi.stubGlobal('fetch', fetchMock);

    const conv = makeGptConversationWithMessage('Generate a skyline.');

    const acc = new ChunkAccumulator();
    await sendMessage(
      {
        conversationId: conv.id,
        content: 'Generate a skyline.',
        targetModelId: 'gpt-5.5',
        conversation: conv,
      },
      acc.onChunk
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/v1/images/generations');
  });
});
