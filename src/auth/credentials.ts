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

import type { CredentialKey, GetCredentialsFn, SaveCredentialsFn, ClearCredentialsFn } from '@/types';

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
};
