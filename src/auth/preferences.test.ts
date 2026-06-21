/**
 * Gate — preferences.test.ts
 *
 * Tests for:
 *   - getUserPreferences() — returns stored value or defaults
 *   - saveUserPreferences() — persists under canonical key
 *
 * Migration tests:
 *   - Old key (roundtable_user_preferences) is read, migrated to canonical
 *     key (roundtable:user-preferences), old key deleted, value returned
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
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Import under test ────────────────────────────────────────────────────────

import { getUserPreferences, saveUserPreferences } from './preferences';

// ─── Key name constants ───────────────────────────────────────────────────────

const CANONICAL_KEY = 'roundtable:user-preferences';
const LEGACY_KEY = 'roundtable_user_preferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setCanonical(value: object): void {
  localStorageMock.setItem(CANONICAL_KEY, JSON.stringify(value));
}

function setLegacy(value: object): void {
  localStorageMock.setItem(LEGACY_KEY, JSON.stringify(value));
}

function getCanonicalRaw(): string | null {
  return localStorageMock.getItem(CANONICAL_KEY);
}

function getLegacyRaw(): string | null {
  return localStorageMock.getItem(LEGACY_KEY);
}

// ─── getUserPreferences ───────────────────────────────────────────────────────

describe('getUserPreferences', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns default preferences when nothing is stored', () => {
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'active' });
  });

  it('returns stored value from canonical key', () => {
    setCanonical({ tokenCountVisibility: 'always' });
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'always' });
  });

  it('returns stored value "never" from canonical key', () => {
    setCanonical({ tokenCountVisibility: 'never' });
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'never' });
  });

  it('returns default on corrupt JSON in canonical key', () => {
    localStorageMock.setItem(CANONICAL_KEY, 'not-valid-json{{{');
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'active' });
  });

  it('returns default on unrecognised tokenCountVisibility value', () => {
    setCanonical({ tokenCountVisibility: 'sometimes' });
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'active' });
  });

  // ─── Migration path ─────────────────────────────────────────────────────────

  it('migrates legacy roundtable_user_preferences to roundtable:user-preferences on read', () => {
    setLegacy({ tokenCountVisibility: 'always' });

    const prefs = getUserPreferences();

    expect(prefs).toEqual({ tokenCountVisibility: 'always' });
    // New key should now have the value.
    expect(getCanonicalRaw()).toBe(JSON.stringify({ tokenCountVisibility: 'always' }));
    // Old key should be gone.
    expect(getLegacyRaw()).toBeNull();
  });

  it('migrates legacy "never" value correctly', () => {
    setLegacy({ tokenCountVisibility: 'never' });

    const prefs = getUserPreferences();

    expect(prefs).toEqual({ tokenCountVisibility: 'never' });
    expect(getCanonicalRaw()).not.toBeNull();
    expect(getLegacyRaw()).toBeNull();
  });

  it('returns default when legacy key has corrupt JSON (and migrates nothing)', () => {
    localStorageMock.setItem(LEGACY_KEY, 'bad-json');
    // Still migrates the raw value to canonical, then returns default.
    const prefs = getUserPreferences();
    expect(prefs).toEqual({ tokenCountVisibility: 'active' });
  });

  it('prefers canonical key over legacy key when both exist', () => {
    setCanonical({ tokenCountVisibility: 'always' });
    setLegacy({ tokenCountVisibility: 'never' });

    const prefs = getUserPreferences();

    expect(prefs).toEqual({ tokenCountVisibility: 'always' });
    // Legacy key should NOT be removed when canonical is present.
    expect(getLegacyRaw()).not.toBeNull();
  });

  it('does not write to storage when canonical key is already set', () => {
    setCanonical({ tokenCountVisibility: 'always' });
    vi.clearAllMocks();

    getUserPreferences();

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ─── saveUserPreferences ──────────────────────────────────────────────────────

describe('saveUserPreferences', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('persists under the canonical key roundtable:user-preferences', () => {
    saveUserPreferences({ tokenCountVisibility: 'always' });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      CANONICAL_KEY,
      JSON.stringify({ tokenCountVisibility: 'always' }),
    );
  });

  it('overwrites an existing value', () => {
    saveUserPreferences({ tokenCountVisibility: 'always' });
    saveUserPreferences({ tokenCountVisibility: 'never' });
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'never' });
  });

  it('does not write to the legacy key location', () => {
    saveUserPreferences({ tokenCountVisibility: 'always' });
    expect(getLegacyRaw()).toBeNull();
  });
});

// ─── Round-trip consistency ───────────────────────────────────────────────────

describe('round-trip consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('save then get returns the same value', () => {
    saveUserPreferences({ tokenCountVisibility: 'never' });
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'never' });
  });

  it('all three TokenCountVisibility values round-trip correctly', () => {
    const values = ['always', 'active', 'never'] as const;
    for (const visibility of values) {
      saveUserPreferences({ tokenCountVisibility: visibility });
      expect(getUserPreferences()).toEqual({ tokenCountVisibility: visibility });
    }
  });

  it('legacy key migration round-trip: value survives migration intact', () => {
    setLegacy({ tokenCountVisibility: 'always' });
    const first = getUserPreferences();
    expect(first).toEqual({ tokenCountVisibility: 'always' });
    // Subsequent reads come from canonical key.
    expect(getUserPreferences()).toEqual({ tokenCountVisibility: 'always' });
    expect(getLegacyRaw()).toBeNull();
  });
});
