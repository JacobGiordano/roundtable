/**
 * Gate — accentColors.ts
 *
 * Implements GetModelAccentColorsFn, SetModelAccentColorFn,
 * ClearModelAccentColorFn, and ClearAllModelAccentColorsFn from
 * /src/types/index.ts.
 *
 * localStorage key: "roundtable:model-accent-colors"
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Validation is strict: invalid entries are silently dropped on read,
 *     rejected with TypeError on write
 *   - Never throws on read — any error returns {}
 */

import type {
  ModelId,
  ModelAccentColors,
  GetModelAccentColorsFn,
  SetModelAccentColorFn,
  ClearModelAccentColorFn,
  ClearAllModelAccentColorsFn,
} from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

const ACCENT_COLORS_STORAGE_KEY = 'roundtable:model-accent-colors' as const;

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * The complete set of valid ModelId values. Gate maintains this list
 * independently — no import from /src/models (boundary rule).
 * Must stay in sync with the ModelId union in /src/types/index.ts.
 */
const VALID_MODEL_IDS: ReadonlySet<string> = new Set<ModelId>([
  'claude',
  'gpt-5.5',
  'gemini',
  'grok',
  'deepseek',
  'mistral',
]);

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isValidModelId(value: unknown): value is ModelId {
  return typeof value === 'string' && VALID_MODEL_IDS.has(value);
}

function isValidHex(value: unknown): value is string {
  return typeof value === 'string' && HEX_PATTERN.test(value);
}

// ─── Internal read helper ─────────────────────────────────────────────────────

/**
 * Read and validate the stored record from localStorage.
 * Silently drops any key–value pair where the key is not a valid ModelId
 * or the value is not a valid 6-digit hex string.
 * Returns {} on any error or if the key is absent.
 */
function readStoredColors(): ModelAccentColors {
  let raw: string | null;
  try {
    raw = localStorage.getItem(ACCENT_COLORS_STORAGE_KEY);
  } catch {
    return {};
  }

  if (raw === null) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  // Must be a plain object — not an array, not null, not a primitive.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const result: ModelAccentColors = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isValidModelId(key) && isValidHex(value)) {
      result[key] = value;
    }
    // Silently drop entries that fail validation (per spec rule 4).
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve all stored model accent color overrides.
 *
 * Returns a validated, cleaned record. Any stored entry with an invalid
 * ModelId key or non-hex value is silently dropped.
 * Returns {} when no overrides are stored or if the stored value is corrupt.
 * Never throws.
 */
export const getModelAccentColors: GetModelAccentColorsFn = (): ModelAccentColors => {
  return readStoredColors();
};

/**
 * Persist a single model accent color override.
 *
 * Validates that hex matches /^#[0-9A-Fa-f]{6}$/ before writing.
 * Throws TypeError on an invalid hex value — this is a developer contract
 * guard, not a user-facing error path. Aria must validate before calling.
 *
 * Reads the current stored record, sets the entry for modelId, writes back.
 */
export const setModelAccentColor: SetModelAccentColorFn = (
  modelId: ModelId,
  hex: string
): void => {
  if (!isValidHex(hex)) {
    throw new TypeError(
      `setModelAccentColor: invalid hex value "${hex}". ` +
        'Expected a 6-digit hex string matching /^#[0-9A-Fa-f]{6}$/.'
    );
  }

  const current = readStoredColors();
  const updated: ModelAccentColors = { ...current, [modelId]: hex };
  localStorage.setItem(ACCENT_COLORS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Remove the stored accent color override for a single model.
 *
 * No-op if modelId has no stored override.
 */
export const clearModelAccentColor: ClearModelAccentColorFn = (
  modelId: ModelId
): void => {
  const current = readStoredColors();

  // No entry for this model — nothing to do.
  if (!(modelId in current)) return;

  const updated = { ...current };
  delete updated[modelId];
  localStorage.setItem(ACCENT_COLORS_STORAGE_KEY, JSON.stringify(updated));
};

/**
 * Remove all stored model accent color overrides.
 *
 * Removes the entire localStorage key. After this call,
 * getModelAccentColors() returns {}.
 */
export const clearAllModelAccentColors: ClearAllModelAccentColorsFn = (): void => {
  localStorage.removeItem(ACCENT_COLORS_STORAGE_KEY);
};
