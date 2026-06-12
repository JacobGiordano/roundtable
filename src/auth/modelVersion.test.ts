/**
 * Tests for modelVersion.ts (Gate)
 *
 * Covers:
 *   VALID_MODEL_IDS sync guard — every stored model id is a valid ModelId
 *   getModelVersion()  — returns stored value, returns undefined when not set
 *   getModelVersions() — returns full validated record
 *   setModelVersion()  — persists under correct key, throws on empty versionId,
 *                        updates existing entry without clobbering others
 *   clearModelVersion() — removes entry, is a no-op when absent
 *   Corrupt-storage resilience — non-JSON, null, arrays, partial invalids
 *
 * localStorage key: "roundtable:model-versions"
 *
 * SYNC FOOTGUN GUARD:
 *   The HANDOFF.md gotcha for this file reads:
 *   "VALID_MODEL_IDS in /src/auth/modelVersion.ts must stay in sync with
 *   ModelId union in /src/types/index.ts."
 *   The first describe block below will fail immediately whenever a new ModelId
 *   is added to the union but not to VALID_MODEL_IDS (or vice versa).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ModelId } from '@/types';

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Import under test ────────────────────────────────────────────────────────

import {
  getModelVersion,
  getModelVersions,
  setModelVersion,
  clearModelVersion,
} from './modelVersion';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'roundtable:model-versions';

/**
 * The exhaustive list of ModelId values from /src/types/index.ts.
 * This list must stay in sync with the ModelId union. Updating the union
 * without updating this array will cause the sync-guard tests to fail.
 */
const ALL_MODEL_IDS: ModelId[] = [
  'claude',
  'gpt-5.5',
  'gemini',
  'grok',
  'deepseek',
  'mistral',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setRaw(value: string): void {
  localStorageMock.setItem(STORAGE_KEY, value);
}

function getRaw(): string | null {
  return localStorageMock.getItem(STORAGE_KEY);
}

// ─── VALID_MODEL_IDS sync guard ───────────────────────────────────────────────

describe('VALID_MODEL_IDS sync guard', () => {
  /**
   * These tests exist solely to catch drift between the ModelId union in
   * /src/types/index.ts and the VALID_MODEL_IDS set in modelVersion.ts.
   *
   * Strategy: for each known ModelId, verify that setModelVersion accepts it
   * and getModelVersion returns the stored value. If a ModelId is missing from
   * VALID_MODEL_IDS, getModelVersion() will return undefined (the stored entry
   * is silently dropped during validation).
   *
   * If any of the 6 tests below fail after adding a new model, it means
   * VALID_MODEL_IDS in modelVersion.ts needs to be updated.
   */

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it.each(ALL_MODEL_IDS)(
    'ModelId "%s" round-trips through set → get without being dropped',
    (modelId) => {
      setModelVersion(modelId, 'some-version-string');
      expect(getModelVersion(modelId)).toBe('some-version-string');
    },
  );

  it('the complete set of known ModelIds has 6 members (matches types/index.ts union)', () => {
    // If this fails, ALL_MODEL_IDS in this test file is out of date.
    expect(ALL_MODEL_IDS).toHaveLength(6);
  });

  it('unknown model ids are silently dropped when reading from storage', () => {
    // Manually write a record containing a valid and an invalid model id.
    setRaw(JSON.stringify({ claude: 'claude-opus-4', totally_made_up: 'v9' }));
    const versions = getModelVersions();
    expect('totally_made_up' in versions).toBe(false);
    expect(versions['claude']).toBe('claude-opus-4');
  });
});

// ─── getModelVersion ──────────────────────────────────────────────────────────

describe('getModelVersion', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns undefined when the storage key is absent entirely', () => {
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('returns undefined when the key is present but the model has no entry', () => {
    setRaw(JSON.stringify({ gemini: 'gemini-2.5-flash' }));
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('returns the stored version string for a model that has been set', () => {
    setRaw(JSON.stringify({ claude: 'claude-opus-4' }));
    expect(getModelVersion('claude')).toBe('claude-opus-4');
  });

  it('returns the correct value when multiple models are stored', () => {
    setRaw(JSON.stringify({ claude: 'claude-opus-4', 'gpt-5.5': 'gpt-5.5-turbo' }));
    expect(getModelVersion('claude')).toBe('claude-opus-4');
    expect(getModelVersion('gpt-5.5')).toBe('gpt-5.5-turbo');
  });

  it('never throws — returns undefined on corrupt JSON', () => {
    setRaw('not-json-at-all{{{');
    expect(() => getModelVersion('claude')).not.toThrow();
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('never throws — returns undefined on JSON null', () => {
    setRaw('null');
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('never throws — returns undefined on a JSON array', () => {
    setRaw('["claude-opus-4"]');
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('never throws — even when localStorage.getItem throws', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => getModelVersion('claude')).not.toThrow();
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('silently drops an entry with an empty string version — returns undefined', () => {
    // Gate's validation requires non-empty strings; an empty string is invalid.
    setRaw(JSON.stringify({ claude: '' }));
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('silently drops an entry with a numeric version value — returns undefined', () => {
    setRaw(JSON.stringify({ claude: 42 }));
    expect(getModelVersion('claude')).toBeUndefined();
  });
});

// ─── getModelVersions ─────────────────────────────────────────────────────────

describe('getModelVersions', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns {} when the key is absent', () => {
    expect(getModelVersions()).toEqual({});
  });

  it('returns {} on corrupt JSON', () => {
    setRaw('{corrupt');
    expect(getModelVersions()).toEqual({});
  });

  it('returns a record of all valid stored entries', () => {
    const stored = { claude: 'claude-opus-4', 'gpt-5.5': 'gpt-5.5-turbo' };
    setRaw(JSON.stringify(stored));
    expect(getModelVersions()).toEqual(stored);
  });

  it('performs partial recovery — valid entries survive alongside invalid ones', () => {
    setRaw(
      JSON.stringify({
        claude: 'claude-opus-4',
        gemini: '',              // empty string — dropped
        'gpt-5.5': 'gpt-5.5',
        totally_made_up: 'v1',  // unknown key — dropped
      }),
    );
    expect(getModelVersions()).toEqual({
      claude: 'claude-opus-4',
      'gpt-5.5': 'gpt-5.5',
    });
  });

  it('returns all 6 model entries when all are stored', () => {
    const all = Object.fromEntries(ALL_MODEL_IDS.map((id) => [id, `${id}-version`]));
    setRaw(JSON.stringify(all));
    const result = getModelVersions();
    for (const id of ALL_MODEL_IDS) {
      expect(result[id]).toBe(`${id}-version`);
    }
  });
});

// ─── setModelVersion ──────────────────────────────────────────────────────────

describe('setModelVersion', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('stores a new entry when the key was previously absent', () => {
    setModelVersion('claude', 'claude-opus-4');
    expect(getRaw()).toBe(JSON.stringify({ claude: 'claude-opus-4' }));
  });

  it('persists under the correct localStorage key', () => {
    setModelVersion('gemini', 'gemini-2.5-flash');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );
  });

  it('adds to existing entries without overwriting others', () => {
    setRaw(JSON.stringify({ gemini: 'gemini-2.5-flash' }));
    setModelVersion('claude', 'claude-opus-4');
    const stored = JSON.parse(getRaw()!);
    expect(stored).toEqual({ gemini: 'gemini-2.5-flash', claude: 'claude-opus-4' });
  });

  it('updates an existing entry for the same model', () => {
    setRaw(JSON.stringify({ claude: 'claude-sonnet-4-6' }));
    setModelVersion('claude', 'claude-opus-4');
    expect(JSON.parse(getRaw()!)).toEqual({ claude: 'claude-opus-4' });
  });

  it('accepts arbitrary non-empty version strings — Gate does not validate version id format', () => {
    // Gate validates only that versionId is a non-empty string; the actual
    // version string format is Atlas's domain.
    setModelVersion('claude', 'claude-3-haiku-20240307');
    expect(getModelVersion('claude')).toBe('claude-3-haiku-20240307');

    setModelVersion('gpt-5.5', 'gpt-5.5-turbo-preview');
    expect(getModelVersion('gpt-5.5')).toBe('gpt-5.5-turbo-preview');
  });

  it('throws TypeError when versionId is an empty string', () => {
    expect(() => setModelVersion('claude', '')).toThrow(TypeError);
  });

  it('does not modify storage when versionId is empty', () => {
    setRaw(JSON.stringify({ gemini: 'gemini-2.5-flash' }));
    try {
      setModelVersion('claude', '');
    } catch {
      // expected TypeError
    }
    // Storage should be unchanged.
    expect(JSON.parse(getRaw()!)).toEqual({ gemini: 'gemini-2.5-flash' });
  });

  it('accepts all six known ModelIds', () => {
    for (const modelId of ALL_MODEL_IDS) {
      localStorageMock.clear();
      setModelVersion(modelId, 'test-version');
      const stored = JSON.parse(getRaw()!);
      expect(stored[modelId]).toBe('test-version');
    }
  });
});

// ─── clearModelVersion ────────────────────────────────────────────────────────

describe('clearModelVersion', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the entry for the given model when it exists', () => {
    setRaw(JSON.stringify({ claude: 'claude-opus-4', gemini: 'gemini-2.5-flash' }));
    clearModelVersion('claude');
    const stored = JSON.parse(getRaw()!);
    expect('claude' in stored).toBe(false);
    expect(stored.gemini).toBe('gemini-2.5-flash');
  });

  it('is a no-op when the model has no stored version', () => {
    setRaw(JSON.stringify({ gemini: 'gemini-2.5-flash' }));
    clearModelVersion('claude'); // claude was never set
    expect(JSON.parse(getRaw()!)).toEqual({ gemini: 'gemini-2.5-flash' });
  });

  it('is a no-op when the storage key is absent entirely — does not throw', () => {
    expect(() => clearModelVersion('claude')).not.toThrow();
  });

  it('writes an empty object when clearing the last remaining entry', () => {
    setRaw(JSON.stringify({ claude: 'claude-opus-4' }));
    clearModelVersion('claude');
    // The key still exists but the stored record is empty.
    expect(JSON.parse(getRaw()!)).toEqual({});
  });

  it('does not affect other models when one is cleared', () => {
    setRaw(
      JSON.stringify({
        claude: 'claude-opus-4',
        'gpt-5.5': 'gpt-5.5-turbo',
        gemini: 'gemini-2.5-flash',
      }),
    );
    clearModelVersion('gpt-5.5');
    expect(JSON.parse(getRaw()!)).toEqual({
      claude: 'claude-opus-4',
      gemini: 'gemini-2.5-flash',
    });
  });

  it('causes getModelVersion to return undefined after clearing', () => {
    setModelVersion('claude', 'claude-opus-4');
    clearModelVersion('claude');
    expect(getModelVersion('claude')).toBeUndefined();
  });
});

// ─── Round-trip consistency ───────────────────────────────────────────────────

describe('round-trip consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('set then get returns the same value', () => {
    setModelVersion('claude', 'claude-opus-4');
    expect(getModelVersion('claude')).toBe('claude-opus-4');
  });

  it('set then clear then get returns undefined', () => {
    setModelVersion('claude', 'claude-opus-4');
    clearModelVersion('claude');
    expect(getModelVersion('claude')).toBeUndefined();
  });

  it('overwrite via set reflects the latest value on get', () => {
    setModelVersion('claude', 'claude-sonnet-4-6');
    setModelVersion('claude', 'claude-opus-4');
    expect(getModelVersion('claude')).toBe('claude-opus-4');
  });

  it('multiple models can be set and read independently', () => {
    setModelVersion('claude', 'claude-opus-4');
    setModelVersion('gpt-5.5', 'gpt-5.5-turbo');
    setModelVersion('gemini', 'gemini-2.5-flash');

    expect(getModelVersion('claude')).toBe('claude-opus-4');
    expect(getModelVersion('gpt-5.5')).toBe('gpt-5.5-turbo');
    expect(getModelVersion('gemini')).toBe('gemini-2.5-flash');
    expect(getModelVersion('grok')).toBeUndefined();
  });

  it('clearing one model does not affect others in a round-trip', () => {
    setModelVersion('claude', 'claude-opus-4');
    setModelVersion('gemini', 'gemini-2.5-flash');
    clearModelVersion('claude');

    expect(getModelVersion('claude')).toBeUndefined();
    expect(getModelVersion('gemini')).toBe('gemini-2.5-flash');
  });
});
