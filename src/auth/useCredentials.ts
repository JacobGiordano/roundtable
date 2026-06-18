/**
 * Gate — useCredentials.ts
 *
 * React hook that exposes credential state to the UI layer without ever
 * exposing raw key values in a way that would encourage misuse.
 *
 * The hook is the ONLY way the UI should interact with Gate's storage.
 */

import { useState, useCallback } from 'react';
import type { CredentialKey } from '@/types';
import { getCredentials, saveCredentials, clearCredentials, hasCredential, CREDENTIAL_LABELS } from './credentials';
import { getProviderRoster } from './providerRoster';

export interface CredentialState {
  /** Whether a key is currently stored for this provider. */
  isSet: boolean;
}

export interface UseCredentialsReturn {
  /** Per-provider credential status. Includes both built-in and custom provider keys. */
  status: Record<CredentialKey, CredentialState>;
  /**
   * Save a new API key. The raw value is passed directly to saveCredentials
   * and then discarded — it is NOT stored in React state.
   */
  save: (key: CredentialKey, value: string) => void;
  /** Remove the stored API key for a provider. */
  clear: (key: CredentialKey) => void;
  /**
   * Retrieve the raw key value — only call this immediately before sending
   * a request to the provider. Never store the returned string in component
   * state or pass it to non-network code.
   */
  getRawKey: (key: CredentialKey) => string | undefined;
}

/**
 * All known built-in provider credential keys, derived from CREDENTIAL_LABELS
 * in credentials.ts. Extending the set of built-in providers only requires
 * adding an entry to CREDENTIAL_LABELS — no changes needed here.
 */
const BUILTIN_KEYS: CredentialKey[] = Object.keys(CREDENTIAL_LABELS) as CredentialKey[];

/**
 * Collect credential keys for custom providers from the roster.
 * Only entries with a defined credentialKey are included — providers that
 * explicitly opted out of authentication (credentialKey absent) are skipped.
 */
function getCustomProviderKeys(): CredentialKey[] {
  const roster = getProviderRoster();
  const keys: CredentialKey[] = [];
  for (const entry of roster) {
    if (entry.kind === 'custom' && entry.credentialKey !== undefined) {
      keys.push(entry.credentialKey);
    }
  }
  return keys;
}

/**
 * Build the full status record covering both built-in and custom provider keys.
 * Custom provider keys are discovered from the roster at call time so newly
 * added providers are visible on the next save/clear cycle.
 */
function buildStatus(): Record<CredentialKey, CredentialState> {
  const allKeys = [...BUILTIN_KEYS, ...getCustomProviderKeys()];
  return Object.fromEntries(
    allKeys.map((k) => [k, { isSet: hasCredential(k) }]),
  ) as Record<CredentialKey, CredentialState>;
}

export function useCredentials(): UseCredentialsReturn {
  const [status, setStatus] = useState<Record<CredentialKey, CredentialState>>(buildStatus);

  const save = useCallback((key: CredentialKey, value: string) => {
    saveCredentials(key, value);
    // Rebuild the full status on each write so that custom provider keys
    // added after mount are automatically included in the returned record.
    setStatus(() => ({ ...buildStatus(), [key]: { isSet: true } }));
  }, []);

  const clear = useCallback((key: CredentialKey) => {
    clearCredentials(key);
    setStatus(() => ({ ...buildStatus(), [key]: { isSet: false } }));
  }, []);

  const getRawKey = useCallback((key: CredentialKey): string | undefined => {
    return getCredentials(key);
  }, []);

  return { status, save, clear, getRawKey };
}
