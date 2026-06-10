/**
 * storageFactory — provider switcher and data migration utility.
 *
 * `createStorageProvider(config)` is the single entry point for constructing
 * a StorageProvider. Callers never instantiate LocalStorageProvider or
 * ServerStorageProvider directly — they go through this factory. This is the
 * Phase 4 swap surface: changing `mode` from 'local' to 'server' is all that
 * is needed to redirect all storage calls to the self-hosted backend.
 *
 * `StorageConfig` is kept internal to /src/storage because it is an
 * implementation detail of provider construction. Gate will hold the config
 * value (read from user preferences); Aria reads it via whatever Gate exposes.
 * Neither needs to know the concrete factory type — they only need
 * `StorageProvider` from @/types.
 *
 * Migration:
 *   `migrateLocalToServer` reads all conversations from a LocalStorageProvider
 *   and writes each one to a ServerStorageProvider. Failures per-conversation
 *   are collected (never fatal) so the caller can report partial success.
 */

import type { StorageProvider } from '@/types/index';
import { LocalStorageProvider } from './LocalStorageProvider';
import { ServerStorageProvider } from './ServerStorageProvider';

// ─── StorageConfig ────────────────────────────────────────────────────────────

/**
 * Discriminated union driving provider construction.
 *
 * { mode: 'local' }
 *   → LocalStorageProvider (no additional config needed)
 *
 * { mode: 'server'; baseUrl: string; authToken?: string }
 *   → ServerStorageProvider pointing at the given self-hosted backend URL
 *
 * This type is intentionally NOT exported from @/types/index.ts — it is an
 * internal storage concern. Gate constructs the config and passes it to
 * createStorageProvider; neither Gate nor Aria need to import this type
 * directly. If cross-agent sharing becomes necessary in Phase 4, Arch should
 * add it to @/types/index.ts under the StorageProvider section.
 */
export type StorageConfig =
  | { mode: 'local' }
  | { mode: 'server'; baseUrl: string; authToken?: string };

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Construct the appropriate StorageProvider for the given config.
 *
 * The returned value satisfies the `StorageProvider` interface contract — the
 * caller never depends on the concrete class. This is the sole place in the
 * codebase where the concrete provider classes are instantiated.
 */
export function createStorageProvider(config: StorageConfig): StorageProvider {
  if (config.mode === 'local') {
    return new LocalStorageProvider();
  }

  return new ServerStorageProvider({
    baseUrl: config.baseUrl,
    authToken: config.authToken,
  });
}

// ─── Migration ────────────────────────────────────────────────────────────────

/**
 * Result of a local-to-server migration attempt.
 */
export interface MigrationResult {
  /** Number of conversations successfully written to the server. */
  migrated: number;
  /** Number of conversations that failed to write. */
  failed: number;
  /** Errors collected from failed writes, in the order they occurred. */
  errors: Error[];
}

/**
 * Copy all conversations from a LocalStorageProvider to a ServerStorageProvider.
 *
 * Reads the full conversation list from `local` and writes each one to `server`
 * via `saveConversation`. Individual failures are collected in the result rather
 * than aborting the migration — every conversation gets an attempt regardless
 * of whether prior ones succeeded.
 *
 * Ghost-mode conversations are never in localStorage (the ghost-mode guard
 * prevented them from being written), so `listConversations()` will never
 * return them. No ghost-mode check is needed here.
 *
 * The caller is responsible for deciding what to do after the migration
 * (e.g. deleting local data, reporting errors to the user). This function
 * only moves data — it does not clean up the source.
 */
export async function migrateLocalToServer(
  local: LocalStorageProvider,
  server: ServerStorageProvider,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    failed: 0,
    errors: [],
  };

  let conversations;
  try {
    conversations = await local.listConversations();
  } catch (err: unknown) {
    // If we cannot read local storage at all, surface a single error.
    const error = err instanceof Error ? err : new Error(String(err));
    result.failed = 1;
    result.errors.push(new Error(`Failed to read local conversations: ${error.message}`));
    return result;
  }

  for (const conv of conversations) {
    try {
      await server.saveConversation(conv);
      result.migrated++;
    } catch (err: unknown) {
      result.failed++;
      result.errors.push(
        err instanceof Error
          ? err
          : new Error(`Unknown error migrating conversation "${conv.id}": ${String(err)}`)
      );
    }
  }

  return result;
}
