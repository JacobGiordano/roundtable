/**
 * Gate — sidebarWidth.test.ts
 *
 * Tests for:
 *   - getSidebarWidth() — returns stored value or default
 *   - saveSidebarWidth() — persists under canonical key, clamps, rejects non-finite
 *
 * Migration tests:
 *   - Old key (rt-ui-sidebar-width) is read, migrated to canonical key
 *     (roundtable:ui-sidebar-width), old key deleted, value returned
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

import {
  getSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_DEFAULT,
} from './sidebarWidth';

// ─── Key name constants ───────────────────────────────────────────────────────

const CANONICAL_KEY = 'roundtable:ui-sidebar-width';
const LEGACY_KEY = 'rt-ui-sidebar-width';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setCanonical(value: number): void {
  localStorageMock.setItem(CANONICAL_KEY, String(value));
}

function setLegacy(value: number): void {
  localStorageMock.setItem(LEGACY_KEY, String(value));
}

function getCanonicalRaw(): string | null {
  return localStorageMock.getItem(CANONICAL_KEY);
}

function getLegacyRaw(): string | null {
  return localStorageMock.getItem(LEGACY_KEY);
}

// ─── getSidebarWidth ──────────────────────────────────────────────────────────

describe('getSidebarWidth', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns SIDEBAR_WIDTH_DEFAULT (280) when nothing is stored', () => {
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it('returns the stored value from the canonical key', () => {
    setCanonical(350);
    expect(getSidebarWidth()).toBe(350);
  });

  it('returns SIDEBAR_WIDTH_DEFAULT when stored value is below minimum', () => {
    setCanonical(SIDEBAR_WIDTH_MIN - 1);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it('returns SIDEBAR_WIDTH_DEFAULT when stored value is above maximum', () => {
    setCanonical(SIDEBAR_WIDTH_MAX + 1);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it('returns SIDEBAR_WIDTH_DEFAULT when stored value is not a number', () => {
    localStorageMock.setItem(CANONICAL_KEY, 'not-a-number');
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_DEFAULT);
  });

  it('accepts SIDEBAR_WIDTH_MIN as a valid value', () => {
    setCanonical(SIDEBAR_WIDTH_MIN);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_MIN);
  });

  it('accepts SIDEBAR_WIDTH_MAX as a valid value', () => {
    setCanonical(SIDEBAR_WIDTH_MAX);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_MAX);
  });

  // ─── Migration path ─────────────────────────────────────────────────────────

  it('migrates legacy rt-ui-sidebar-width to roundtable:ui-sidebar-width on read', () => {
    setLegacy(320);

    const width = getSidebarWidth();

    expect(width).toBe(320);
    // New key should now have the value.
    expect(getCanonicalRaw()).toBe('320');
    // Old key should be gone.
    expect(getLegacyRaw()).toBeNull();
  });

  it('migrates legacy value at the minimum boundary', () => {
    setLegacy(SIDEBAR_WIDTH_MIN);

    const width = getSidebarWidth();

    expect(width).toBe(SIDEBAR_WIDTH_MIN);
    expect(getCanonicalRaw()).toBe(String(SIDEBAR_WIDTH_MIN));
    expect(getLegacyRaw()).toBeNull();
  });

  it('migrates legacy value at the maximum boundary', () => {
    setLegacy(SIDEBAR_WIDTH_MAX);

    const width = getSidebarWidth();

    expect(width).toBe(SIDEBAR_WIDTH_MAX);
    expect(getCanonicalRaw()).toBe(String(SIDEBAR_WIDTH_MAX));
    expect(getLegacyRaw()).toBeNull();
  });

  it('returns default when legacy value is out of range (but still migrates raw value)', () => {
    // An out-of-range legacy value still gets migrated raw, but parseStoredWidth
    // returns null for it and the default is used.
    setLegacy(SIDEBAR_WIDTH_MAX + 100);

    const width = getSidebarWidth();

    expect(width).toBe(SIDEBAR_WIDTH_DEFAULT);
    // The raw string was still moved over.
    expect(getCanonicalRaw()).toBe(String(SIDEBAR_WIDTH_MAX + 100));
    expect(getLegacyRaw()).toBeNull();
  });

  it('prefers canonical key over legacy key when both exist', () => {
    setCanonical(400);
    setLegacy(320);

    const width = getSidebarWidth();

    expect(width).toBe(400);
    // Legacy key should NOT be removed when canonical is present.
    expect(getLegacyRaw()).not.toBeNull();
  });

  it('does not write to storage when canonical key is already set', () => {
    setCanonical(350);
    vi.clearAllMocks();

    getSidebarWidth();

    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });
});

// ─── saveSidebarWidth ─────────────────────────────────────────────────────────

describe('saveSidebarWidth', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('persists under the canonical key roundtable:ui-sidebar-width', () => {
    saveSidebarWidth(350);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(CANONICAL_KEY, '350');
  });

  it('clamps values below minimum to SIDEBAR_WIDTH_MIN', () => {
    saveSidebarWidth(SIDEBAR_WIDTH_MIN - 10);
    expect(getCanonicalRaw()).toBe(String(SIDEBAR_WIDTH_MIN));
  });

  it('clamps values above maximum to SIDEBAR_WIDTH_MAX', () => {
    saveSidebarWidth(SIDEBAR_WIDTH_MAX + 10);
    expect(getCanonicalRaw()).toBe(String(SIDEBAR_WIDTH_MAX));
  });

  it('rejects non-finite values silently (NaN)', () => {
    saveSidebarWidth(NaN);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('rejects non-finite values silently (Infinity)', () => {
    saveSidebarWidth(Infinity);
    expect(localStorageMock.setItem).not.toHaveBeenCalled();
  });

  it('does not write to the legacy key location', () => {
    saveSidebarWidth(350);
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
    saveSidebarWidth(350);
    expect(getSidebarWidth()).toBe(350);
  });

  it('save boundary min then get returns SIDEBAR_WIDTH_MIN', () => {
    saveSidebarWidth(SIDEBAR_WIDTH_MIN);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_MIN);
  });

  it('save boundary max then get returns SIDEBAR_WIDTH_MAX', () => {
    saveSidebarWidth(SIDEBAR_WIDTH_MAX);
    expect(getSidebarWidth()).toBe(SIDEBAR_WIDTH_MAX);
  });

  it('legacy key migration round-trip: value survives migration intact', () => {
    setLegacy(320);
    const first = getSidebarWidth();
    expect(first).toBe(320);
    // Subsequent reads come from canonical key.
    expect(getSidebarWidth()).toBe(320);
    expect(getLegacyRaw()).toBeNull();
  });
});
