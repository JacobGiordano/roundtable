/**
 * Gate — userAccentColor.ts
 *
 * Implements getUserAccentColor(), setUserAccentColor(), and
 * clearUserAccentColor() for user message bubble accent color customization.
 *
 * localStorage key: "roundtable:user-accent-color"
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Values are single 6-digit hex strings matching /^#[0-9A-Fa-f]{6}$/
 *   - Key absent = user has no override; theme default (accents.user) applies
 *   - Never throws on read — invalid or missing value returns null
 *   - Throws TypeError on write with invalid hex — developer guard, not user error
 *   - Never logs the stored value
 */

// ─── Storage key ──────────────────────────────────────────────────────────────

const USER_ACCENT_COLOR_KEY = 'roundtable:user-accent-color' as const;

// ─── Validation ───────────────────────────────────────────────────────────────

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Read the user's stored accent color override for their message bubbles.
 *
 * Returns the stored hex string if the key is present and the value passes
 * /^#[0-9A-Fa-f]{6}$/. Returns null if the key is absent or the stored value
 * fails validation (corrupt storage treated as "no override").
 *
 * Synchronous. Never throws.
 */
export function getUserAccentColor(): string | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(USER_ACCENT_COLOR_KEY);
  } catch {
    return null;
  }

  if (raw === null) return null;

  if (!isValidHex(raw)) return null;

  return raw;
}

/**
 * Persist the user's accent color override for their message bubbles.
 *
 * Validates that hex matches /^#[0-9A-Fa-f]{6}$/ before writing.
 * Throws TypeError on an invalid hex value — this is a developer contract
 * guard, not a user-facing error path. Aria must validate before calling.
 *
 * Synchronous.
 */
export function setUserAccentColor(hex: string): void {
  if (!isValidHex(hex)) {
    throw new TypeError(
      `setUserAccentColor: invalid hex value "${hex}". ` +
        'Expected a 6-digit hex string matching /^#[0-9A-Fa-f]{6}$/.'
    );
  }

  localStorage.setItem(USER_ACCENT_COLOR_KEY, hex);
}

/**
 * Remove the user's stored accent color override.
 *
 * After this call, getUserAccentColor() returns null and Aria applies the
 * active theme's accents.user token for the user bubble border.
 *
 * No-op if the key is absent. Synchronous.
 */
export function clearUserAccentColor(): void {
  localStorage.removeItem(USER_ACCENT_COLOR_KEY);
}
