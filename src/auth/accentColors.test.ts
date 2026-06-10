/**
 * Tests for accentColors.ts
 *
 * Covers: read validation, write validation, clear (single), clear (all),
 * edge cases (corrupt storage, partial corruption, missing key).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    _store: store,
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
} from './accentColors';

const STORAGE_KEY = 'roundtable:model-accent-colors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setRaw(value: string): void {
  localStorageMock.setItem(STORAGE_KEY, value);
}

function getRaw(): string | null {
  return localStorageMock.getItem(STORAGE_KEY);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getModelAccentColors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns {} when the key is absent', () => {
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} when the stored value is not valid JSON', () => {
    setRaw('not-json-at-all');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} when the stored value is JSON null', () => {
    setRaw('null');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} when the stored value is a JSON array', () => {
    setRaw('["#FF0000"]');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} when the stored value is a JSON primitive', () => {
    setRaw('"#FF0000"');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns {} when the stored value is an empty object', () => {
    setRaw('{}');
    expect(getModelAccentColors()).toEqual({});
  });

  it('returns valid entries for all known ModelIds', () => {
    const colors = {
      claude: '#F59E0B',
      'gpt-5.5': '#14B8A6',
      gemini: '#8B5CF6',
      grok: '#38B2D8',
      deepseek: '#4468D0',
      mistral: '#E0568A',
    };
    setRaw(JSON.stringify(colors));
    expect(getModelAccentColors()).toEqual(colors);
  });

  it('silently drops entries with an invalid (unknown) model id key', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B', unknown_model: '#AABBCC' }));
    expect(getModelAccentColors()).toEqual({ claude: '#F59E0B' });
  });

  it('silently drops entries with a value that is not a hex string', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B', gemini: 'violet' }));
    expect(getModelAccentColors()).toEqual({ claude: '#F59E0B' });
  });

  it('silently drops entries with a 3-digit hex value', () => {
    setRaw(JSON.stringify({ claude: '#F59' }));
    expect(getModelAccentColors()).toEqual({});
  });

  it('silently drops entries with an 8-digit hex value', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B00' }));
    expect(getModelAccentColors()).toEqual({});
  });

  it('silently drops entries with a hex missing the # prefix', () => {
    setRaw(JSON.stringify({ claude: 'F59E0B' }));
    expect(getModelAccentColors()).toEqual({});
  });

  it('accepts lowercase hex letters', () => {
    setRaw(JSON.stringify({ claude: '#f59e0b' }));
    expect(getModelAccentColors()).toEqual({ claude: '#f59e0b' });
  });

  it('accepts uppercase hex letters', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B' }));
    expect(getModelAccentColors()).toEqual({ claude: '#F59E0B' });
  });

  it('accepts mixed-case hex letters', () => {
    setRaw(JSON.stringify({ claude: '#F59e0B' }));
    expect(getModelAccentColors()).toEqual({ claude: '#F59e0B' });
  });

  it('performs partial recovery — valid entries survive alongside invalid ones', () => {
    setRaw(
      JSON.stringify({
        claude: '#F59E0B',
        gemini: 'notahex',
        'gpt-5.5': '#14B8A6',
        made_up_model: '#FFFFFF',
      })
    );
    expect(getModelAccentColors()).toEqual({
      claude: '#F59E0B',
      'gpt-5.5': '#14B8A6',
    });
  });

  it('never throws — even when localStorage.getItem throws', () => {
    localStorageMock.getItem.mockImplementationOnce(() => {
      throw new Error('storage access denied');
    });
    expect(() => getModelAccentColors()).not.toThrow();
    expect(getModelAccentColors()).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('setModelAccentColor', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('stores a new entry when the key was previously absent', () => {
    setModelAccentColor('claude', '#F59E0B');
    expect(getRaw()).toBe(JSON.stringify({ claude: '#F59E0B' }));
  });

  it('adds to existing entries without overwriting others', () => {
    setRaw(JSON.stringify({ gemini: '#8B5CF6' }));
    setModelAccentColor('claude', '#F59E0B');
    const stored = JSON.parse(getRaw()!);
    expect(stored).toEqual({ gemini: '#8B5CF6', claude: '#F59E0B' });
  });

  it('updates an existing entry for the same model', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B' }));
    setModelAccentColor('claude', '#14B8A6');
    expect(getRaw()).toBe(JSON.stringify({ claude: '#14B8A6' }));
  });

  it('throws TypeError when the hex value is invalid (no # prefix)', () => {
    expect(() => setModelAccentColor('claude', 'F59E0B')).toThrow(TypeError);
  });

  it('throws TypeError when the hex value is a 3-digit hex', () => {
    expect(() => setModelAccentColor('claude', '#F59')).toThrow(TypeError);
  });

  it('throws TypeError when the hex value is an empty string', () => {
    expect(() => setModelAccentColor('claude', '')).toThrow(TypeError);
  });

  it('throws TypeError when the hex value is a color name', () => {
    expect(() => setModelAccentColor('claude', 'violet')).toThrow(TypeError);
  });

  it('throws TypeError when the hex value contains invalid characters', () => {
    expect(() => setModelAccentColor('claude', '#GGGGGG')).toThrow(TypeError);
  });

  it('does not modify storage when hex validation fails', () => {
    setRaw(JSON.stringify({ gemini: '#8B5CF6' }));
    try {
      setModelAccentColor('claude', 'bad-hex');
    } catch {
      // expected
    }
    expect(getRaw()).toBe(JSON.stringify({ gemini: '#8B5CF6' }));
  });

  it('accepts a lowercase hex value', () => {
    setModelAccentColor('claude', '#f59e0b');
    expect(getRaw()).toBe(JSON.stringify({ claude: '#f59e0b' }));
  });

  it('accepts all six known ModelIds', () => {
    const models = ['claude', 'gpt-5.5', 'gemini', 'grok', 'deepseek', 'mistral'] as const;
    for (const modelId of models) {
      localStorageMock.clear();
      setModelAccentColor(modelId, '#AABBCC');
      const stored = JSON.parse(getRaw()!);
      expect(stored[modelId]).toBe('#AABBCC');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('clearModelAccentColor', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the entry for the given model when it exists', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B', gemini: '#8B5CF6' }));
    clearModelAccentColor('claude');
    const stored = JSON.parse(getRaw()!);
    expect(stored).toEqual({ gemini: '#8B5CF6' });
    expect('claude' in stored).toBe(false);
  });

  it('is a no-op when the model has no stored color', () => {
    setRaw(JSON.stringify({ gemini: '#8B5CF6' }));
    clearModelAccentColor('claude'); // claude was never set
    expect(JSON.parse(getRaw()!)).toEqual({ gemini: '#8B5CF6' });
  });

  it('is a no-op when the storage key is absent entirely', () => {
    expect(() => clearModelAccentColor('claude')).not.toThrow();
  });

  it('writes an empty object when clearing the last remaining entry', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B' }));
    clearModelAccentColor('claude');
    // Key still exists in storage, but contains an empty object.
    expect(JSON.parse(getRaw()!)).toEqual({});
  });

  it('does not affect other models', () => {
    setRaw(
      JSON.stringify({
        claude: '#F59E0B',
        'gpt-5.5': '#14B8A6',
        gemini: '#8B5CF6',
      })
    );
    clearModelAccentColor('gpt-5.5');
    expect(JSON.parse(getRaw()!)).toEqual({
      claude: '#F59E0B',
      gemini: '#8B5CF6',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('clearAllModelAccentColors', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the storage key entirely', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B', gemini: '#8B5CF6' }));
    clearAllModelAccentColors();
    expect(getRaw()).toBeNull();
  });

  it('is a no-op when the key was never set', () => {
    expect(() => clearAllModelAccentColors()).not.toThrow();
    expect(getRaw()).toBeNull();
  });

  it('causes getModelAccentColors to return {} after clearing', () => {
    setRaw(JSON.stringify({ claude: '#F59E0B' }));
    clearAllModelAccentColors();
    expect(getModelAccentColors()).toEqual({});
  });

  it('does not affect other localStorage keys', () => {
    localStorageMock.setItem('roundtable:theme', 'slate');
    setRaw(JSON.stringify({ claude: '#F59E0B' }));
    clearAllModelAccentColors();
    expect(localStorageMock.getItem('roundtable:theme')).toBe('slate');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('round-trip consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('set then get returns the same value', () => {
    setModelAccentColor('claude', '#F59E0B');
    expect(getModelAccentColors()).toEqual({ claude: '#F59E0B' });
  });

  it('set then clear then get returns {} for that model', () => {
    setModelAccentColor('claude', '#F59E0B');
    clearModelAccentColor('claude');
    expect(getModelAccentColors()).toEqual({});
  });

  it('set multiple, clearAll, then get returns {}', () => {
    setModelAccentColor('claude', '#F59E0B');
    setModelAccentColor('gemini', '#8B5CF6');
    clearAllModelAccentColors();
    expect(getModelAccentColors()).toEqual({});
  });

  it('overwrite via set reflects the latest value on get', () => {
    setModelAccentColor('claude', '#F59E0B');
    setModelAccentColor('claude', '#14B8A6');
    expect(getModelAccentColors()).toEqual({ claude: '#14B8A6' });
  });
});
