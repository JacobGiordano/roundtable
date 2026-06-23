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

import type { ThemeId, ThemePreferences, CustomThemeJSON, ActiveTheme } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

const THEME_STORAGE_KEY = 'roundtable:theme' as const;

const DEFAULT_THEME_ID: ThemeId = 'slate';

// ActiveTheme is defined in /src/types/index.ts (Arch owns it).
// Gate implements getActiveTheme() which returns that type.

// ─── Internal stored shape ────────────────────────────────────────────────────

/**
 * Gate-internal extension of ThemePreferences with a custom-active flag.
 * This shape is only ever written/read by this module — it never crosses the
 * /src/types boundary. The `customThemeActive` boolean tracks whether the user
 * has elected to use the stored custom theme rather than a built-in.
 */
interface StoredThemePreferences extends ThemePreferences {
  customThemeActive?: boolean;
}

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
 * Attempt to parse the raw localStorage string into StoredThemePreferences.
 * Returns null if the value is missing, malformed, or has an unrecognised ThemeId.
 */
function parseStoredPreferences(raw: string | null): StoredThemePreferences | null {
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

  const result: StoredThemePreferences = {
    activeThemeId: obj.activeThemeId,
  };

  if (obj.customTheme !== undefined) {
    // Accept whatever object is stored as customTheme — Arch defines the shape.
    result.customTheme = obj.customTheme as CustomThemeJSON;
  }

  if (obj.customThemeActive === true) {
    result.customThemeActive = true;
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
  const stored = parseStoredPreferences(raw);
  if (!stored) return { activeThemeId: DEFAULT_THEME_ID };
  // Return only the ThemePreferences fields (strip Gate-internal customThemeActive).
  return {
    activeThemeId: stored.activeThemeId,
    ...(stored.customTheme !== undefined ? { customTheme: stored.customTheme } : {}),
  };
}

/**
 * Persist the user's theme preference to localStorage.
 *
 * Pass a full ThemePreferences object. To clear a custom theme, omit the
 * `customTheme` field or pass `undefined`. Calling this function does NOT
 * activate a stored custom theme — use saveCustomTheme() for that.
 */
export function saveThemePreference(preferences: ThemePreferences): void {
  // Preserve the customThemeActive flag so an in-flight custom theme activation
  // is not inadvertently cleared by an unrelated preference write.
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  const existing = parseStoredPreferences(raw);
  const toWrite: StoredThemePreferences = {
    ...preferences,
    ...(existing?.customThemeActive ? { customThemeActive: true } : {}),
  };
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(toWrite));
}

/**
 * Convenience helper — update only the active theme ID while preserving any
 * stored custom theme. Clears the customThemeActive flag so the built-in theme
 * takes effect immediately.
 */
export function setActiveTheme(themeId: ThemeId): void {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  const existing = parseStoredPreferences(raw);
  const toWrite: StoredThemePreferences = {
    activeThemeId: themeId,
    ...(existing?.customTheme !== undefined ? { customTheme: existing.customTheme } : {}),
    // Explicitly omit customThemeActive — switching to a built-in deactivates custom.
  };
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(toWrite));
}

/**
 * Remove the stored theme preference, reverting to the default on next read.
 */
export function clearThemePreference(): void {
  localStorage.removeItem(THEME_STORAGE_KEY);
}

/**
 * Persist a validated custom theme and mark it as the active theme.
 *
 * The caller (Aria) is responsible for validating the theme with
 * `validateCustomTheme()` before calling this function. Gate does not
 * re-validate here — the type signature guarantees a well-formed object.
 *
 * Storage: written to localStorage key "roundtable:theme" alongside the
 * existing ThemePreferences structure, with a Gate-internal `customThemeActive`
 * flag set to true. The `activeThemeId` field is preserved from any prior stored
 * preference so switching back to a built-in after a custom theme retains the
 * previously selected built-in.
 *
 * After this call, `getActiveTheme()` returns `{ source: 'custom', name: theme.name }`.
 */
export function saveCustomTheme(theme: CustomThemeJSON): void {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  const existing = parseStoredPreferences(raw);
  const toWrite: StoredThemePreferences = {
    activeThemeId: existing?.activeThemeId ?? DEFAULT_THEME_ID,
    customTheme: theme,
    customThemeActive: true,
  };
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(toWrite));
}

/**
 * Return the currently active theme with a source discriminant.
 *
 * Returns an `ActiveTheme` as defined in `/src/types/index.ts`:
 *   `{ name: string; source: 'builtin' | 'custom' }`
 *
 * When a custom theme has been saved and activated via `saveCustomTheme()`,
 * returns `{ source: 'custom', name: <custom theme name> }`.
 *
 * Otherwise returns `{ source: 'builtin', name: <ThemeId> }` with the active
 * built-in theme ID as the name (defaulting to 'slate' if nothing is stored).
 *
 * Aria calls this on app load to determine initial render state without
 * duplicating localStorage reads.
 */
export function getActiveTheme(): ActiveTheme {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  const stored = parseStoredPreferences(raw);

  if (stored?.customThemeActive === true && stored.customTheme !== undefined) {
    return { source: 'custom', name: stored.customTheme.name };
  }

  return {
    source: 'builtin',
    name: stored?.activeThemeId ?? DEFAULT_THEME_ID,
  };
}
