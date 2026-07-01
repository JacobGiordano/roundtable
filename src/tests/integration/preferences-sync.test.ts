/**
 * Integration: usePreferencesSync — reactive update behavior
 *
 * Exercises the cross-agent contract between usePreferencesSync (Aria/UI) and
 * Gate's preference storage mechanism introduced in #312 to fix
 * tokenCountVisibility remaining frozen at page-load value.
 *
 * Key behavioral invariant: any call to localStorage.setItem for the preferences
 * key — exactly as Gate's saveUserPreferences does — must cause every
 * usePreferencesSync subscriber to re-render with the updated value, without
 * the consuming component unmounting or remounting.
 *
 * Cross-agent contract exercised:
 *   usePreferencesSync (/src/ui/hooks/usePreferencesSync.ts — Aria)
 *     ← module-level localStorage.setItem patch fires _notify()
 *     ← useSyncExternalStore drives subscriber re-renders
 *   getUserPreferences (/src/auth/preferences.ts — Gate)
 *     ← snapshot refresh source called inside _notify() after each write
 *
 * jsdom limitation and workaround:
 *   jsdom's localStorage is backed by a Proxy whose defineProperty/set traps
 *   silently discard own-property assignments for Storage interface methods.
 *   As a result, the line `localStorage.setItem = function patchedSetItem(...)` in
 *   _patchLocalStorage() completes without error but has no effect — the instance
 *   property is never created and prototype dispatch continues as before.
 *
 *   Workaround: each test installs a plain-object localStorage mock before the
 *   module is imported. Plain object properties ARE assignable, so _patchLocalStorage()
 *   successfully replaces setItem on the mock. vi.resetModules() resets the module
 *   between tests so _patchLocalStorage() re-runs with each test's fresh mock.
 *   @testing-library/react and usePreferencesSync are dynamically imported AFTER
 *   the mock is installed so both share the same React instance.
 *
 * Module-level singleton note:
 *   vi.resetModules() gives each test a fresh module with _snapshot, _listeners,
 *   and _patched all at their initial values. This makes tests independent —
 *   no test's leftover state can influence the next.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TokenCountVisibility } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Must match USER_PREFS_STORAGE_KEY in both:
 *   /src/ui/hooks/usePreferencesSync.ts
 *   /src/auth/preferences.ts
 */
const PREFS_KEY = 'roundtable:user-preferences';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePrefsJson(visibility: TokenCountVisibility): string {
  return JSON.stringify({ tokenCountVisibility: visibility });
}

/**
 * Returns a TokenCountVisibility value guaranteed to differ from `current`.
 * Alternates between 'never' and 'always' to avoid ambiguity with the default
 * 'active' that getUserPreferences() returns when localStorage is empty.
 */
function differentVisibility(current: TokenCountVisibility): TokenCountVisibility {
  return current === 'never' ? 'always' : 'never';
}

/**
 * Install a plain-object localStorage mock on globalThis.
 *
 * jsdom's native localStorage Proxy ignores `localStorage.setItem = fn` and
 * `Object.defineProperty(localStorage, 'setItem', ...)`. A plain Storage-shaped
 * object has regular assignable properties, so when _patchLocalStorage() in
 * usePreferencesSync.ts runs `localStorage.setItem = function patchedSetItem(...)`,
 * the assignment STICKS and the patch is active for the duration of the test.
 *
 * Returns `restore()` — call it in afterEach to put jsdom's original back.
 */
function installPatchableLocalStorageMock(): { store: Map<string, string>; restore: () => void } {
  const store = new Map<string, string>();

  const mock: Storage = {
    getItem:    (key: string) => store.get(key) ?? null,
    setItem:    (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear:      () => { store.clear(); },
    get length() { return store.size; },
    key:        (index: number) => Array.from(store.keys())[index] ?? null,
  };

  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });

  const restore = () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      writable: true,
      configurable: true,
    });
  };

  return { store, restore };
}

// ─── Per-test state ───────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  // 1. Reset module cache — gives _patchLocalStorage() a chance to re-run
  //    with _patched = false when usePreferencesSync is next imported.
  vi.resetModules();

  // 2. Install patchable mock BEFORE any module import so that when
  //    _patchLocalStorage() executes (at dynamic import time), it patches
  //    the mock's setItem, not jsdom's.
  const { restore } = installPatchableLocalStorageMock();
  restoreLocalStorage = restore;
});

afterEach(() => {
  restoreLocalStorage();
});

// ─── Reactive update behavior ─────────────────────────────────────────────────

describe('usePreferencesSync — reactive update', () => {
  it('returns a valid UserPreferences object on initial render', async () => {
    const { renderHook } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result } = renderHook(() => usePreferencesSync());

    expect(result.current).toBeDefined();
    expect(['always', 'active', 'never']).toContain(result.current.tokenCountVisibility);
  });

  it('updates tokenCountVisibility without remounting when localStorage is written', async () => {
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result } = renderHook(() => usePreferencesSync());

    const initial = result.current.tokenCountVisibility;
    const updated = differentVisibility(initial);

    await act(async () => {
      // Simulates Gate's saveUserPreferences — exact call pattern from
      // /src/auth/preferences.ts:
      //   localStorage.setItem('roundtable:user-preferences', JSON.stringify(prefs))
      localStorage.setItem(PREFS_KEY, makePrefsJson(updated));
    });

    expect(result.current.tokenCountVisibility).toBe(updated);
  });

  it('reflects a second sequential write without remounting', async () => {
    // Verifies the subscription remains active across multiple writes —
    // no stale-closure issues in _listeners callbacks.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result } = renderHook(() => usePreferencesSync());

    const first = result.current.tokenCountVisibility;
    const second = differentVisibility(first);
    const third = differentVisibility(second);

    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(second));
    });
    expect(result.current.tokenCountVisibility).toBe(second);

    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(third));
    });
    expect(result.current.tokenCountVisibility).toBe(third);
  });

  it('does not update when an unrelated localStorage key is written', async () => {
    // The patch checks: if (key === USER_PREFS_STORAGE_KEY) before calling _notify().
    // Writes to unrelated keys must pass through without triggering a re-render.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result } = renderHook(() => usePreferencesSync());

    const initial = result.current.tokenCountVisibility;

    await act(async () => {
      localStorage.setItem('roundtable:some-other-key', 'some value');
      localStorage.setItem('completely-unrelated-key', 'other value');
    });

    expect(result.current.tokenCountVisibility).toBe(initial);
  });

  it('end-to-end trace of the #312 fix — App.tsx sees the updated value', async () => {
    // Regression guard for #312:
    //   Problem: tokenCountVisibility in RoundtableContext remained frozen at the
    //   initial page-load value. App.tsx used useUserPreferences() which owned
    //   independent state per call site. When TokenCountControl called
    //   saveUserPreferences(), App.tsx's instance was never notified.
    //   Fix: usePreferencesSync() uses useSyncExternalStore + a module-level
    //   setItem patch; any preference write wakes all subscribers.
    //
    // Trace:
    //   1. App.tsx renders → usePreferencesSync() returns current preferences
    //   2. User changes token count visibility in TokenCountControl
    //   3. TokenCountControl calls saveUserPreferences({ tokenCountVisibility: X })
    //   4. saveUserPreferences calls localStorage.setItem(PREFS_KEY, JSON.stringify(X))
    //   5. Patched setItem fires _notify() → _snapshot refreshes → listeners notified
    //   6. App.tsx's usePreferencesSync() re-renders with updated value
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result } = renderHook(() => usePreferencesSync());

    const initial = result.current.tokenCountVisibility;
    const saved = differentVisibility(initial);

    // Step 4 — exact line from saveUserPreferences in /src/auth/preferences.ts:
    await act(async () => {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ tokenCountVisibility: saved }));
    });

    // Step 6 — App.tsx's hook instance reflects the change:
    expect(result.current.tokenCountVisibility).toBe(saved);
  });
});

// ─── Multiple subscribers ─────────────────────────────────────────────────────

describe('usePreferencesSync — multiple subscribers', () => {
  it('all hook instances update when localStorage is written once', async () => {
    // Simulates App.tsx and a child component both calling usePreferencesSync().
    // All instances share the module-level _listeners set — a single Gate write
    // must update every subscriber simultaneously.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const hookA = renderHook(() => usePreferencesSync());
    const hookB = renderHook(() => usePreferencesSync());
    const hookC = renderHook(() => usePreferencesSync());

    const initial = hookA.result.current.tokenCountVisibility;
    const updated = differentVisibility(initial);

    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(updated));
    });

    expect(hookA.result.current.tokenCountVisibility).toBe(updated);
    expect(hookB.result.current.tokenCountVisibility).toBe(updated);
    expect(hookC.result.current.tokenCountVisibility).toBe(updated);
  });

  it('unmounted subscriber is removed and does not prevent further updates', async () => {
    // When a hook unmounts, useSyncExternalStore calls the cleanup returned by
    // _subscribe: () => _listeners.delete(listener). Stale listeners must not
    // accumulate in _listeners, and remaining subscribers must still react.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const hookA = renderHook(() => usePreferencesSync());
    const hookB = renderHook(() => usePreferencesSync());

    const initial = hookA.result.current.tokenCountVisibility;
    const first = differentVisibility(initial);
    const second = differentVisibility(first);

    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(first));
    });
    expect(hookA.result.current.tokenCountVisibility).toBe(first);
    expect(hookB.result.current.tokenCountVisibility).toBe(first);

    // Unmount hookA — its listener is removed via _subscribe's cleanup return
    hookA.unmount();

    // A subsequent write must still update the remaining subscriber
    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(second));
    });
    expect(hookB.result.current.tokenCountVisibility).toBe(second);
  });
});

// ─── Patch guard behavior ─────────────────────────────────────────────────────

describe('usePreferencesSync — patch guard', () => {
  it('_patched guard fires after first import — rerenders do not corrupt subscription', async () => {
    // _patchLocalStorage() sets _patched = true on first call. This prevents a
    // double-patch (which would wrap the already-patched setItem, calling _notify()
    // twice per write). Since we use vi.resetModules() in beforeEach, each test
    // starts with _patched = false — this test verifies that multiple rerenders
    // after the initial patch do not break the subscription.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    const { result, rerender } = renderHook(() => usePreferencesSync());

    const initial = result.current.tokenCountVisibility;
    const updated = differentVisibility(initial);

    // Force several rerenders — subscription must survive them intact
    rerender();
    rerender();
    rerender();

    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(updated));
    });

    expect(result.current.tokenCountVisibility).toBe(updated);
  });
});

// ─── Fast-path equality check ─────────────────────────────────────────────────

describe('usePreferencesSync — fast-path equality check', () => {
  it('writing the same value twice triggers only one re-render', async () => {
    // _notify() has a fast-path: if fresh.tokenCountVisibility === _snapshot.tokenCountVisibility
    // it returns early without notifying listeners. This prevents redundant re-renders
    // when saveUserPreferences is called with an unchanged value.
    //
    // Testing this precisely: render-count tracking via a counter incremented in
    // the hook wrapper, then verify it does not increment on the second (same-value) write.
    const { renderHook, act } = await import('@testing-library/react');
    const { usePreferencesSync } = await import('@/ui/hooks/usePreferencesSync');

    let renderCount = 0;
    const { result } = renderHook(() => {
      renderCount++;
      return usePreferencesSync();
    });

    const initial = result.current.tokenCountVisibility;
    const changed = differentVisibility(initial);
    const countAfterMount = renderCount;

    // First write: changes value → should trigger re-render
    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(changed));
    });
    expect(result.current.tokenCountVisibility).toBe(changed);
    const countAfterChange = renderCount;
    expect(countAfterChange).toBeGreaterThan(countAfterMount);

    // Second write: same value as what's now in _snapshot → fast-path skips notification
    const countBeforeSameWrite = renderCount;
    await act(async () => {
      localStorage.setItem(PREFS_KEY, makePrefsJson(changed)); // same value
    });
    expect(result.current.tokenCountVisibility).toBe(changed); // unchanged
    expect(renderCount).toBe(countBeforeSameWrite); // no additional re-render
  });
});
