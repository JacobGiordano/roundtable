/**
 * Integration: Image pipeline — storage round-trip (#367)
 *
 * Tests that Message.generatedImages produced by Atlas's providers survives
 * the LocalStorageProvider save → load cycle without data loss, and that the
 * Attachment (user input) and GeneratedImage (model output) fields remain
 * cleanly separated on their respective message types.
 *
 * Cross-agent contracts exercised:
 *   LocalStorageProvider.saveConversation() / .loadConversation() — Vault
 *   GeneratedImage interface — Arch's type contract
 *   Attachment interface — Arch's type contract
 *   Message.generatedImages (assistant only) — Arch's directional contract
 *   Message.attachments (user only) — Arch's directional contract
 *
 * Note: Vault's own LocalStorageProvider.test.ts tests the basic generatedImages
 * round-trip thoroughly (lines 525–679). This file adds:
 *   1. A long/realistic base64 string (guards against string-length edge cases)
 *   2. Cross-contamination guard (user attachments vs. assistant generatedImages)
 *
 * These are the integration angles that belong to Scout rather than to Vault's
 * unit test suite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageProvider } from '@/storage/LocalStorageProvider';
import type { Attachment, Conversation, GeneratedImage, Message, ModelConfig } from '@/types/index';

// ─── localStorage mock ────────────────────────────────────────────────────────

function buildLocalStorageMock(store: Map<string, string>) {
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-img-test',
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── A realistic base64 string — 1×1 transparent PNG ─────────────────────────
//
// This is the actual base64-encoded content of a 1×1 transparent PNG file.
// At ~88 characters it is shorter than a real image but significantly longer
// than the 8–12 character strings used in unit tests. This guards against
// any hypothetical string-length truncation in the serialization path.

const REALISTIC_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// A longer simulated base64 string — exercises the storage path with ~200 chars.
const LONG_BASE64 = 'A'.repeat(200);

// ─── Setup ────────────────────────────────────────────────────────────────────

let store: Map<string, string>;
let provider: LocalStorageProvider;

beforeEach(() => {
  store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    value: buildLocalStorageMock(store),
    writable: true,
    configurable: true,
  });
  provider = new LocalStorageProvider();
});

afterEach(() => {
  store.clear();
});

// ─── Realistic base64 round-trip ──────────────────────────────────────────────

describe('Message.generatedImages — realistic base64 content round-trip (#367)', () => {
  it('a realistic-length base64 string (1×1 PNG) survives save → load intact', async () => {
    const image: GeneratedImage = {
      id: 'img-realistic',
      mimeType: 'image/png',
      base64: REALISTIC_BASE64,
    };
    const msg: Message = {
      id: 'msg-1',
      role: 'assistant',
      content: 'Generated a 1×1 PNG.',
      modelId: 'claude',
      timestamp: 2000,
      generatedImages: [image],
    };
    const conv = makeConversation({ messages: [msg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedImage = loaded!.messages[0].generatedImages![0];
    expect(loadedImage.base64).toBe(REALISTIC_BASE64);
    expect(loadedImage.base64).toHaveLength(REALISTIC_BASE64.length);
    expect(loadedImage.mimeType).toBe('image/png');
  });

  it('a longer base64 string (200 chars) survives save → load without truncation', async () => {
    const image: GeneratedImage = {
      id: 'img-long',
      mimeType: 'image/png',
      base64: LONG_BASE64,
    };
    const msg: Message = {
      id: 'msg-2',
      role: 'assistant',
      content: 'Generated an image.',
      modelId: 'gemini',
      timestamp: 3000,
      generatedImages: [image],
    };
    const conv = makeConversation({ messages: [msg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedImage = loaded!.messages[0].generatedImages![0];
    expect(loadedImage.base64).toBe(LONG_BASE64);
    expect(loadedImage.base64).toHaveLength(200);
  });

  it('all optional GeneratedImage fields (altText, width, height) survive round-trip', async () => {
    const image: GeneratedImage = {
      id: 'img-full',
      mimeType: 'image/webp',
      base64: REALISTIC_BASE64,
      altText: 'A beautiful sunset over the mountains',
      width: 1024,
      height: 768,
    };
    const msg: Message = {
      id: 'msg-3',
      role: 'assistant',
      content: 'Here is your image.',
      modelId: 'claude',
      timestamp: 4000,
      generatedImages: [image],
    };
    const conv = makeConversation({ messages: [msg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedImage = loaded!.messages[0].generatedImages![0];
    expect(loadedImage.altText).toBe('A beautiful sunset over the mountains');
    expect(loadedImage.width).toBe(1024);
    expect(loadedImage.height).toBe(768);
  });
});

// ─── Cross-contamination guard ────────────────────────────────────────────────
//
// The type contract (Arch, /src/types/index.ts) specifies:
//   - Attachment flows user → model (input): Message.attachments on user messages only
//   - GeneratedImage flows model → user (output): Message.generatedImages on assistant messages only
//
// These tests guard against any storage or migration code accidentally injecting
// one field onto the wrong message type, or merging the two arrays.

describe('Attachment vs. generatedImages — no cross-contamination after storage round-trip (#367)', () => {
  const USER_ATTACHMENT: Attachment = {
    id: 'att-1',
    mimeType: 'image/png',
    base64: 'dXNlci1pbWFnZQ==', // "user-image" in base64
    filename: 'user-photo.png',
    sizeBytes: 2048,
  };

  const ASSISTANT_IMAGE: GeneratedImage = {
    id: 'gen-img-1',
    mimeType: 'image/png',
    base64: 'bW9kZWwtaW1hZ2U=', // "model-image" in base64
    altText: 'Model-generated image',
  };

  it('user message attachments are absent on the assistant message after round-trip', async () => {
    const userMsg: Message = {
      id: 'user-msg',
      role: 'user',
      content: 'What does this image show?',
      timestamp: 1000,
      attachments: [USER_ATTACHMENT],
    };
    const assistantMsg: Message = {
      id: 'assistant-msg',
      role: 'assistant',
      content: 'I can see the image.',
      modelId: 'claude',
      timestamp: 2000,
      generatedImages: [ASSISTANT_IMAGE],
    };
    const conv = makeConversation({ messages: [userMsg, assistantMsg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedAssistant = loaded!.messages[1];
    // Assistant message must not have attachments — those belong on the user message.
    expect(loadedAssistant.attachments).toBeUndefined();
    // Assistant message generatedImages must be intact.
    expect(loadedAssistant.generatedImages).toHaveLength(1);
    expect(loadedAssistant.generatedImages![0].base64).toBe(ASSISTANT_IMAGE.base64);
  });

  it('assistant message generatedImages are absent on the user message after round-trip', async () => {
    const userMsg: Message = {
      id: 'user-msg',
      role: 'user',
      content: 'Generate an image for me.',
      timestamp: 1000,
      attachments: [USER_ATTACHMENT],
    };
    const assistantMsg: Message = {
      id: 'assistant-msg',
      role: 'assistant',
      content: 'Here is the generated image.',
      modelId: 'claude',
      timestamp: 2000,
      generatedImages: [ASSISTANT_IMAGE],
    };
    const conv = makeConversation({ messages: [userMsg, assistantMsg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedUser = loaded!.messages[0];
    // User message must not have generatedImages — those belong on assistant messages.
    expect(loadedUser.generatedImages).toBeUndefined();
    // User message attachments must be intact.
    expect(loadedUser.attachments).toHaveLength(1);
    expect(loadedUser.attachments![0].base64).toBe(USER_ATTACHMENT.base64);
  });

  it('user attachment base64 and assistant generatedImages base64 remain distinct after round-trip', async () => {
    // This is the directional contract's core invariant: user input base64 (attachments)
    // must never be confused with model output base64 (generatedImages).
    const userMsg: Message = {
      id: 'user-msg',
      role: 'user',
      content: 'Describe and transform this image.',
      timestamp: 1000,
      attachments: [USER_ATTACHMENT],
    };
    const assistantMsg: Message = {
      id: 'assistant-msg',
      role: 'assistant',
      content: 'Here is my transformation.',
      modelId: 'claude',
      timestamp: 2000,
      generatedImages: [ASSISTANT_IMAGE],
    };
    const conv = makeConversation({ messages: [userMsg, assistantMsg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    const loadedUserBase64 = loaded!.messages[0].attachments![0].base64;
    const loadedAssistantBase64 = loaded!.messages[1].generatedImages![0].base64;

    expect(loadedUserBase64).toBe(USER_ATTACHMENT.base64);
    expect(loadedAssistantBase64).toBe(ASSISTANT_IMAGE.base64);
    // The two base64 values must not be equal — they are different images.
    expect(loadedUserBase64).not.toBe(loadedAssistantBase64);
  });

  it('a message with no generatedImages has undefined (not []) after round-trip', async () => {
    // Guards against migration code accidentally defaulting generatedImages to [].
    const userMsg: Message = {
      id: 'user-msg',
      role: 'user',
      content: 'Hello.',
      timestamp: 1000,
    };
    const assistantMsg: Message = {
      id: 'assistant-msg',
      role: 'assistant',
      content: 'Hi there.',
      modelId: 'claude',
      timestamp: 2000,
      // generatedImages intentionally absent
    };
    const conv = makeConversation({ messages: [userMsg, assistantMsg] });

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-img-test');

    expect(loaded!.messages[0].generatedImages).toBeUndefined();
    expect(loaded!.messages[1].generatedImages).toBeUndefined();
  });
});
