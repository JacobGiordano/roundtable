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
 *   - Message.generatedImages round-trip (issue #365): field survives
 *     serialize → deserialize unchanged; rendered in markdown/html exports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalStorageProvider } from './LocalStorageProvider';
import type { Attachment, Conversation, GeneratedImage, Message, ModelConfig } from '@/types/index';

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

// ─── Attachment metadata in exports ───────────────────────────────────────────

const ATTACHMENT: Attachment = {
  id: 'att-1',
  mimeType: 'image/png',
  base64: 'abc123',
  filename: 'screenshot.png',
  sizeBytes: 1024,
};

const ATTACHMENT_NO_FILENAME: Attachment = {
  id: 'att-2',
  mimeType: 'image/jpeg',
  base64: 'xyz789',
  sizeBytes: 512,
  // filename intentionally absent — clipboard paste
};

function makeMessageWithAttachments(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Look at this image',
    timestamp: 2000,
    attachments: [ATTACHMENT],
    ...overrides,
  };
}

describe('exportConversation with includeAttachments', () => {
  it('markdown: omits attachment metadata when includeAttachments is false (default)', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).not.toContain('[Attachment:');
    expect(result!.content).not.toContain('screenshot.png');
  });

  it('markdown: omits attachment metadata when includeAttachments is explicitly false', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: false });
    expect(result!.content).not.toContain('[Attachment:');
  });

  it('markdown: includes attachment line per attachment when includeAttachments is true', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    expect(result!.content).toContain('[Attachment: screenshot.png (image/png)]');
  });

  it('markdown: uses mimeType as fallback name when filename is absent', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments({ attachments: [ATTACHMENT_NO_FILENAME] })],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    // No filename — mimeType used as display name
    expect(result!.content).toContain('[Attachment: image/jpeg (image/jpeg)]');
  });

  it('markdown: renders one attachment line per attachment', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments({ attachments: [ATTACHMENT, ATTACHMENT_NO_FILENAME] })],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    expect(result!.content).toContain('[Attachment: screenshot.png (image/png)]');
    expect(result!.content).toContain('[Attachment: image/jpeg (image/jpeg)]');
  });

  it('markdown: does not add attachment lines when the message has no attachments', async () => {
    const conv = makeConversation({
      messages: [{ id: 'msg-plain', role: 'user', content: 'hello', timestamp: 1000 }],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    expect(result!.content).not.toContain('[Attachment:');
  });

  it('markdown: does not add attachment lines to assistant messages', async () => {
    const conv = makeConversation({
      messages: [
        makeMessageWithAttachments({ attachments: [ATTACHMENT] }),
        { id: 'msg-2', role: 'assistant', content: 'I see it', timestamp: 3000, modelId: 'claude' },
      ],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    // Attachment line only appears once (for the user message), not after the assistant reply.
    const attachmentLineCount = (result!.content.match(/\[Attachment:/g) ?? []).length;
    expect(attachmentLineCount).toBe(1);
  });

  it('html: omits attachment pills when includeAttachments is false (default)', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).not.toContain('class="attachment"');
    expect(result!.content).not.toContain('screenshot.png');
  });

  it('html: includes attachment pill per attachment when includeAttachments is true', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html', { includeAttachments: true });
    expect(result!.content).toContain('class="attachment"');
    expect(result!.content).toContain('screenshot.png');
  });

  it('html: uses mimeType as fallback name when filename is absent', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments({ attachments: [ATTACHMENT_NO_FILENAME] })],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html', { includeAttachments: true });
    expect(result!.content).toContain('image/jpeg');
  });

  it('html: does not add pills to assistant messages', async () => {
    const conv = makeConversation({
      messages: [
        makeMessageWithAttachments({ attachments: [ATTACHMENT] }),
        { id: 'msg-2', role: 'assistant', content: 'I see it', timestamp: 3000, modelId: 'claude' },
      ],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html', { includeAttachments: true });
    // Pills only in the user message div, not in the assistant div.
    // Verify: attachment CSS class appears inside a user-role div only.
    // The assistant div appears after the user div in the HTML.
    const userDivIdx = result!.content.indexOf('<div class="message user">');
    const assistantDivIdx = result!.content.indexOf('<div class="message assistant">');
    const pillIdx = result!.content.indexOf('class="attachment"');
    expect(pillIdx).toBeGreaterThan(userDivIdx);
    expect(pillIdx).toBeLessThan(assistantDivIdx);
  });

  it('html: does not embed raw base64 content', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html', { includeAttachments: true });
    // base64 field of the attachment must not appear in the export
    expect(result!.content).not.toContain('abc123');
  });

  it('markdown: does not embed raw base64 content', async () => {
    const conv = makeConversation({
      messages: [makeMessageWithAttachments()],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown', { includeAttachments: true });
    expect(result!.content).not.toContain('abc123');
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

// ─── Orphan ID cleanup (#481) ─────────────────────────────────────────────────

describe('orphan ID cleanup (#481)', () => {
  it('does not add the ID to the index when the data write fails (transactional ordering)', async () => {
    // Simulate QuotaExceededError on the FIRST setItem call (the data key write).
    // With the fixed ordering (data first, index second), the quota error fires
    // before the index is touched — so the ID must NOT appear in the index.
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    let callCount = 0;
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = vi.fn().mockImplementation((key: string, value: string) => {
      callCount++;
      if (callCount === 1) {
        // First write — the data key write. Throw to simulate quota failure.
        throw quotaError;
      }
      original.call(globalThis.localStorage, key, value);
    });

    const conv = makeConversation({ id: 'quota-fail-conv' });
    await expect(provider.saveConversation(conv)).rejects.toThrow('Storage quota exceeded');

    globalThis.localStorage.setItem = original;

    // The index must NOT contain the ID — the data write failed before the
    // index was touched, so no orphan should have been created.
    const list = await provider.listConversations();
    expect(list.map((c) => c.id)).not.toContain('quota-fail-conv');
  });

  it('prunes orphan IDs from the index on the first listConversations call', async () => {
    // Manually inject an orphan: write an ID into the index but provide no
    // corresponding data key. This simulates the pre-fix state where
    // writeIndex() succeeded but safeSet() for the data subsequently failed.
    const orphanId = 'orphan-conv';
    store.set('roundtable:index', JSON.stringify([orphanId]));
    // Deliberately do NOT write roundtable:conv:orphan-conv.

    // listConversations() should return an empty list (orphan is skipped)
    // and should prune the orphan from the index as a side effect.
    const list = await provider.listConversations();
    expect(list).toHaveLength(0);

    // The index must now be empty — the orphan ID was pruned.
    const rawIndex = store.get('roundtable:index');
    const index = rawIndex ? JSON.parse(rawIndex) : [];
    expect(index).not.toContain(orphanId);
  });

  it('preserves valid IDs when pruning orphans from the index', async () => {
    const good = makeConversation({ id: 'good-conv', updatedAt: 1000 });
    await provider.saveConversation(good);

    // Inject an orphan ID alongside the valid one.
    const rawIndex = store.get('roundtable:index');
    const ids: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    ids.push('orphan-conv');
    store.set('roundtable:index', JSON.stringify(ids));

    // Reset the provider so the cache is cold and listConversations does a full scan.
    provider = new LocalStorageProvider();

    const list = await provider.listConversations();
    // Only the valid conversation is returned.
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('good-conv');

    // The index must retain good-conv but not orphan-conv.
    const rawIndexAfter = store.get('roundtable:index');
    const indexAfter: string[] = rawIndexAfter ? JSON.parse(rawIndexAfter) : [];
    expect(indexAfter).toContain('good-conv');
    expect(indexAfter).not.toContain('orphan-conv');
  });

  it('does not rewrite the index when no orphans are found', async () => {
    const conv = makeConversation({ id: 'clean-conv', updatedAt: 1000 });
    await provider.saveConversation(conv);

    // Track setItem calls to confirm no extra index write occurs.
    const setCalls: string[] = [];
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = vi.fn().mockImplementation((key: string, value: string) => {
      setCalls.push(key);
      original.call(globalThis.localStorage, key, value);
    });

    // Reset the provider so the cache is cold.
    provider = new LocalStorageProvider();
    await provider.listConversations();

    globalThis.localStorage.setItem = original;

    // No index write should have occurred during the list (no orphans, no pruning needed).
    expect(setCalls.filter((k) => k === 'roundtable:index')).toHaveLength(0);
  });

  it('prune is non-fatal: listConversations still returns valid data when prune write fails', async () => {
    // Inject a valid conversation and an orphan.
    const good = makeConversation({ id: 'good-conv', updatedAt: 1000 });
    await provider.saveConversation(good);
    const rawIndex = store.get('roundtable:index');
    const ids: string[] = rawIndex ? JSON.parse(rawIndex) : [];
    ids.push('orphan-conv');
    store.set('roundtable:index', JSON.stringify(ids));

    // Reset the provider so the cache is cold.
    provider = new LocalStorageProvider();

    // Make the index write inside pruneIndex throw.
    const quotaError = new DOMException('Quota exceeded', 'QuotaExceededError');
    const original = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = vi.fn().mockImplementation(() => { throw quotaError; });

    // listConversations must NOT throw even though the prune write fails.
    const list = await provider.listConversations();
    globalThis.localStorage.setItem = original;

    // The valid conversation is still returned.
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('good-conv');
  });
});

describe('corrupt load', () => {
  it('returns null when the stored JSON is malformed', async () => {
    store.set('roundtable:conv:bad', '{ broken json }');
    const result = await provider.loadConversation('bad');
    expect(result).toBeNull();
  });
});

// ─── Message.generatedImages round-trip and export (issue #365) ───────────────

const GENERATED_IMAGE: GeneratedImage = {
  id: 'img-1',
  mimeType: 'image/png',
  base64: 'iVBORw0KGgo=',
  altText: 'A test image',
  width: 256,
  height: 256,
};

const GENERATED_IMAGE_NO_ALT: GeneratedImage = {
  id: 'img-2',
  mimeType: 'image/webp',
  base64: 'UklGRg==',
};

function makeAssistantMessageWithImages(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-img',
    role: 'assistant',
    content: 'Here is the image I generated.',
    modelId: 'claude',
    timestamp: 3000,
    generatedImages: [GENERATED_IMAGE],
    ...overrides,
  };
}

describe('Message.generatedImages — LocalStorage round-trip (issue #365)', () => {
  it('persists generatedImages and loads them back intact', async () => {
    const msg = makeAssistantMessageWithImages();
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.messages[0].generatedImages).toEqual([GENERATED_IMAGE]);
  });

  it('preserves all GeneratedImage fields: id, mimeType, base64, altText, width, height', async () => {
    const msg = makeAssistantMessageWithImages();
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-1');
    const img = loaded!.messages[0].generatedImages![0];
    expect(img.id).toBe('img-1');
    expect(img.mimeType).toBe('image/png');
    expect(img.base64).toBe('iVBORw0KGgo=');
    expect(img.altText).toBe('A test image');
    expect(img.width).toBe(256);
    expect(img.height).toBe(256);
  });

  it('preserves multiple generatedImages on a single message', async () => {
    const msg = makeAssistantMessageWithImages({
      generatedImages: [GENERATED_IMAGE, GENERATED_IMAGE_NO_ALT],
    });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded!.messages[0].generatedImages).toHaveLength(2);
    expect(loaded!.messages[0].generatedImages![1]).toEqual(GENERATED_IMAGE_NO_ALT);
  });

  it('keeps generatedImages absent (not defaulted to []) when not set', async () => {
    const msg: Message = { id: 'msg-plain', role: 'assistant', content: 'No images', modelId: 'claude', timestamp: 1000 };
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation('conv-1');
    // Must be undefined — not an empty array.
    expect(loaded!.messages[0].generatedImages).toBeUndefined();
  });

  it('does not persist generatedImages when isGhost is true', async () => {
    const msg = makeAssistantMessageWithImages();
    const ghost = makeConversation({ isGhost: true, messages: [msg] });
    await provider.saveConversation(ghost);
    // Ghost conversations are never written to storage.
    const loaded = await provider.loadConversation('conv-1');
    expect(loaded).toBeNull();
  });
});

describe('Message.generatedImages — markdown export (issue #365)', () => {
  it('renders generatedImages as inline data-URI Markdown images', async () => {
    const conv = makeConversation({ messages: [makeAssistantMessageWithImages()] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).toContain('![A test image](data:image/png;base64,iVBORw0KGgo=)');
  });

  it('uses "Generated image" as alt text when altText is absent', async () => {
    const msg = makeAssistantMessageWithImages({ generatedImages: [GENERATED_IMAGE_NO_ALT] });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).toContain('![Generated image](data:image/webp;base64,UklGRg==)');
  });

  it('escapes ] characters in altText to preserve Markdown image syntax', async () => {
    const imgWithBracket: GeneratedImage = { id: 'img-3', mimeType: 'image/png', base64: 'abc=', altText: 'image [cropped]' };
    const msg = makeAssistantMessageWithImages({ generatedImages: [imgWithBracket] });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).toContain('![image [cropped\\]](data:image/png;base64,abc=)');
  });

  it('renders one image line per generatedImage', async () => {
    const msg = makeAssistantMessageWithImages({
      generatedImages: [GENERATED_IMAGE, GENERATED_IMAGE_NO_ALT],
    });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).toContain('![A test image](data:image/png;base64,iVBORw0KGgo=)');
    expect(result!.content).toContain('![Generated image](data:image/webp;base64,UklGRg==)');
  });

  it('does not add image lines when generatedImages is absent', async () => {
    const conv = makeConversation({
      messages: [{ id: 'msg-plain', role: 'assistant', content: 'No images', modelId: 'claude', timestamp: 1000 }],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result!.content).not.toContain('data:');
  });
});

describe('Message.generatedImages — HTML export (issue #365)', () => {
  it('renders generatedImages as <img> elements with data-URI src', async () => {
    const conv = makeConversation({ messages: [makeAssistantMessageWithImages()] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).toContain('src="data:image/png;base64,iVBORw0KGgo="');
    expect(result!.content).toContain('alt="A test image"');
  });

  it('uses "Generated image" as alt when altText is absent', async () => {
    const msg = makeAssistantMessageWithImages({ generatedImages: [GENERATED_IMAGE_NO_ALT] });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).toContain('alt="Generated image"');
    expect(result!.content).toContain('src="data:image/webp;base64,UklGRg=="');
  });

  it('HTML-escapes altText in the alt attribute', async () => {
    const imgWithQuote: GeneratedImage = { id: 'img-4', mimeType: 'image/png', base64: 'def=', altText: 'image "quoted"' };
    const msg = makeAssistantMessageWithImages({ generatedImages: [imgWithQuote] });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).toContain('alt="image &quot;quoted&quot;"');
  });

  it('renders one <img> per generatedImage', async () => {
    const msg = makeAssistantMessageWithImages({
      generatedImages: [GENERATED_IMAGE, GENERATED_IMAGE_NO_ALT],
    });
    const conv = makeConversation({ messages: [msg] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    const imgCount = (result!.content.match(/<img /g) ?? []).length;
    expect(imgCount).toBe(2);
  });

  it('wraps images in a .generated-images div', async () => {
    const conv = makeConversation({ messages: [makeAssistantMessageWithImages()] });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).toContain('class="generated-images"');
  });

  it('does not add image elements when generatedImages is absent', async () => {
    const conv = makeConversation({
      messages: [{ id: 'msg-plain', role: 'assistant', content: 'No images', modelId: 'claude', timestamp: 1000 }],
    });
    await provider.saveConversation(conv);
    const result = await provider.exportConversation('conv-1', 'html');
    expect(result!.content).not.toContain('<img ');
    expect(result!.content).not.toContain('data:');
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
