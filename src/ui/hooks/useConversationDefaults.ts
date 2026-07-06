/**
 * useConversationDefaults — loads and saves conversation defaults.
 *
 * On mount: calls getConversationDefaults() once and exposes the result via
 * `defaults` + `defaultsLoaded`. App.tsx applies these to seed the initial
 * active-model roster and interaction mode when there is no active conversation.
 *
 * saveDefaults: persists the current active model IDs and interaction mode so
 * the next session starts with the same state. Ghost-mode guard is built in —
 * the call is a no-op when `isGhost` is true. QuotaExceededError (and all other
 * save failures) are caught silently — failure to save defaults is non-fatal.
 */

import { useCallback, useEffect, useState } from 'react';
import type { ConversationDefaults, InteractionMode, ModelId } from '@/types';
// Vault cross-agent exception: getConversationDefaults and saveConversationDefaults
// are pure storage utilities exported from @/storage, analogous to the
// getSessionTokenUsage import from @/models. Aria reads stored defaults at
// app-boot to seed the initial model roster and interaction mode for new
// conversations; Aria writes them whenever the user changes the active model
// set or interaction mode. See CLAUDE.md §exceptions.
import { getConversationDefaults, saveConversationDefaults } from '@/storage';

// ─── Return type ──────────────────────────────────────────────────────────────

export interface UseConversationDefaultsReturn {
  /** Loaded defaults. Null if none have been stored yet, or if the record is corrupt. */
  defaults: ConversationDefaults | null;
  /** True once the async load has completed (regardless of whether defaults exist). */
  defaultsLoaded: boolean;
  /**
   * Persist the current active model IDs and interaction mode as new defaults.
   *
   * Ghost-mode guard: no-op when `isGhost` is true — ghost state must never
   * propagate into stored defaults.
   *
   * Storage failure is caught silently. Callers do not need to handle errors.
   */
  saveDefaults: (
    activeModelIds: ModelId[],
    interactionMode: InteractionMode,
    isGhost: boolean,
  ) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationDefaults(): UseConversationDefaultsReturn {
  const [defaults, setDefaults] = useState<ConversationDefaults | null>(null);
  const [defaultsLoaded, setDefaultsLoaded] = useState(false);

  // Load defaults once on mount. The effect is fire-and-forget; the `cancelled`
  // flag prevents a stale setState call if the component unmounts before the
  // promise resolves (unlikely in practice but guards against test teardown races).
  useEffect(() => {
    let cancelled = false;
    void getConversationDefaults().then((result) => {
      if (!cancelled) {
        setDefaults(result);
        setDefaultsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveDefaults = useCallback(
    (activeModelIds: ModelId[], interactionMode: InteractionMode, isGhost: boolean) => {
      if (isGhost) return;
      void saveConversationDefaults({ activeModelIds, interactionMode }).catch(() => {
        // QuotaExceededError or other storage failure — non-fatal, ignore silently.
      });
    },
    [],
  );

  return { defaults, defaultsLoaded, saveDefaults };
}
