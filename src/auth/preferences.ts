/**
 * Gate — preferences.ts
 *
 * Implements getUserPreferences() and saveUserPreferences() for UserPreferences
 * as defined in /src/types/index.ts.
 *
 * Storage key: 'roundtable:user-preferences' (separate from theme preferences)
 * Persistence layer: localStorage only
 *
 * Default values when no preference is stored:
 *   tokenCountVisibility: 'active'
 */

import type { UserPreferences, TokenCountVisibility } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

/**
 * Canonical key: 'roundtable:user-preferences'
 * Legacy key (pre-#156): 'roundtable_user_preferences'
 * Migration-on-read: if canonical key is absent but legacy key exists,
 * value is moved to canonical key and legacy key is removed.
 */
const USER_PREFS_STORAGE_KEY = 'roundtable:user-preferences' as const;
const LEGACY_USER_PREFS_STORAGE_KEY = 'roundtable_user_preferences' as const;

const DEFAULT_PREFERENCES: UserPreferences = {
  tokenCountVisibility: 'active',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_VISIBILITY: readonly TokenCountVisibility[] = ['always', 'active', 'never'] as const;

function isTokenCountVisibility(value: unknown): value is TokenCountVisibility {
  return VALID_VISIBILITY.includes(value as TokenCountVisibility);
}

/**
 * Attempt to parse the raw localStorage string into UserPreferences.
 * Returns null if the value is missing, malformed, or contains unrecognised values.
 * Fail-closed: any unrecognised field value causes a null return and defaults apply.
 */
function parseStoredPreferences(raw: string | null): UserPreferences | null {
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  if (!isTokenCountVisibility(obj.tokenCountVisibility)) return null;

  return {
    tokenCountVisibility: obj.tokenCountVisibility,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read user preferences from localStorage.
 *
 * Returns a UserPreferences object. Falls back to `{ tokenCountVisibility: 'active' }`
 * if nothing has been saved yet or the stored value is corrupt/unrecognised.
 *
 * Migration: if the canonical key is absent but the legacy key exists, the
 * value is migrated to the canonical key and the legacy key is removed.
 */
export function getUserPreferences(): UserPreferences {
  const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
  if (raw !== null) {
    return parseStoredPreferences(raw) ?? { ...DEFAULT_PREFERENCES };
  }

  // Migration path: check for legacy key format.
  const legacyRaw = localStorage.getItem(LEGACY_USER_PREFS_STORAGE_KEY);
  if (legacyRaw !== null) {
    localStorage.setItem(USER_PREFS_STORAGE_KEY, legacyRaw);
    localStorage.removeItem(LEGACY_USER_PREFS_STORAGE_KEY);
    return parseStoredPreferences(legacyRaw) ?? { ...DEFAULT_PREFERENCES };
  }

  return { ...DEFAULT_PREFERENCES };
}

/**
 * Persist user preferences to localStorage.
 *
 * Pass the full UserPreferences object. This replaces the entire stored value.
 */
export function saveUserPreferences(prefs: UserPreferences): void {
  localStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(prefs));
}
