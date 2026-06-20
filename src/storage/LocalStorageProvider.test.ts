/**
 * Unit tests for LocalStorageProvider.
 *
 * localStorage is mocked with a simple in-memory Map — no jsdom required.
 * The mock is reset before each test so tests are fully isolated.
 *
 * Coverage:
 *   - save / load roundtrip
 *   - list order (newest-first by updatedAt)
 *   - delete cleanup (index and data key)
 *   - archive flag and updatedAt bump
 *   - unarchive (clears archivedAt)
 *   - ghost-mode skip on save
 *   - export format selection (markdown, html)
 *   - export returns null for missing conversation
 *   - corrupt data resilience (index and conversation data)
 *   - quota exceeded error is surfaced as a readable Error
 *   - listConversations() cache: populated on first call, served from cache on
 *     subsequent calls, invalidated correctly by saveConversation / deleteConversation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageProvider } from './LocalStorageProvider';
import type { Conversation, ModelConfig } from '@/types/index';

// ─── localStorage mock ────────────────────────────────────────────────────────

/**
 * Build a minimal localStorage mock backed by a Map.
 * Assign to `global.localStorage` so LocalStorageProvider can access it.
 */
function buildLocalStorageMock(store: Map<string, string>) {
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
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
    id: 'conv-1',
    title: 'Test conversation',
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let store: Map<string, string>;
let provider: LocalStorageProvider;

beforeEach(() => {
  store = new Map();
  // LocalStorageProvider accesses the global `localStorage` directly.
  Object.defineProperty(globalThis, 'localStorage', {
    value: buildLocalStorageMock(store),
    writable: true,
    configurable: true,
  });
  provider = new LocalStorageProvider();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('saveConversation / loadConversation', () => {
  it('persists a conversation and loads it back', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded).toEqual(conv);
  });

  it('returns null for a missing conversation id', async () => {
    const loaded = await provider.loadConversation('does-not-exist');
    expect(loaded).toBeNull();
  });

  it('overwrites an existing record on second save (upsert)', async () => {
    const conv = makeConversation({ title: 'First' });
    await provider.saveConversation(conv);
    await provider.saveConversation({ ...conv, title: 'Second' });
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded?.title).toBe('Second');
  });

  it('adds the id to the index only once on multiple saves', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await provider.saveConversation({ ...conv, title: 'Updated' });
    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
  });
});

describe('ghost-mode guard', () => {
  it('silently skips save when isGhost is true', async () => {
    const ghost = makeConversation({ isGhost: true });
    await provider.saveConversation(ghost);
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded).toBeNull();
  });

  it('does not add a ghost conversation to the index', async () => {
    const ghost = makeConversation({ isGhost: true });
    await provider.saveConversation(ghost);
    const list = await provider.listConversations();
    expect(list).toHaveLength(0);
  });
});

describe('listConversations', () => {
  it('returns an empty array when no conversations are stored', async () => {
    const list = await provider.listConversations();
    expect(list).toEqual([]);
  });

  it('returns all stored conversations', async () => {
    const a = makeConversation({ id: 'a', updatedAt: 2000 });
    const b = makeConversation({ id: 'b', updatedAt: 3000 });
    await provider.saveConversation(a);
    await provider.saveConversation(b);
    const list = await provider.listConversations();
    expect(list).toHaveLength(2);
  });

  it('sorts newest-first by updatedAt', async () => {
    const older = makeConversation({ id: 'older', updatedAt: 1000 });
    const newer = makeConversation({ id: 'newer', updatedAt: 9000 });
    await provider.saveConversation(older);
    await provider.saveConversation(newer);
    const list = await provider.listConversations();
    expect(list[0].id).toBe('newer');
    expect(list[1].id).toBe('older');
  });

  it('silently omits entries with corrupt conversation data', async () => {
    // Write a valid conversation to the index, then corrupt its data key.
    const conv = makeConversation({ id: 'good' });
    await provider.saveConversation(conv);
    // Directly corrupt the data key.
    store.set('roundtable:conv:bad', '{not valid json}');
    store.set('roundtable:index', JSON.stringify(['good', 'bad']));
    const list = await provider.listConversations();
    // Only 'good' should appear; 'bad' is silently dropped.
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('good');
  });

  it('returns empty list when index is corrupt JSON', async () => {
    store.set('roundtable:index', 'not-json');
    const list = await provider.listConversations();
    expect(list).toEqual([]);
  });
});

describe('deleteConversation', () => {
  it('removes the conversation from the index and its data key', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await provider.deleteConversation('conv-1');
    expect(await provider.loadConversation('conv-1')).toBeNull();
    expect(await provider.listConversations()).toHaveLength(0);
  });

  it('is a no-op for a non-existent id', async () => {
    // Should not throw.
    await expect(provider.deleteConversation('ghost-id')).resolves.toBeUndefined();
  });
});

describe('archiveConversation', () => {
  it('sets archivedAt and bumps updatedAt', async () => {
    const conv = makeConversation({ updatedAt: 1000 });
    await provider.saveConversation(conv);

    const before = Date.now();
    await provider.archiveConversation('conv-1');
    const after = Date.now();

    const archived = await provider.loadConversation('conv-1');
    expect(archived?.archivedAt).toBeDefined();
    expect(archived!.archivedAt!).toBeGreaterThanOrEqual(before);
    expect(archived!.archivedAt!).toBeLessThanOrEqual(after);
    expect(archived!.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it('is a no-op when the conversation does not exist', async () => {
    await expect(provider.archiveConversation('missing')).resolves.toBeUndefined();
  });

  it('leaves the conversation in the list after archiving', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await provider.archiveConversation('conv-1');
    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].archivedAt).toBeDefined();
  });
});

describe('unarchiveConversation', () => {
  it('clears archivedAt and bumps updatedAt', async () => {
    const conv = makeConversation({ archivedAt: 500, updatedAt: 500 });
    await provider.saveConversation(conv);

    const before = Date.now();
    await provider.unarchiveConversation('conv-1');
    const after = Date.now();

    const unarchived = await provider.loadConversation('conv-1');
    expect(unarchived?.archivedAt).toBeUndefined();
    expect(unarchived!.updatedAt).toBeGreaterThanOrEqual(before);
    expect(unarchived!.updatedAt).toBeLessThanOrEqual(after);
  });

  it('is a no-op when the conversation does not exist', async () => {
    await expect(provider.unarchiveConversation('missing')).resolves.toBeUndefined();
  });

  it('is a no-op when the conversation is not archived', async () => {
    const conv = makeConversation({ updatedAt: 1000 });
    await provider.saveConversation(conv);
    // The implementation returns early when archivedAt is absent — no re-save.
    await provider.unarchiveConversation('conv-1');
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded?.archivedAt).toBeUndefined();
    expect(loaded?.updatedAt).toBe(1000); // unchanged — early return
  });
});

describe('exportConversation', () => {
  it('returns null when the conversation does not exist', async () => {
    const result = await provider.exportConversation('missing', 'markdown');
    expect(result).toBeNull();
  });

  it('returns markdown content with correct mimeType', async () => {
    const conv = makeConversation({ title: 'My Chat' });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('text/markdown;charset=utf-8');
    expect(result!.filename).toMatch(/\.md$/);
    expect(result!.content).toContain('# My Chat');
  });

  it('returns html content with correct mimeType', async () => {
    const conv = makeConversation({ title: 'My Chat' });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result).not.toBeNull();
    expect(result!.mimeType).toBe('text/html;charset=utf-8');
    expect(result!.filename).toMatch(/\.html$/);
    expect(result!.content).toContain('<!DOCTYPE html>');
    expect(result!.content).toContain('My Chat');
  });

  it('slugifies the title for the filename', async () => {
    const conv = makeConversation({ title: 'Hello World! Testing 123' });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.filename).toBe('hello-world-testing-123.md');
  });

  it('falls back to conversation-{id} in the filename when title is absent', async () => {
    const conv = makeConversation({ title: undefined });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.filename).toBe('conversation-conv-1.md');
  });

  it('does not trigger any DOM download (no document access)', async () => {
    // If exportConversation attempted to call document.createElement, this
    // test would throw in the Node environment (no jsdom). Passing confirms
    // the method is side-effect-free.
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await expect(provider.exportConversation('conv-1', 'html')).resolves.not.toBeNull();
  });
});

describe('quota exceeded error', () => {
  it('throws a descriptive Error when localStorage is full', async () => {
    // Override setItem to simulate QuotaExceededError.
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = vi.fn().mockImplementation(() => { throw quotaError; });

    const conv = makeConversation();
    await expect(provider.saveConversation(conv)).rejects.toThrow(
      'Storage quota exceeded'
    );

    globalThis.localStorage.setItem = original;
  });
});

describe('corrupt load', () => {
  it('returns null when the stored JSON is malformed', async () => {
    store.set('roundtable:conv:bad', '{ broken json }');
    const result = await provider.loadConversation('bad');
    expect(result).toBeNull();
  });
});

describe('listConversations() cache', () => {
  it('populates cache on first call and serves it on subsequent calls without re-reading localStorage', async () => {
    const conv = makeConversation({ id: 'cache-test', updatedAt: 5000 });
    await provider.saveConversation(conv);

    // First call — full scan populates the cache.
    const first = await provider.listConversations();
    expect(first).toHaveLength(1);

    // Poison the localStorage entry so a second scan would return different data.
    store.set('roundtable:conv:cache-test', '{"schemaVersion":1,"data":{"id":"cache-test","title":"POISONED","messages":[],"models":[],"interactionMode":"parallel","isGhost":false,"createdAt":1,"updatedAt":5000}}');

    // Second call — must return the cached value, NOT the poisoned record.
    const second = await provider.listConversations();
    expect(second).toHaveLength(1);
    expect(second[0].title).toBe('Test conversation'); // cached, not poisoned
  });

  it('updates cache when saveConversation is called after initial list', async () => {
    const conv = makeConversation({ id: 'a', updatedAt: 1000 });
    await provider.saveConversation(conv);

    // Warm the cache.
    await provider.listConversations();

    // Save a second conversation.
    const conv2 = makeConversation({ id: 'b', updatedAt: 2000 });
    await provider.saveConversation(conv2);

    // Cache should reflect the new entry without needing a re-scan.
    const list = await provider.listConversations();
    expect(list).toHaveLength(2);
    expect(list.map((c) => c.id)).toContain('b');
  });

  it('updates cache when an existing conversation is re-saved', async () => {
    const conv = makeConversation({ id: 'a', title: 'Original', updatedAt: 1000 });
    await provider.saveConversation(conv);

    // Warm the cache.
    await provider.listConversations();

    // Re-save with a new title.
    await provider.saveConversation({ ...conv, title: 'Updated', updatedAt: 2000 });

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Updated');
  });

  it('removes entry from cache when deleteConversation is called', async () => {
    const conv = makeConversation({ id: 'to-delete', updatedAt: 1000 });
    await provider.saveConversation(conv);

    // Warm the cache.
    await provider.listConversations();

    // Delete the conversation.
    await provider.deleteConversation('to-delete');

    // Cache should reflect the deletion.
    const list = await provider.listConversations();
    expect(list).toHaveLength(0);
  });

  it('does not corrupt cache when a ghost conversation save is attempted', async () => {
    const real = makeConversation({ id: 'real', updatedAt: 1000 });
    await provider.saveConversation(real);

    // Warm the cache.
    await provider.listConversations();

    // Attempt to save a ghost — must be a no-op on both storage and cache.
    const ghost = makeConversation({ id: 'ghost', isGhost: true });
    await provider.saveConversation(ghost);

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('real');
  });

  it('cache reflects archiveConversation result on next list', async () => {
    const conv = makeConversation({ id: 'to-archive', updatedAt: 1000 });
    await provider.saveConversation(conv);

    // Warm the cache.
    await provider.listConversations();

    await provider.archiveConversation('to-archive');

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].archivedAt).toBeDefined();
  });

  it('cache reflects unarchiveConversation result on next list', async () => {
    const conv = makeConversation({ id: 'to-unarchive', archivedAt: 500, updatedAt: 500 });
    await provider.saveConversation(conv);

    // Warm the cache.
    await provider.listConversations();

    await provider.unarchiveConversation('to-unarchive');

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].archivedAt).toBeUndefined();
  });
});
