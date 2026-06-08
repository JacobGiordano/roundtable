/**
 * Gate — theme.ts
 *
 * Implements theme preference persistence for /src/auth.
 * Reads and writes ThemePreferences to localStorage under a stable key.
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Never touch /src/ui/theme.ts — that is Aria's file
 *   - Never touch /src/types/index.ts — that is Arch's file
 */

import type { ThemeId, ThemePreferences, CustomThemeJSON } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'roundtable:theme' as const;

const DEFAULT_THEME_ID: ThemeId = 'slate';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isThemeId(value: unknown): value is ThemeId {
  return (
    value === 'slate' ||
    value === 'linen' ||
    value === 'midnight' ||
    value === 'ash' ||
    value === 'ember' ||
    value === 'chalk' ||
    value === 'outrun'
  );
}

/**
 * Attempt to parse the raw localStorage string into ThemePreferences.
 * Returns null if the value is missing, malformed, or has an unrecognised ThemeId.
 */
function parseStoredPreferences(raw: string | null): ThemePreferences | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  if (!isThemeId(obj.activeThemeId)) return null;

  const result: ThemePreferences = {
    activeThemeId: obj.activeThemeId,
  };

  if (obj.customTheme !== undefined) {
    // Accept whatever object is stored as customTheme — Arch defines the shape.
    result.customTheme = obj.customTheme as CustomThemeJSON;
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the user's theme preference from localStorage.
 *
 * Returns a ThemePreferences object. Falls back to `{ activeThemeId: 'slate' }`
 * if nothing has been saved yet or the stored value is corrupt.
 */
export function getThemePreference(): ThemePreferences {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return parseStoredPreferences(raw) ?? { activeThemeId: DEFAULT_THEME_ID };
}

/**
 * Persist the user's theme preference to localStorage.
 *
 * Pass a full ThemePreferences object. To clear a custom theme, omit the
 * `customTheme` field or pass `undefined`.
 */
export function saveThemePreference(preferences: ThemePreferences): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(preferences));
}

/**
 * Convenience helper — update only the active theme ID while preserving any
 * stored custom theme.
 */
export function setActiveTheme(themeId: ThemeId): void {
  const current = getThemePreference();
  saveThemePreference({ ...current, activeThemeId: themeId });
}

/**
 * Remove the stored theme preference, reverting to the default on next read.
 */
export function clearThemePreference(): void {
  localStorage.removeItem(THEME_STORAGE_KEY);
}
