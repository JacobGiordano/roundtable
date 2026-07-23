/**
 * Gate — logoutOnClose.test.ts
 *
 * Tests for:
 *   - getLogoutOnClose() — returns stored boolean or default (false)
 *   - saveLogoutOnClose() — persists under 'roundtable:logout-on-close'
 *   - clearLogoutOnClose() — removes the key
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
  };
})();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// ─── Import under test ────────────────────────────────────────────────────────

import { getLogoutOnClose, saveLogoutOnClose, clearLogoutOnClose } from './logoutOnClose';

const STORAGE_KEY = 'roundtable:logout-on-close';

// ─── getLogoutOnClose ─────────────────────────────────────────────────────────

describe('getLogoutOnClose', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('returns false (default) when nothing is stored', () => {
    expect(getLogoutOnClose()).toBe(false);
  });

  it('returns true when stored value is "true"', () => {
    localStorageMock.setItem(STORAGE_KEY, 'true');
    expect(getLogoutOnClose()).toBe(true);
  });

  it('returns false when stored value is "false"', () => {
    localStorageMock.setItem(STORAGE_KEY, 'false');
    expect(getLogoutOnClose()).toBe(false);
  });

  it('returns false for any unrecognised stored value (fail-closed)', () => {
    localStorageMock.setItem(STORAGE_KEY, 'yes');
    expect(getLogoutOnClose()).toBe(false);
  });

  it('returns false for an empty stored value', () => {
    localStorageMock.setItem(STORAGE_KEY, '');
    expect(getLogoutOnClose()).toBe(false);
  });
});

// ─── saveLogoutOnClose ────────────────────────────────────────────────────────

describe('saveLogoutOnClose', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('persists true under the canonical key', () => {
    saveLogoutOnClose(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'true');
  });

  it('persists false under the canonical key', () => {
    saveLogoutOnClose(false);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(STORAGE_KEY, 'false');
  });

  it('round-trips: save true then read returns true', () => {
    saveLogoutOnClose(true);
    expect(getLogoutOnClose()).toBe(true);
  });

  it('round-trips: save false then read returns false', () => {
    saveLogoutOnClose(false);
    expect(getLogoutOnClose()).toBe(false);
  });

  it('overwrites a previous value', () => {
    saveLogoutOnClose(true);
    saveLogoutOnClose(false);
    expect(getLogoutOnClose()).toBe(false);
  });
});

// ─── clearLogoutOnClose ───────────────────────────────────────────────────────

describe('clearLogoutOnClose', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('removes the stored value', () => {
    saveLogoutOnClose(true);
    clearLogoutOnClose();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(getLogoutOnClose()).toBe(false);
  });

  it('is a no-op when nothing is stored', () => {
    expect(() => clearLogoutOnClose()).not.toThrow();
  });
});
