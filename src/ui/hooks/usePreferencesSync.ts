/**
 * usePreferencesSync — reactive UserPreferences hook for the UI layer.
 *
 * Problem solved:
 *   useUserPreferences() (Gate, /src/auth) uses React useState, so each call
 *   site owns an independent preferences state. When TokenCountControl saves a
 *   change via its own hook instance, App.tsx's instance is never notified —
 *   tokenCountVisibility in RoundtableContext remains frozen at its initial
 *   page-load value for the entire session.
 *
 * Approach:
 *   Patch localStorage.setItem once at module load time to intercept writes to
 *   the preferences key. On any write, refresh the module-level snapshot and
 *   notify all useSyncExternalStore subscribers. This gives real-time reactivity
 *   without modifying Gate's saveUserPreferences (which is in /src/auth and
 *   outside Aria's boundary).
 *
 * Design notes:
 *   - The patch delegates to the original setItem before notifying, so all other
 *     callers (including Gate's saveUserPreferences itself) behave identically.
 *   - The patch is applied exactly once (guarded by _patched) regardless of how
 *     many times the module is imported. ES module singletons ensure the guard
 *     is reliable.
 *   - useSyncExternalStore is React 18's concurrent-mode-safe API for subscribing
 *     to external mutable stores. It avoids the stale-closure and tearing problems
 *     that useEffect-based subscriptions have.
 *   - Cross-agent exception: getUserPreferences is a pure read utility exported
 *     from @/auth. It has no side effects and does not cross the storage or model
 *     boundaries. Aria imports it here solely to initialise the snapshot and to
 *     re-read after each change — the same permitted exception documented for
 *     utility functions exported from @/models/index.ts (CLAUDE.md).
 */

import { useSyncExternalStore } from 'react';
import { getUserPreferences } from '@/auth';
import type { UserPreferences } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

/**
 * Must match USER_PREFS_STORAGE_KEY in /src/auth/preferences.ts.
 * Duplicated here to avoid importing a non-exported constant from Gate.
 * If Gate renames the key, this constant must be updated in tandem.
 */
const USER_PREFS_STORAGE_KEY = 'roundtable:user-preferences';

// ─── Module-level reactive store ──────────────────────────────────────────────

let _snapshot: UserPreferences = getUserPreferences();
const _listeners = new Set<() => void>();

/** Called whenever the preferences key is written. Refreshes snapshot and notifies. */
function _notify(): void {
  const fresh = getUserPreferences();
  // Fast-path equality check: skip notification when the stored value did not
  // actually change. getUserPreferences() returns a new object on every call,
  // so we compare the individual fields rather than doing a JSON.stringify round-trip.
  if (fresh.tokenCountVisibility === _snapshot.tokenCountVisibility) return;
  _snapshot = fresh;
  _listeners.forEach((fn) => fn());
}

/** useSyncExternalStore subscribe — returns an unsubscribe cleanup function. */
function _subscribe(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** useSyncExternalStore getSnapshot — returns the current preferences object. */
function _getSnapshot(): UserPreferences {
  return _snapshot;
}

// ─── localStorage.setItem patch ───────────────────────────────────────────────

/**
 * Patch localStorage.setItem once to observe same-tab preference writes.
 *
 * The browser's native `storage` event only fires for changes from OTHER tabs,
 * not from the current document. Without this patch, there is no standard
 * mechanism to detect same-tab localStorage writes without modifying the
 * save call site (Gate's saveUserPreferences in /src/auth/preferences.ts).
 *
 * The patch is minimal and targeted:
 *   - Applied only when window/localStorage are defined (safe in SSR and in
 *     test environments that do not configure a window global).
 *   - Checks only the preferences key — all other keys pass through unchanged.
 *   - Calls the original setItem before notifying, preserving all existing
 *     semantics including error propagation (QuotaExceededError, etc.) and
 *     the order in which values are available for subsequent reads.
 */
let _patched = false;

function _patchLocalStorage(): void {
  if (_patched || typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  _patched = true;

  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function patchedSetItem(key: string, value: string): void {
    _origSetItem(key, value);
    if (key === USER_PREFS_STORAGE_KEY) {
      _notify();
    }
  };
}

// Apply at module load time so the patch is in place before any preference
// write. The _patched guard makes repeated imports safe (module is a singleton
// in ES modules, but the guard adds defence-in-depth for test environments
// that reset module state between suites).
_patchLocalStorage();

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Reads UserPreferences and re-renders the calling component whenever any
 * preference value changes — regardless of which hook instance or component
 * performed the save.
 *
 * Use in App.tsx instead of Gate's useUserPreferences() so the context value
 * for tokenCountVisibility stays current after TokenCountControl saves a change.
 *
 * Read-only: this hook does not expose a setter. Components that write
 * preferences (e.g. TokenCountControl) must continue to use Gate's
 * useUserPreferences() hook directly — the localStorage patch in this module
 * ensures any write they make propagates to all usePreferencesSync subscribers
 * automatically.
 */
export function usePreferencesSync(): UserPreferences {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}
