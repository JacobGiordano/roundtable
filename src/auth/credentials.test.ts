/**
 * Gate — credentials.test.ts
 *
 * Tests for:
 *   - getCredentials()   — returns stored value, undefined when absent
 *   - saveCredentials()  — persists under canonical key roundtable:key:<key>
 *   - clearCredentials() — removes canonical key and legacy key
 *   - hasCredential()    — returns true/false, triggers migration
 *
 * Migration tests:
 *   - Old format (rt_key_<key>) is read, migrated to canonical, old key deleted
 *   - hasCredential() triggers migration via getCredentials()
 *   - clearCredentials() removes both canonical and legacy keys
 *
 * Security invariant verified by grep:
 *   - `getCredentials` is the only function that reads `roundtable:key:` values
 *   - `saveCredentials` is the only function that writes `roundtable:key:` values
 *   - No key value is ever logged or exported by this module
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
    _getStore: () => store,
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Import under test ────────────────────────────────────────────────────────

import {
  getCredentials,
  saveCredentials,
  clearCredentials,
  hasCredential,
} from './credentials';

// ─── Key name constants for test assertions ───────────────────────────────────

const CANONICAL_PREFIX = 'roundtable:key:';
const LEGACY_PREFIX = 'rt_key_';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setCanonical(credKey: string, value: string): void {
  localStorageMock.setItem(`${CANONICAL_PREFIX}${credKey}`, value);
}

function setLegacy(credKey: string, value: string): void {
  localStorageMock.setItem(`${LEGACY_PREFIX}${credKey}`, value);
}

function getCanonical(credKey: string): string | null {
  return localStorageMock.getItem(`${CANONICAL_PREFIX}${credKey}`);
}

function getLegacy(credKey: string): string | null {
  return localStorageMock.getItem(`${LEGACY_PREFIX}${credKey}`);
}

// ─── getCredentials ───────────────────────────────────────────────────────────

describe('getCredentials', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns undefined when no key is stored', () => {
    expect(getCredentials('anthropic')).toBeUndefined();
  });

  it('returns the stored value from the canonical key', () => {
    setCanonical('anthropic', 'sk-ant-test-key');
    expect(getCredentials('anthropic')).toBe('sk-ant-test-key');
  });

  it('reads from canonical key roundtable:key:anthropic', () => {
    setCanonical('anthropic', 'sk-ant-test-key');
    getCredentials('anthropic');
    expect(localStorageMock.getItem).toHaveBeenCalledWith(`${CANONICAL_PREFIX}anthropic`);
  });

  it('returns the stored value for openai', () => {
    setCanonical('openai', 'sk-openai-test');
    expect(getCredentials('openai')).toBe('sk-openai-test');
  });

  it('returns undefined for a different key when one key is set', () => {
    setCanonical('anthropic', 'sk-ant-test-key');
    expect(getCredentials('openai')).toBeUndefined();
  });

  // ─── Migration path ─────────────────────────────────────────────────────────

  it('migrates legacy rt_key_anthropic to roundtable:key:anthropic on read', () => {
    setLegacy('anthropic', 'sk-ant-legacy');

    const value = getCredentials('anthropic');

    expect(value).toBe('sk-ant-legacy');
    // New key should now have the value.
    expect(getCanonical('anthropic')).toBe('sk-ant-legacy');
    // Old key should be gone.
    expect(getLegacy('anthropic')).toBeNull();
  });

  it('migrates legacy key and returns correct value for openai', () => {
    setLegacy('openai', 'sk-openai-legacy');

    const value = getCredentials('openai');

    expect(value).toBe('sk-openai-legacy');
    expect(getCanonical('openai')).toBe('sk-openai-legacy');
    expect(getLegacy('openai')).toBeNull();
  });

  it('prefers canonical key over legacy key when both exist', () => {
    setCanonical('anthropic', 'sk-ant-canonical');
    setLegacy('anthropic', 'sk-ant-legacy');

    const value = getCredentials('anthropic');

    expect(value).toBe('sk-ant-canonical');
    // Legacy key should NOT be touched when canonical is present.
    expect(getLegacy('anthropic')).toBe('sk-ant-legacy');
  });

  it('does not write to storage when canonical key is already set', () => {
    setCanonical('anthropic', 'sk-ant-canonical');
    vi.clearAllMocks();

    getCredentials('anthropic');

    // setItem should not have been called.
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ─── saveCredentials ──────────────────────────────────────────────────────────

describe('saveCredentials', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('persists under the canonical key roundtable:key:anthropic', () => {
    saveCredentials('anthropic', 'sk-ant-new');
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      `${CANONICAL_PREFIX}anthropic`,
      'sk-ant-new',
    );
  });

  it('persists under the canonical key for openai', () => {
    saveCredentials('openai', 'sk-openai-new');
    expect(getCanonical('openai')).toBe('sk-openai-new');
  });

  it('overwrites an existing canonical value', () => {
    setCanonical('anthropic', 'sk-ant-old');
    saveCredentials('anthropic', 'sk-ant-new');
    expect(getCanonical('anthropic')).toBe('sk-ant-new');
  });

  it('does not write to the legacy key location', () => {
    saveCredentials('anthropic', 'sk-ant-new');
    expect(getLegacy('anthropic')).toBeNull();
  });
});

// ─── clearCredentials ─────────────────────────────────────────────────────────

describe('clearCredentials', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the canonical key', () => {
    setCanonical('anthropic', 'sk-ant-test');
    clearCredentials('anthropic');
    expect(getCanonical('anthropic')).toBeNull();
  });

  it('also removes the legacy key if it exists', () => {
    setLegacy('anthropic', 'sk-ant-legacy');
    clearCredentials('anthropic');
    expect(getLegacy('anthropic')).toBeNull();
  });

  it('removes both canonical and legacy keys in one call', () => {
    setCanonical('anthropic', 'sk-ant-canonical');
    setLegacy('anthropic', 'sk-ant-legacy');
    clearCredentials('anthropic');
    expect(getCanonical('anthropic')).toBeNull();
    expect(getLegacy('anthropic')).toBeNull();
  });

  it('is a no-op when no key is stored (does not throw)', () => {
    expect(() => clearCredentials('anthropic')).not.toThrow();
  });

  it('does not affect other credential keys', () => {
    setCanonical('anthropic', 'sk-ant-test');
    setCanonical('openai', 'sk-openai-test');
    clearCredentials('anthropic');
    expect(getCanonical('openai')).toBe('sk-openai-test');
  });

  it('causes getCredentials to return undefined after clearing', () => {
    setCanonical('anthropic', 'sk-ant-test');
    clearCredentials('anthropic');
    expect(getCredentials('anthropic')).toBeUndefined();
  });

  it('causes getCredentials to return undefined even when legacy existed', () => {
    setLegacy('anthropic', 'sk-ant-legacy');
    clearCredentials('anthropic');
    expect(getCredentials('anthropic')).toBeUndefined();
  });
});

// ─── hasCredential ────────────────────────────────────────────────────────────

describe('hasCredential', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns false when no key is stored', () => {
    expect(hasCredential('anthropic')).toBe(false);
  });

  it('returns true when canonical key is set', () => {
    setCanonical('anthropic', 'sk-ant-test');
    expect(hasCredential('anthropic')).toBe(true);
  });

  it('returns true when only legacy key is set (triggers migration)', () => {
    setLegacy('anthropic', 'sk-ant-legacy');
    expect(hasCredential('anthropic')).toBe(true);
  });

  it('migrates the legacy key when hasCredential is called', () => {
    setLegacy('anthropic', 'sk-ant-legacy');
    hasCredential('anthropic');
    expect(getCanonical('anthropic')).toBe('sk-ant-legacy');
    expect(getLegacy('anthropic')).toBeNull();
  });

  it('returns false after clearCredentials', () => {
    setCanonical('anthropic', 'sk-ant-test');
    clearCredentials('anthropic');
    expect(hasCredential('anthropic')).toBe(false);
  });
});

// ─── Round-trip consistency ───────────────────────────────────────────────────

describe('round-trip consistency', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('save then get returns the same value', () => {
    saveCredentials('anthropic', 'sk-ant-roundtrip');
    expect(getCredentials('anthropic')).toBe('sk-ant-roundtrip');
  });

  it('save then clear then get returns undefined', () => {
    saveCredentials('anthropic', 'sk-ant-roundtrip');
    clearCredentials('anthropic');
    expect(getCredentials('anthropic')).toBeUndefined();
  });

  it('multiple keys are independent', () => {
    saveCredentials('anthropic', 'sk-ant-test');
    saveCredentials('openai', 'sk-openai-test');
    expect(getCredentials('anthropic')).toBe('sk-ant-test');
    expect(getCredentials('openai')).toBe('sk-openai-test');
    clearCredentials('anthropic');
    expect(getCredentials('anthropic')).toBeUndefined();
    expect(getCredentials('openai')).toBe('sk-openai-test');
  });

  it('legacy key migration round-trip: value survives migration intact', () => {
    const originalValue = 'sk-ant-v2-acmefoobar1234567890';
    setLegacy('anthropic', originalValue);
    const migrated = getCredentials('anthropic');
    expect(migrated).toBe(originalValue);
    // Subsequent reads come from canonical key.
    expect(getCredentials('anthropic')).toBe(originalValue);
    expect(getLegacy('anthropic')).toBeNull();
  });
});
