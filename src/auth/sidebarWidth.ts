/**
 * Gate — sidebarWidth.ts
 *
 * Persists the user's preferred sidebar width so Aria's drag-resize UI can
 * restore it across sessions.
 *
 * Storage key : 'roundtable:ui-sidebar-width'  (localStorage only)
 * Default     : 280 (px) — matches the hardcoded sidebar width prior to #62
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Never touch /src/ui — that is Aria's directory
 *   - Never touch /src/types/index.ts — that is Arch's file
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Canonical key: 'roundtable:ui-sidebar-width'
 * Legacy key (pre-#156): 'rt-ui-sidebar-width'
 * Migration-on-read: if canonical key is absent but legacy key exists,
 * value is moved to canonical key and legacy key is removed.
 */
const SIDEBAR_WIDTH_STORAGE_KEY = 'roundtable:ui-sidebar-width' as const;
const LEGACY_SIDEBAR_WIDTH_STORAGE_KEY = 'rt-ui-sidebar-width' as const;

/** Minimum sidebar width in pixels. Aria should enforce the same floor in the drag UI. */
export const SIDEBAR_WIDTH_MIN = 278;

/** Maximum sidebar width in pixels. Aria should enforce the same ceiling in the drag UI. */
export const SIDEBAR_WIDTH_MAX = 600;

/** Default sidebar width in pixels — matches the pre-#62 hardcoded value. */
export const SIDEBAR_WIDTH_DEFAULT = 280;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse the raw localStorage string into a valid pixel width.
 *
 * Returns null if the value is absent, not a number, non-finite, or outside
 * the allowed [SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX] range.
 * Fail-closed: any unexpected value causes a null return and the default applies.
 */
function parseStoredWidth(raw: string | null): number | null {
  if (raw === null) return null;

  const parsed = Number(raw);

  if (!Number.isFinite(parsed)) return null;
  if (parsed < SIDEBAR_WIDTH_MIN || parsed > SIDEBAR_WIDTH_MAX) return null;

  return parsed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the user's preferred sidebar width from localStorage.
 *
 * Returns a pixel value. Falls back to SIDEBAR_WIDTH_DEFAULT (280) if nothing
 * has been saved yet or the stored value is corrupt or out of range.
 *
 * Migration: if the canonical key is absent but the legacy key exists, the
 * value is migrated to the canonical key and the legacy key is removed.
 */
export function getSidebarWidth(): number {
  const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (raw !== null) {
    return parseStoredWidth(raw) ?? SIDEBAR_WIDTH_DEFAULT;
  }

  // Migration path: check for legacy key format.
  const legacyRaw = localStorage.getItem(LEGACY_SIDEBAR_WIDTH_STORAGE_KEY);
  if (legacyRaw !== null) {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, legacyRaw);
    localStorage.removeItem(LEGACY_SIDEBAR_WIDTH_STORAGE_KEY);
    return parseStoredWidth(legacyRaw) ?? SIDEBAR_WIDTH_DEFAULT;
  }

  return SIDEBAR_WIDTH_DEFAULT;
}

/**
 * Persist the user's preferred sidebar width to localStorage.
 *
 * Values outside [SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX] are silently clamped
 * before storage so the stored value is always in a known-safe range.
 * Non-finite values are rejected silently and nothing is written.
 */
export function saveSidebarWidth(width: number): void {
  if (!Number.isFinite(width)) return;

  const clamped = Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, width));
  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(clamped));
}
