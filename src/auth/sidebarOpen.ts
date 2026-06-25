/**
 * Gate — sidebarOpen.ts
 *
 * Persists the sidebar open/close state so Aria's toggle UI can restore it
 * across sessions on desktop.
 *
 * Storage key : 'roundtable:sidebar-open'  (localStorage only)
 * Default     : absent → true (sidebar open by default)
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Never touch /src/ui — that is Aria's directory
 *   - Never touch /src/types/index.ts — that is Arch's file
 *   - All functions are synchronous and never throw
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const SIDEBAR_OPEN_STORAGE_KEY = 'roundtable:sidebar-open' as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse the raw localStorage string into a boolean.
 *
 * Returns null if the value is absent or not a valid JSON boolean.
 * Fail-closed: any unexpected value causes a null return and the default applies.
 */
function parseStoredBoolean(raw: string | null): boolean | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'boolean') return null;

  return parsed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the sidebar open/close state from localStorage.
 *
 * Returns true if the key is absent (default: sidebar open).
 * Returns the stored boolean if present.
 * Returns true if the stored value is malformed (fail-safe default).
 *
 * Synchronous. Never throws.
 */
export function getSidebarOpen(): boolean {
  const raw = localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
  if (raw === null) return true; // Default: open

  return parseStoredBoolean(raw) ?? true; // Malformed: default open
}

/**
 * Persist the sidebar open/close state to localStorage.
 *
 * Synchronous.
 */
export function setSidebarOpen(isOpen: boolean): void {
  localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, JSON.stringify(isOpen));
}

/**
 * Remove the sidebar open/close state from localStorage.
 *
 * No-op if the key is absent. After clearing, getSidebarOpen() will return
 * the default (true — sidebar open).
 *
 * Synchronous.
 */
export function clearSidebarOpen(): void {
  localStorage.removeItem(SIDEBAR_OPEN_STORAGE_KEY);
}
