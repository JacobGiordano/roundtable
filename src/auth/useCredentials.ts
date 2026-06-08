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
import { getCredentials, saveCredentials, clearCredentials, hasCredential } from './credentials';

export interface CredentialState {
  /** Whether a key is currently stored for this provider. */
  isSet: boolean;
}

export interface UseCredentialsReturn {
  /** Per-provider credential status. */
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

const ALL_KEYS: CredentialKey[] = ['anthropic', 'openai'];

function buildStatus(): Record<CredentialKey, CredentialState> {
  return Object.fromEntries(
    ALL_KEYS.map((k) => [k, { isSet: hasCredential(k) }]),
  ) as Record<CredentialKey, CredentialState>;
}

export function useCredentials(): UseCredentialsReturn {
  const [status, setStatus] = useState<Record<CredentialKey, CredentialState>>(buildStatus);

  const save = useCallback((key: CredentialKey, value: string) => {
    saveCredentials(key, value);
    setStatus((prev) => ({ ...prev, [key]: { isSet: true } }));
  }, []);

  const clear = useCallback((key: CredentialKey) => {
    clearCredentials(key);
    setStatus((prev) => ({ ...prev, [key]: { isSet: false } }));
  }, []);

  const getRawKey = useCallback((key: CredentialKey): string | undefined => {
    return getCredentials(key);
  }, []);

  return { status, save, clear, getRawKey };
}
