/**
 * useLiveVersionCatalog — fetches live model version catalogs for built-in registry entries.
 *
 * Issue #407: wire live model discovery into the version picker.
 *
 * Atlas shipped resolveVersionCatalog in wave 25 (#420). This hook calls it for each
 * built-in model and caches the results. It is called by ModelSelectorPanel when the
 * panel opens, so catalog fetches are deferred until the user actually opens the panel
 * (not on app mount).
 *
 * resolveVersionCatalog is a cross-agent exception: it is a pure utility exported from
 * @/models per the documented exception in models/index.ts and CLAUDE.md. The function
 * runs the full fallback chain (live API → OpenRouter → models.json → bundled) and
 * always returns a non-empty array (worst case: the bundled list). No error handling
 * is needed by callers — absence of live results silently falls through to bundled.
 *
 * getCredentials is imported from @/auth — a Gate pure-read utility, permitted
 * exception per CLAUDE.md (same pattern as InputBar.tsx and App.tsx).
 *
 * MODEL_REGISTRY and MODEL_CREDENTIAL_MAP are imported from @/models and @/auth
 * respectively — both documented cross-agent exceptions.
 */

import { useState, useCallback } from 'react';
import type { ModelCatalogEntry, ModelId } from '@/types';
// Cross-agent exception: resolveVersionCatalog and MODEL_REGISTRY are pure data/utility
// exports from @/models per documented exception in models/index.ts.
import { resolveVersionCatalog, MODEL_REGISTRY } from '@/models';
// Cross-agent exception: getCredentials and MODEL_CREDENTIAL_MAP are Gate pure-read
// utilities — same permitted-exception pattern as App.tsx and InputBar.tsx.
import { getCredentials, MODEL_CREDENTIAL_MAP } from '@/auth';
import type { BuiltInModelId } from '@/types';

/** Map from modelId → list of discovered (or bundled) catalog entries. */
export type LiveCatalogMap = Map<ModelId, ModelCatalogEntry[]>;

/**
 * Fetches live version catalogs for all built-in registry models.
 *
 * Returns:
 *   `catalogMap`   — Map<modelId, ModelCatalogEntry[]>. Empty until fetch completes.
 *                    Falls back to bundled list when live API / network is unavailable.
 *   `isFetching`   — true while any catalog fetch is in progress.
 *   `fetchCatalogs` — trigger function. Call this when the version picker opens.
 *                    Safe to call multiple times — re-fetches if not already in progress.
 *
 * The hook fetches all models in parallel. If a model's fetch fails (network error,
 * CORS block, missing API key), resolveVersionCatalog falls through to the bundled list
 * automatically — `catalogMap` will always contain at least the bundled entries.
 */
export function useLiveVersionCatalog() {
  const [catalogMap, setCatalogMap] = useState<LiveCatalogMap>(new Map());
  const [isFetching, setIsFetching] = useState(false);

  const fetchCatalogs = useCallback(async () => {
    if (isFetching) return;
    setIsFetching(true);

    try {
      // Fan-out: fetch all built-in registry entries in parallel.
      const results = await Promise.all(
        MODEL_REGISTRY.map(async (entry) => {
          // Look up the API key for this model's credential.
          // Built-in providers use MODEL_CREDENTIAL_MAP; custom providers are not
          // in MODEL_REGISTRY so there is no custom case here.
          const credKey = MODEL_CREDENTIAL_MAP[entry.modelId as BuiltInModelId];
          const apiKey = credKey ? getCredentials(credKey) : undefined;

          // resolveVersionCatalog handles all tiers (live API → OpenRouter → bundled)
          // and always returns a non-empty array. No try/catch needed here.
          const catalog = await resolveVersionCatalog(entry, apiKey);
          return { modelId: entry.modelId, catalog };
        }),
      );

      // Build the new catalog map from results.
      const next: LiveCatalogMap = new Map();
      for (const { modelId, catalog } of results) {
        next.set(modelId, catalog);
      }
      setCatalogMap(next);
    } finally {
      setIsFetching(false);
    }
  }, [isFetching]);

  return { catalogMap, isFetching, fetchCatalogs };
}
