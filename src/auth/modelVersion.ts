/**
 * Gate — modelVersion.ts
 *
 * Persists per-model version selections (selectedVersionId) to localStorage.
 *
 * localStorage key: "roundtable:model-versions"
 *
 * Rules:
 *   - localStorage is the sole persistence layer
 *   - Reads never throw — any parse error returns {}
 *   - Absence of a key for a given ModelId means "use provider default" (undefined)
 *   - No migration required: older configs that predate this field simply have
 *     no entry, which is identical in meaning to the field being undefined
 */

import type { BuiltInModelId, ModelId } from '@/types';

// ─── Storage key ──────────────────────────────────────────────────────────────

const MODEL_VERSION_STORAGE_KEY = 'roundtable:model-versions' as const;

// ─── Validation helpers ───────────────────────────────────────────────────────

/**
 * The complete set of built-in model IDs. Gate maintains this list
 * independently — no import from /src/models (boundary rule).
 * Must stay in sync with BuiltInModelId in /src/types/index.ts.
 *
 * This is intentionally ReadonlySet<BuiltInModelId> (not ModelId) — this guard
 * covers the closed set of built-ins only. Custom model IDs are not rejected;
 * they simply won't be in this set, which is the correct behavior for version
 * storage (custom providers may also store version selections — they pass through
 * the ModelId-typed public API).
 */
const VALID_MODEL_IDS: ReadonlySet<BuiltInModelId> = new Set<BuiltInModelId>([
  'claude',
  'gpt-5.5',
  'gemini',
  'grok',
  'deepseek',
  'mistral',
]);

function isValidModelId(value: unknown): value is BuiltInModelId {
  return typeof value === 'string' && VALID_MODEL_IDS.has(value as BuiltInModelId);
}

// ─── Internal read helper ─────────────────────────────────────────────────────

/**
 * Read and validate the stored record from localStorage.
 *
 * Silently drops any entry where the key is not a valid ModelId or the value
 * is not a non-empty string (the version id is an arbitrary API model string
 * like "claude-opus-4-5" — we validate only that it is a non-empty string).
 *
 * Returns {} on any error or if the key is absent.
 */
function readStoredVersions(): Partial<Record<ModelId, string>> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(MODEL_VERSION_STORAGE_KEY);
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

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const result: Partial<Record<ModelId, string>> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (isValidModelId(key) && typeof value === 'string' && value.length > 0) {
      result[key] = value;
    }
    // Silently drop invalid entries.
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the stored version selection for all models.
 *
 * Returns a validated record. Only models with an explicit stored selection
 * appear in the result. Absence of a key means "use provider default".
 * Never throws.
 */
export function getModelVersions(): Partial<Record<ModelId, string>> {
  return readStoredVersions();
}

/**
 * Retrieve the stored selectedVersionId for a single model.
 *
 * Returns undefined if no version has been selected for this model
 * (i.e. the provider default should be used).
 * Never throws.
 */
export function getModelVersion(modelId: ModelId): string | undefined {
  return readStoredVersions()[modelId];
}

/**
 * Persist a version selection for a model.
 *
 * Reads the current stored record, sets the entry for modelId, writes back.
 * Atlas controls the valid version id strings — Gate does not validate the
 * version id beyond requiring it to be a non-empty string (consistent with
 * how `ModelVersionOption.id` is typed as `string` in /src/types/index.ts).
 *
 * Throws TypeError on an empty or non-string versionId — this is a developer
 * contract guard. Aria must pass a valid ModelVersionOption.id.
 *
 * Aria calls this when the user picks a version in the per-model settings panel.
 */
export function setModelVersion(modelId: ModelId, versionId: string): void {
  if (typeof versionId !== 'string' || versionId.length === 0) {
    throw new TypeError(
      `setModelVersion: versionId must be a non-empty string, got "${String(versionId)}".`
    );
  }

  const current = readStoredVersions();
  const updated: Partial<Record<ModelId, string>> = { ...current, [modelId]: versionId };
  localStorage.setItem(MODEL_VERSION_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Remove the stored version selection for a single model.
 *
 * After this call, getModelVersion(modelId) returns undefined, meaning Atlas
 * will use the provider default for that model.
 * No-op if modelId has no stored selection.
 */
export function clearModelVersion(modelId: ModelId): void {
  const current = readStoredVersions();

  if (!(modelId in current)) return;

  const updated = { ...current };
  delete updated[modelId];
  localStorage.setItem(MODEL_VERSION_STORAGE_KEY, JSON.stringify(updated));
}
