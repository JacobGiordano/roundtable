/**
 * Gate — useUserPreferences.ts
 *
 * React hook that exposes UserPreferences state to the UI layer.
 * Returns [preferences, savePreferences] — a tuple consistent with Gate's
 * existing hook patterns (useCredentials, useTheme).
 *
 * Changes via savePreferences are applied immediately — components that call
 * this hook will re-render with the new value on the same tick.
 */

import { useState, useCallback } from 'react';
import type { UserPreferences } from '@/types';
import { getUserPreferences, saveUserPreferences } from './preferences';

/**
 * Hook for reading and updating user preferences.
 *
 * Returns a [UserPreferences, (prefs: UserPreferences) => void] tuple.
 * The setter persists to localStorage and triggers a re-render immediately.
 */
export function useUserPreferences(): [UserPreferences, (prefs: UserPreferences) => void] {
  const [preferences, setPreferences] = useState<UserPreferences>(getUserPreferences);

  const save = useCallback((prefs: UserPreferences) => {
    saveUserPreferences(prefs);
    setPreferences(prefs);
  }, []);

  return [preferences, save];
}
