/**
 * Gate — fontScale.ts
 *
 * Implements getFontScalePreferences() and saveFontScalePreferences() for
 * per-user font size controls (#600).
 *
 * Storage key: 'roundtable:font-scale'
 * Persistence layer: localStorage only
 *
 * Two independent scale values:
 *   - ui      — multiplier for sidebar, input bar, and settings chrome
 *               Valid range: 0.875–1.25, step 0.125, default 1.0
 *   - content — multiplier for message bubbles, markdown, and code blocks
 *               Valid range: 0.875–2.0, step 0.125, default 1.0
 *
 * Both values are unitless multipliers. CSS consumers multiply their base
 * font-size by these values via the --font-scale-ui and --font-scale-content
 * custom properties.
 *
 * Out-of-range policy: saveFontScalePreferences() silently ignores any
 * field whose value is out of range — the current stored value (or default)
 * is left unchanged. This prevents a single invalid write from corrupting
 * the other dimension. getFontScalePreferences() also falls back to defaults
 * for any stored value that is out of range, so corrupt stored state is
 * automatically recovered on next read.
 */

// ─── Storage key and defaults ─────────────────────────────────────────────────

const FONT_SCALE_STORAGE_KEY = 'roundtable:font-scale' as const;

const FONT_SCALE_DEFAULTS = {
  ui: 1.0,
  content: 1.0,
} as const;

// ─── Valid range constants ────────────────────────────────────────────────────

/** Minimum multiplier for both UI and content scale (0.875 = 7/8). */
const FONT_SCALE_MIN = 0.875 as const;

/** Maximum multiplier for the UI scale. */
const FONT_SCALE_UI_MAX = 1.25 as const;

/** Maximum multiplier for the content scale. */
const FONT_SCALE_CONTENT_MAX = 2.0 as const;

/** Step size for valid scale values (1/8 = 0.125). */
const FONT_SCALE_STEP = 0.125 as const;

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * Returns true iff the value is a finite number, within the given inclusive
 * [min, max] range, and a multiple of FONT_SCALE_STEP.
 *
 * The step check uses a small epsilon (1e-9) to guard against floating-point
 * rounding errors in divisions and modulo operations.
 */
function isValidScale(value: unknown, min: number, max: number): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < min || value > max) return false;
  const remainder = Math.abs((value / FONT_SCALE_STEP) % 1);
  return remainder < 1e-9 || remainder > 1 - 1e-9;
}

function isValidUiScale(value: unknown): value is number {
  return isValidScale(value, FONT_SCALE_MIN, FONT_SCALE_UI_MAX);
}

function isValidContentScale(value: unknown): value is number {
  return isValidScale(value, FONT_SCALE_MIN, FONT_SCALE_CONTENT_MAX);
}

// ─── Stored shape ─────────────────────────────────────────────────────────────

interface FontScaleRecord {
  ui: number;
  content: number;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return the stored font scale preferences.
 *
 * Reads from localStorage key 'roundtable:font-scale'. Any stored value that
 * is missing, not a number, or outside the valid range for its dimension falls
 * back to the default for that dimension (ui: 1.0, content: 1.0). The other
 * dimension is unaffected — partial corruption produces a partial fallback.
 *
 * Never throws. Safe to call at any time, including before DOM is ready.
 */
export function getFontScalePreferences(): { ui: number; content: number } {
  try {
    const raw = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
    if (raw === null) return { ...FONT_SCALE_DEFAULTS };

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ...FONT_SCALE_DEFAULTS };
    }

    if (!isPlainObject(parsed)) return { ...FONT_SCALE_DEFAULTS };

    const ui = isValidUiScale(parsed['ui']) ? (parsed['ui'] as number) : FONT_SCALE_DEFAULTS.ui;
    const content = isValidContentScale(parsed['content'])
      ? (parsed['content'] as number)
      : FONT_SCALE_DEFAULTS.content;

    return { ui, content };
  } catch {
    // localStorage unavailable (SSR context or storage access denied)
    return { ...FONT_SCALE_DEFAULTS };
  }
}

/**
 * Persist font scale preferences to localStorage.
 *
 * Merges the provided partial object with the currently stored preferences —
 * omitting a key leaves the stored value unchanged. Each supplied value is
 * validated against its dimension's valid range and step:
 *   - ui:      0.875–1.25, step 0.125
 *   - content: 0.875–2.0,  step 0.125
 *
 * Out-of-range values are silently ignored — the stored value for that
 * dimension is left unchanged. This prevents a single bad write from
 * corrupting both dimensions simultaneously.
 *
 * Never throws.
 */
export function saveFontScalePreferences(prefs: { ui?: number; content?: number }): void {
  try {
    const current = getFontScalePreferences();

    const next: FontScaleRecord = {
      ui: current.ui,
      content: current.content,
    };

    if (prefs.ui !== undefined) {
      if (isValidUiScale(prefs.ui)) {
        next.ui = prefs.ui;
      }
      // Out-of-range: silently leave next.ui unchanged
    }

    if (prefs.content !== undefined) {
      if (isValidContentScale(prefs.content)) {
        next.content = prefs.content;
      }
      // Out-of-range: silently leave next.content unchanged
    }

    localStorage.setItem(FONT_SCALE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable or quota exceeded — silently no-op
  }
}
