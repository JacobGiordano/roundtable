/**
 * Shared conversation fixtures and factory helpers.
 *
 * These live at the test boundary — they produce the typed objects that cross
 * agent domains, so every integration test suite can build from the same
 * well-formed base without duplicating boilerplate.
 */

import type {
  Conversation,
  GeneratedImage,
  Message,
  ModelConfig,
  TokenUsage,
  ModelId,
  ModelError,
} from '@/types/index';

// ─── ID generator ─────────────────────────────────────────────────────────────

let _seq = 0;
export function nextId(prefix = 'id'): string {
  return `${prefix}-${++_seq}`;
}

/** Reset the sequence counter — call in beforeEach when test order matters. */
export function resetIdSeq(): void {
  _seq = 0;
}

// ─── Model fixtures ───────────────────────────────────────────────────────────

export const CLAUDE_MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

export const GPT_MODEL: ModelConfig = {
  modelId: 'gpt-5.5',
  name: 'GPT-5.5',
  color: 'emerald',
  isActive: true,
};

export const INACTIVE_MODEL: ModelConfig = {
  modelId: 'gemini',
  name: 'Gemini',
  color: 'sky',
  isActive: false,
};

// ─── Message factory ──────────────────────────────────────────────────────────

export function makeUserMessage(content: string, timestamp = Date.now()): Message {
  return {
    id: nextId('msg'),
    role: 'user',
    content,
    timestamp,
  };
}

export function makeAssistantMessage(
  content: string,
  modelId: ModelId = 'claude',
  tokenUsage?: TokenUsage,
  timestamp = Date.now(),
  error?: ModelError,
): Message {
  return {
    id: nextId('msg'),
    role: 'assistant',
    content,
    modelId,
    timestamp,
    tokenUsage,
    error,
    isStreaming: false,
  };
}

export function makeTokenUsage(input = 10, output = 20): TokenUsage {
  return {
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
  };
}

// ─── GeneratedImage factory ───────────────────────────────────────────────────

/**
 * A minimal valid PNG base64 payload (1×1 pixel transparent PNG).
 * Used as a safe fixture for image tests — small enough not to bloat test output.
 */
export const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/**
 * Factory for GeneratedImage fixtures.
 * Produces a well-formed GeneratedImage with a unique random id.
 * Pass `overrides` to set specific fields (e.g. altText, mimeType, width, height).
 */
export function makeGeneratedImage(overrides: Partial<GeneratedImage> = {}): GeneratedImage {
  return {
    id: `img-${Math.random().toString(36).slice(2, 7)}`,
    mimeType: 'image/png',
    base64: SAMPLE_BASE64,
    ...overrides,
  };
}

// ─── Conversation factory ─────────────────────────────────────────────────────

export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const now = Date.now();
  return {
    id: nextId('conv'),
    messages: [],
    models: [CLAUDE_MODEL, GPT_MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function makeGhostConversation(overrides: Partial<Conversation> = {}): Conversation {
  return makeConversation({ isGhost: true, ...overrides });
}

// ─── localStorage mock factory ────────────────────────────────────────────────

/**
 * Build an in-memory localStorage mock and wire it to globalThis.localStorage.
 *
 * Returns the backing store Map so tests can inspect raw values and a
 * `restore` function to put the original global back.
 *
 * Pattern matches the existing LocalStorageProvider.test.ts approach so
 * integration tests stay consistent with the existing test style.
 */
export function buildLocalStorageMock(): {
  store: Map<string, string>;
  restore: () => void;
} {
  const store = new Map<string, string>();

  const mock: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };

  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });

  const restore = () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      writable: true,
      configurable: true,
    });
  };

  return { store, restore };
}
