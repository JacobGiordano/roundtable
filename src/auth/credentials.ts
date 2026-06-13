/**
 * Gate — credentials.ts
 *
 * Implements GetCredentialsFn, SaveCredentialsFn, and ClearCredentialsFn from
 * /src/types/index.ts. Keys are stored in localStorage only.
 *
 * Security rules (non-negotiable):
 *   - Keys are NEVER logged
 *   - Keys are NEVER exported to any file or clipboard by this module
 *   - Keys are NEVER transmitted except to the respective provider's API endpoint
 *   - localStorage is the sole persistence layer
 */

import type { BuiltInCredentialKey, BuiltInModelId, CredentialKey, GetCredentialsFn, SaveCredentialsFn, ClearCredentialsFn, ModelConfig } from '@/types';

// ─── Storage key prefix ────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'rt_key_' as const;

function storageKey(key: CredentialKey): string {
  return `${STORAGE_PREFIX}${key}`;
}

// ─── Implementations ──────────────────────────────────────────────────────────

/**
 * Retrieve a stored API key from localStorage.
 * Returns undefined if the key has never been set or was cleared.
 */
export const getCredentials: GetCredentialsFn = (key: CredentialKey): string | undefined => {
  const stored = localStorage.getItem(storageKey(key));
  return stored ?? undefined;
};

/**
 * Persist an API key to localStorage.
 * Never log, export, or transmit the value.
 */
export const saveCredentials: SaveCredentialsFn = (key: CredentialKey, value: string): void => {
  localStorage.setItem(storageKey(key), value);
};

/**
 * Remove a stored API key from localStorage.
 */
export const clearCredentials: ClearCredentialsFn = (key: CredentialKey): void => {
  localStorage.removeItem(storageKey(key));
};

/**
 * Check whether a given API key is currently set.
 * Safe to call frequently — does not expose the value.
 */
export function hasCredential(key: CredentialKey): boolean {
  return localStorage.getItem(storageKey(key)) !== null;
}

// ─── Model → credential mapping ───────────────────────────────────────────────

/**
 * Gate owns this mapping. Do NOT import from /src/models — Gate maintains its
 * own BuiltInModelId → BuiltInCredentialKey relationship so the auth layer has
 * no dependency on Atlas.
 *
 * Typed as Record<BuiltInModelId, BuiltInCredentialKey> — this is a complete,
 * exhaustive mapping over the closed set of built-in providers only. Custom
 * provider credentials are managed separately via their own CredentialKey
 * (pattern: "custom:<id>") and are NOT entries in this map.
 */
export const MODEL_CREDENTIAL_MAP: Record<BuiltInModelId, BuiltInCredentialKey> = {
  'claude': 'anthropic',
  'gpt-5.5': 'openai',
  'gemini': 'google',
  'grok': 'xai',
  'deepseek': 'deepseek',
  'mistral': 'mistral',
};

/**
 * Given a list of ModelConfig objects, returns the deduplicated set of
 * CredentialKey values required by the currently-active models.
 *
 * Only models with `isActive === true` are considered. The result contains no
 * duplicates (e.g. two active Claude variants both requiring 'anthropic' yield
 * only one entry).
 *
 * Custom model IDs (those not in MODEL_CREDENTIAL_MAP) are silently skipped —
 * custom providers manage their own credential lookup via ProviderRoster and
 * the "custom:<id>" key convention. This function covers built-ins only.
 */
export function getRequiredCredentialKeys(models: ModelConfig[]): CredentialKey[] {
  const keys = new Set<CredentialKey>();
  for (const model of models) {
    if (model.isActive) {
      const credKey = MODEL_CREDENTIAL_MAP[model.modelId as BuiltInModelId];
      if (credKey !== undefined) {
        keys.add(credKey);
      }
      // Custom model IDs not in MODEL_CREDENTIAL_MAP are intentionally skipped.
    }
  }
  return Array.from(keys);
}

/**
 * Map from ModelId's credentialKey to a human-readable provider name.
 * Centralised here so the UI can stay generic.
 */
export const CREDENTIAL_LABELS: Record<CredentialKey, { provider: string; placeholder: string; docsUrl: string }> = {
  anthropic: {
    provider: 'Anthropic',
    placeholder: 'sk-ant-…',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    provider: 'OpenAI',
    placeholder: 'sk-…',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  google: {
    provider: 'Google AI Studio',
    placeholder: 'AIza…',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  xai: {
    provider: 'xAI',
    placeholder: 'xai-…',
    docsUrl: 'https://console.x.ai/team/default/api-keys',
  },
  deepseek: {
    provider: 'DeepSeek',
    placeholder: 'sk-…',
    docsUrl: 'https://platform.deepseek.com/api-keys',
  },
  mistral: {
    provider: 'Mistral AI',
    placeholder: '…',
    docsUrl: 'https://console.mistral.ai/api-keys/',
  },
};
