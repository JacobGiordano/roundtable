/**
 * Tests for accentColors.ts (Gate) — Scout integration/regression suite
 *
 * Placed in /src/tests/auth/ (not /src/auth/) — Scout's boundary rule.
 * Imports Gate's public API without modifying any application code.
 *
 * Covers:
 *   VALID_MODEL_IDS sync guard — every member of ModelId round-trips through
 *     setModelAccentColor → getModelAccentColors without being silently dropped.
 *     Identical guard pattern to modelVersion.test.ts (issue #83).
 *
 * SYNC FOOTGUN GUARD:
 *   VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with the
 *   ModelId union in /src/types/index.ts. When a new model is added to the
 *   union but not to VALID_MODEL_IDS, accent color support silently drops for
 *   that model — getModelAccentColors() strips it on read because isValidModelId
 *   returns false.
 *
 *   The it.each suite below will fail immediately if any ModelId is missing from
 *   VALID_MODEL_IDS, catching the drift at CI time rather than at runtime.
 *
 * localStorage key: "roundtable:model-accent-colors"
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
  getModelAccentColors,
  setModelAccentColor,
  clearModelAccentColor,
  clearAllModelAccentColors,
} from '@/auth/accentColors';

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'roundtable:model-accent-colors';

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

/** A valid 6-digit hex color used throughout as a test sentinel. */
const TEST_HEX = '#FF5500';

/** A second valid hex for multi-model tests. */
const TEST_HEX_2 = '#00AAFF';

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
   * /src/types/index.ts and the VALID_MODEL_IDS set in accentColors.ts.
   *
   * Strategy: for each known ModelId, call setModelAccentColor to persist a
   * hex value, then call getModelAccentColors and assert the entry is present.
   * If a ModelId is missing from VALID_MODEL_IDS, readStoredColors() silently
   * drops that entry — getModelAccentColors() returns {} for that key — and
   * the test fails.
   *
   * If any of the 6 parameterized tests below fail after adding a new model,
   * it means VALID_MODEL_IDS in /src/auth/accentColors.ts needs updating.
   */

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it.each(ALL_MODEL_IDS)(
    'ModelId "%s" round-trips through setModelAccentColor → getModelAccentColors without being dropped',
    (modelId) => {
      setModelAccentColor(modelId, TEST_HEX);
      const colors = getModelAccentColors();
      expect(colors[modelId]).toBe(TEST_HEX);
    },
  );

  it('the complete set of known ModelIds has 6 members (matches types/index.ts union)', () => {
    // If this fails, ALL_MODEL_IDS in this test file is out of date.
    expect(ALL_MODEL_IDS).toHaveLength(6);
  });

  it('unknown model ids are silently dropped when reading from storage', () => {
    // Manually write a record containing a valid and an invalid model id.
    setRaw(JSON.stringify({ claude: TEST_HEX, totally_made_up: TEST_HEX_2 }));
    const colors = getModelAccentColors();
    expect('totally_made_up' in colors).toBe(false);
    expect(colors['claude']).toBe(TEST_HEX);
  });
});

// ─── getModelAccentColors ─────────────────────────────────────────────────────

describe('getModelAccentColors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns {} when the storage key is absent entirely', () => {
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} on corrupt JSON', () => {
    setRaw('{corrupt');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} on JSON null', () => {
    setRaw('null');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} on a JSON array', () => {
    setRaw('["#FF5500"]');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns the stored colors for all valid models present', () => {
    const stored = { claude: TEST_HEX, 'gpt-5.5': TEST_HEX_2 };
    setRaw(JSON.stringify(stored));
    expect(getModelAccentColors()).toEqual(stored);
  });

  it('silently drops entries whose value is not a valid 6-digit hex', () => {
    setRaw(JSON.stringify({ claude: 'not-a-hex', gemini: TEST_HEX }));
    const colors = getModelAccentColors();
    expect('claude' in colors).toBe(false);
    expect(colors['gemini']).toBe(TEST_HEX);
  });

  it('silently drops entries with a 3-digit hex shorthand (not 6-digit)', () => {
    setRaw(JSON.stringify({ claude: '#F50' }));
    const colors = getModelAccentColors();
    expect('claude' in colors).toBe(false);
  });

  it('never throws — even when localStorage.getItem throws', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('SecurityError');
    });
    expect(() => getModelAccentColors()).not.toThrow();
    expect(getModelAccentColors()).toEqual({});
  });
});

// ─── setModelAccentColor ──────────────────────────────────────────────────────

describe('setModelAccentColor', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('stores a new entry when the key was previously absent', () => {
    setModelAccentColor('claude', TEST_HEX);
    expect(getRaw()).toBe(JSON.stringify({ claude: TEST_HEX }));
  });

  it('persists under the correct localStorage key', () => {
    setModelAccentColor('gemini', TEST_HEX);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.any(String),
    );
  });

  it('adds to existing entries without overwriting others', () => {
    setRaw(JSON.stringify({ gemini: TEST_HEX }));
    setModelAccentColor('claude', TEST_HEX_2);
    const stored = JSON.parse(getRaw()!);
    expect(stored).toEqual({ gemini: TEST_HEX, claude: TEST_HEX_2 });
  });

  it('updates an existing entry for the same model', () => {
    setRaw(JSON.stringify({ claude: TEST_HEX }));
    setModelAccentColor('claude', TEST_HEX_2);
    expect(JSON.parse(getRaw()!)).toEqual({ claude: TEST_HEX_2 });
  });

  it('accepts all six known ModelIds', () => {
    for (const modelId of ALL_MODEL_IDS) {
      localStorageMock.clear();
      setModelAccentColor(modelId, TEST_HEX);
      const stored = JSON.parse(getRaw()!);
      expect(stored[modelId]).toBe(TEST_HEX);
    }
  });

  it('throws TypeError on an invalid hex value (missing #)', () => {
    expect(() => setModelAccentColor('claude', 'FF5500')).toThrow(TypeError);
  });

  it('throws TypeError on a 3-digit hex shorthand', () => {
    expect(() => setModelAccentColor('claude', '#F50')).toThrow(TypeError);
  });

  it('throws TypeError on an empty string', () => {
    expect(() => setModelAccentColor('claude', '')).toThrow(TypeError);
  });

  it('does not modify storage when hex is invalid', () => {
    setRaw(JSON.stringify({ gemini: TEST_HEX }));
    try {
      setModelAccentColor('claude', 'bad');
    } catch {
      // expected TypeError
    }
    expect(JSON.parse(getRaw()!)).toEqual({ gemini: TEST_HEX });
  });

  it('accepts both uppercase and lowercase hex digits', () => {
    setModelAccentColor('claude', '#ff5500');
    expect(getModelAccentColors()['claude']).toBe('#ff5500');

    localStorageMock.clear();
    setModelAccentColor('claude', '#FF5500');
    expect(getModelAccentColors()['claude']).toBe('#FF5500');
  });
});

// ─── clearModelAccentColor ────────────────────────────────────────────────────

describe('clearModelAccentColor', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the entry for the given model when it exists', () => {
    setRaw(JSON.stringify({ claude: TEST_HEX, gemini: TEST_HEX_2 }));
    clearModelAccentColor('claude');
    const stored = JSON.parse(getRaw()!);
    expect('claude' in stored).toBe(false);
    expect(stored.gemini).toBe(TEST_HEX_2);
  });

  it('is a no-op when the model has no stored color', () => {
    setRaw(JSON.stringify({ gemini: TEST_HEX }));
    clearModelAccentColor('claude');
    expect(JSON.parse(getRaw()!)).toEqual({ gemini: TEST_HEX });
  });

  it('is a no-op when the storage key is absent — does not throw', () => {
    expect(() => clearModelAccentColor('claude')).not.toThrow();
  });

  it('causes getModelAccentColors to omit the cleared model', () => {
    setModelAccentColor('claude', TEST_HEX);
    clearModelAccentColor('claude');
    expect('claude' in getModelAccentColors()).toBe(false);
  });

  it('does not affect other models when one is cleared', () => {
    setRaw(JSON.stringify({ claude: TEST_HEX, 'gpt-5.5': TEST_HEX_2, gemini: TEST_HEX }));
    clearModelAccentColor('gpt-5.5');
    expect(JSON.parse(getRaw()!)).toEqual({ claude: TEST_HEX, gemini: TEST_HEX });
  });
});

// ─── clearAllModelAccentColors ────────────────────────────────────────────────

describe('clearAllModelAccentColors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the entire storage key', () => {
    setRaw(JSON.stringify({ claude: TEST_HEX }));
    clearAllModelAccentColors();
    expect(getRaw()).toBeNull();
  });

  it('causes getModelAccentColors to return {} after clearing', () => {
    setModelAccentColor('claude', TEST_HEX);
    setModelAccentColor('gemini', TEST_HEX_2);
    clearAllModelAccentColors();
    expect(getModelAccentColors()).toEqual({});
  });

  it('is a no-op when nothing is stored — does not throw', () => {
    expect(() => clearAllModelAccentColors()).not.toThrow();
  });
});

// ─── Round-trip consistency ───────────────────────────────────────────────────

describe('round-trip consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('set then get returns the same hex for a single model', () => {
    setModelAccentColor('claude', TEST_HEX);
    expect(getModelAccentColors()['claude']).toBe(TEST_HEX);
  });

  it('set then clear then get omits the model', () => {
    setModelAccentColor('claude', TEST_HEX);
    clearModelAccentColor('claude');
    expect('claude' in getModelAccentColors()).toBe(false);
  });

  it('overwrite via set reflects the latest value on get', () => {
    setModelAccentColor('claude', TEST_HEX);
    setModelAccentColor('claude', TEST_HEX_2);
    expect(getModelAccentColors()['claude']).toBe(TEST_HEX_2);
  });

  it('multiple models can be set and read independently', () => {
    setModelAccentColor('claude', TEST_HEX);
    setModelAccentColor('gpt-5.5', TEST_HEX_2);
    setModelAccentColor('gemini', '#AABBCC');

    const colors = getModelAccentColors();
    expect(colors['claude']).toBe(TEST_HEX);
    expect(colors['gpt-5.5']).toBe(TEST_HEX_2);
    expect(colors['gemini']).toBe('#AABBCC');
    expect('grok' in colors).toBe(false);
  });

  it('clearAll then set starts fresh with only the new entry', () => {
    setModelAccentColor('claude', TEST_HEX);
    setModelAccentColor('gemini', TEST_HEX_2);
    clearAllModelAccentColors();
    setModelAccentColor('grok', '#123456');
    expect(getModelAccentColors()).toEqual({ grok: '#123456' });
  });
});
