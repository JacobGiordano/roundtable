/**
 * Tests for the schema versioning and migration pipeline in /src/storage/migration.ts.
 *
 * Coverage:
 *   - CURRENT_SCHEMA_VERSION constant is a positive integer
 *   - wrapForStorage() produces a valid StoredConversation envelope
 *   - migrateConversation(): version 0 → 1 identity migration
 *   - migrateConversation(): already-current version fast path (no-op)
 *   - migrateConversation(): throws MigrationError for non-object input
 *   - migrateConversation(): throws MigrationError for future version
 *   - parseStoredConversation(): null/empty input returns null
 *   - parseStoredConversation(): invalid JSON returns null
 *   - parseStoredConversation(): bare (legacy version 0) Conversation migrates correctly
 *   - parseStoredConversation(): envelope at current version fast path
 *   - parseStoredConversation(): envelope at older version runs migration
 *   - parseStoredConversation(): envelope at future version returns null (warns)
 *   - parseStoredConversation(): non-object data returns null (warns)
 *   - LocalStorageProvider write path uses envelope
 *   - LocalStorageProvider read path parses envelope correctly
 *   - Legacy bare Conversation in localStorage migrates on load
 *   - Ghost-mode: envelope is never written when isGhost is true
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  MigrationError,
  migrateConversation,
  wrapForStorage,
  parseStoredConversation,
} from '@/storage/migration';
import { LocalStorageProvider } from '@/storage/LocalStorageProvider';
import type { Conversation, ModelConfig } from '@/types/index';

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

// ─── localStorage mock for LocalStorageProvider tests ────────────────────────

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

// ─── CURRENT_SCHEMA_VERSION ───────────────────────────────────────────────────

describe('CURRENT_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(typeof CURRENT_SCHEMA_VERSION).toBe('number');
    expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
    expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
  });
});

// ─── wrapForStorage ───────────────────────────────────────────────────────────

describe('wrapForStorage', () => {
  it('returns an envelope with schemaVersion equal to CURRENT_SCHEMA_VERSION', () => {
    const conv = makeConversation();
    const wrapped = wrapForStorage(conv);
    expect(wrapped.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('preserves the conversation as the data field', () => {
    const conv = makeConversation({ title: 'My Chat' });
    const wrapped = wrapForStorage(conv);
    expect(wrapped.data).toEqual(conv);
  });

  it('produces a plain object — no prototype methods that would affect JSON.stringify', () => {
    const conv = makeConversation();
    const wrapped = wrapForStorage(conv);
    const serialized = JSON.parse(JSON.stringify(wrapped));
    expect(serialized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(serialized.data.id).toBe(conv.id);
  });
});

// ─── migrateConversation ──────────────────────────────────────────────────────

describe('migrateConversation', () => {
  it('version 0 → current: identity migration returns the conversation unchanged', () => {
    const conv = makeConversation({ id: 'test-v0', title: 'Legacy conv' });
    const result = migrateConversation(conv, 0);
    expect(result).toEqual(conv);
  });

  it('already at current version: fast path returns the conversation unchanged', () => {
    const conv = makeConversation({ id: 'test-current' });
    const result = migrateConversation(conv, CURRENT_SCHEMA_VERSION);
    expect(result).toEqual(conv);
  });

  it('throws MigrationError when raw is null', () => {
    expect(() => migrateConversation(null, 0)).toThrow(MigrationError);
  });

  it('throws MigrationError when raw is a string', () => {
    expect(() => migrateConversation('not-an-object', 0)).toThrow(MigrationError);
  });

  it('throws MigrationError when raw is a number', () => {
    expect(() => migrateConversation(42, 0)).toThrow(MigrationError);
  });

  it('throws MigrationError when raw is an array', () => {
    expect(() => migrateConversation([], 0)).toThrow(MigrationError);
  });

  it('throws MigrationError for a version greater than CURRENT_SCHEMA_VERSION', () => {
    const conv = makeConversation();
    const futureVersion = CURRENT_SCHEMA_VERSION + 1;
    expect(() => migrateConversation(conv, futureVersion)).toThrow(MigrationError);
  });

  it('MigrationError carries the fromVersion', () => {
    try {
      migrateConversation(null, 0);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationError);
      expect((err as MigrationError).fromVersion).toBe(0);
    }
  });

  it('MigrationError for future version carries the fromVersion', () => {
    const futureVersion = CURRENT_SCHEMA_VERSION + 99;
    try {
      migrateConversation(makeConversation(), futureVersion);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MigrationError);
      expect((err as MigrationError).fromVersion).toBe(futureVersion);
    }
  });
});

// ─── parseStoredConversation ──────────────────────────────────────────────────

describe('parseStoredConversation', () => {
  it('returns null for null input', () => {
    expect(parseStoredConversation(null)).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(parseStoredConversation('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseStoredConversation('{not valid json')).toBeNull();
  });

  it('parses a bare (legacy version 0) Conversation object', () => {
    const conv = makeConversation({ id: 'legacy', title: 'Old data' });
    // A bare Conversation with no envelope — this is what pre-envelope builds stored.
    const raw = JSON.stringify(conv);
    const result = parseStoredConversation(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('legacy');
    expect(result!.title).toBe('Old data');
  });

  it('parses a StoredConversation envelope at current version (fast path)', () => {
    const conv = makeConversation({ id: 'current', title: 'Wrapped conv' });
    const envelope = { schemaVersion: CURRENT_SCHEMA_VERSION, data: conv };
    const raw = JSON.stringify(envelope);
    const result = parseStoredConversation(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('current');
    expect(result!.title).toBe('Wrapped conv');
  });

  it('parses a StoredConversation envelope at version 0 and migrates it', () => {
    // Simulate a record written at version 0 but wrapped in an envelope.
    // (This would happen if the envelope had been introduced at v0 — the
    // migration from v0→1 is identity, so the data comes through unchanged.)
    const conv = makeConversation({ id: 'v0-wrapped', title: 'Version 0 wrapped' });
    const envelope = { schemaVersion: 0, data: conv };
    const raw = JSON.stringify(envelope);
    const result = parseStoredConversation(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('v0-wrapped');
    expect(result!.title).toBe('Version 0 wrapped');
  });

  it('returns null and logs a warning when the envelope version is from the future', () => {
    const conv = makeConversation();
    const futureVersion = CURRENT_SCHEMA_VERSION + 1;
    const envelope = { schemaVersion: futureVersion, data: conv };
    const raw = JSON.stringify(envelope);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseStoredConversation(raw);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[Vault]');
    warnSpy.mockRestore();
  });

  it('does not throw when envelope data field is null (falls through to legacy path)', () => {
    // When data is null, isStoredConversationEnvelope returns false (isObject(null) = false).
    // The whole value falls to the legacy path — migrateConversation receives the
    // full parsed object (which IS a non-null object), so it returns it without throwing.
    // The key contract: parseStoredConversation never throws, regardless of data shape.
    const badEnvelope = { schemaVersion: CURRENT_SCHEMA_VERSION, data: null };
    const raw = JSON.stringify(badEnvelope);
    expect(() => parseStoredConversation(raw)).not.toThrow();
  });

  it('returns null and warns when the bare legacy value is not an object (e.g. a number)', () => {
    const raw = JSON.stringify(42);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseStoredConversation(raw);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('[Vault]');
    warnSpy.mockRestore();
  });

  it('returns null and warns when the bare legacy value is an array', () => {
    const raw = JSON.stringify([1, 2, 3]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseStoredConversation(raw);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

// ─── LocalStorageProvider integration with migration ─────────────────────────

describe('LocalStorageProvider — envelope write/read roundtrip', () => {
  it('writes a StoredConversation envelope and reads back the Conversation', async () => {
    const conv = makeConversation({ id: 'roundtrip', title: 'Roundtrip test' });
    await provider.saveConversation(conv);

    // Verify the raw stored value is an envelope, not a bare Conversation.
    const rawStored = store.get('roundtable:conv:roundtrip');
    expect(rawStored).toBeDefined();
    const parsed = JSON.parse(rawStored!);
    expect(parsed).toHaveProperty('schemaVersion', CURRENT_SCHEMA_VERSION);
    expect(parsed).toHaveProperty('data');
    expect(parsed.data.id).toBe('roundtrip');

    // Verify loadConversation returns the unwrapped Conversation.
    const loaded = await provider.loadConversation('roundtrip');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('roundtrip');
    expect(loaded!.title).toBe('Roundtrip test');
  });

  it('reads a legacy bare Conversation (version 0) from localStorage and migrates it', async () => {
    // Simulate data written by an old build (bare Conversation, no envelope).
    const conv = makeConversation({ id: 'legacy-load', title: 'Legacy' });
    store.set('roundtable:conv:legacy-load', JSON.stringify(conv));
    store.set('roundtable:index', JSON.stringify(['legacy-load']));

    const loaded = await provider.loadConversation('legacy-load');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('legacy-load');
    expect(loaded!.title).toBe('Legacy');
  });

  it('lists conversations including those stored as legacy bare objects', async () => {
    // Mix of legacy and new-format records.
    const legacy = makeConversation({ id: 'legacy', updatedAt: 1000 });
    const newFmt = makeConversation({ id: 'new-fmt', updatedAt: 2000 });

    // Write legacy directly (bare object, no envelope).
    store.set('roundtable:conv:legacy', JSON.stringify(legacy));
    // Write new-format via provider (produces envelope).
    await provider.saveConversation(newFmt);
    // Include legacy in index.
    const index = JSON.parse(store.get('roundtable:index')!);
    if (!index.includes('legacy')) {
      index.push('legacy');
      store.set('roundtable:index', JSON.stringify(index));
    }

    const list = await provider.listConversations();
    expect(list).toHaveLength(2);

    // Both IDs should appear.
    const ids = list.map((c) => c.id);
    expect(ids).toContain('legacy');
    expect(ids).toContain('new-fmt');

    // Sorted newest-first.
    expect(list[0].id).toBe('new-fmt');
    expect(list[1].id).toBe('legacy');
  });

  it('ghost-mode: saveConversation with isGhost=true writes no envelope to storage', async () => {
    const ghost = makeConversation({ id: 'ghost', isGhost: true });
    await provider.saveConversation(ghost);

    // No data key should exist.
    expect(store.has('roundtable:conv:ghost')).toBe(false);
    // Index should be empty.
    expect(store.has('roundtable:index')).toBe(false);
  });

  it('re-writing a conversation updates the envelope in place', async () => {
    const conv = makeConversation({ id: 'update-test', title: 'First' });
    await provider.saveConversation(conv);
    await provider.saveConversation({ ...conv, title: 'Second' });

    const loaded = await provider.loadConversation('update-test');
    expect(loaded!.title).toBe('Second');

    // Still wrapped in an envelope.
    const rawStored = store.get('roundtable:conv:update-test');
    const parsed = JSON.parse(rawStored!);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.data.title).toBe('Second');
  });

  it('archiveConversation reads and re-writes via envelope', async () => {
    const conv = makeConversation({ id: 'archive-test' });
    await provider.saveConversation(conv);
    await provider.archiveConversation('archive-test');

    const loaded = await provider.loadConversation('archive-test');
    expect(loaded!.archivedAt).toBeDefined();

    // Still wrapped in envelope after archive.
    const rawStored = store.get('roundtable:conv:archive-test');
    const parsed = JSON.parse(rawStored!);
    expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.data.archivedAt).toBeDefined();
  });
});
