/**
 * migration.ts — Schema versioning and migration for stored Conversation objects.
 *
 * ## Problem
 * Conversation objects are stored in localStorage with no schema version marker.
 * As the Conversation type evolves (new fields, renamed fields, removed fields),
 * there is no mechanism to detect or migrate stale stored data.
 *
 * ## Solution
 * All writes go through a StoredConversation envelope:
 *
 *   { schemaVersion: number; data: Conversation }
 *
 * On reads, the absence of an envelope signals legacy (version 0) data.
 * The migration pipeline runs the raw data through all steps from `fromVersion`
 * up to CURRENT_SCHEMA_VERSION.
 *
 * ## Adding a new schema version (e.g. version 2)
 *
 * 1. Increment CURRENT_SCHEMA_VERSION to 2.
 * 2. Add a migration function to MIGRATION_STEPS at index 1:
 *
 *    MIGRATION_STEPS[1] = function migrate1To2(data: unknown): unknown {
 *      // Example: rename `title` → `displayTitle`
 *      if (isObject(data) && 'title' in data) {
 *        return { ...data, displayTitle: (data as Record<string, unknown>).title };
 *      }
 *      return data;
 *    };
 *
 * The pipeline calls MIGRATION_STEPS[fromVersion](data), then
 * MIGRATION_STEPS[fromVersion + 1](result), etc., until the current version
 * is reached. Each step receives and returns `unknown` — the final result is
 * cast to Conversation after all steps complete.
 *
 * ## Boundary note
 * StoredConversation and all migration logic live exclusively in /src/storage/.
 * This type is NOT exported to other agents. Schema versioning is a storage-layer
 * concern — the Conversation interface in /src/types/index.ts must not be modified
 * to accommodate it.
 */

import type { Conversation } from '@/types/index';

// ─── Current version ──────────────────────────────────────────────────────────

/**
 * The schema version written by the current build.
 * Bump this integer when adding a new migration step.
 */
export const CURRENT_SCHEMA_VERSION = 1;

// ─── StoredConversation envelope ──────────────────────────────────────────────

/**
 * The on-disk shape for a Conversation in localStorage.
 *
 * NOT exported outside /src/storage/. This is an implementation detail of the
 * storage layer. The Conversation interface in /src/types/index.ts is the
 * domain contract and must remain unchanged.
 *
 * Legacy records (written before this envelope existed) are bare Conversation
 * objects with no schemaVersion field — those are treated as version 0.
 */
export interface StoredConversation {
  schemaVersion: number;
  data: Conversation;
}

// ─── Migration error ──────────────────────────────────────────────────────────

/**
 * Thrown by migrateConversation() when a stored record is so badly damaged
 * that no migration step can recover it (e.g. data is not an object at all,
 * or the version is from a future build this code cannot handle).
 *
 * Callers — LocalStorageProvider.loadConversation() and listConversations() —
 * catch this and return null / omit the entry rather than propagating a crash.
 */
export class MigrationError extends Error {
  /** The version the migration attempted to start from. */
  readonly fromVersion: number;

  constructor(message: string, fromVersion: number) {
    super(message);
    this.name = 'MigrationError';
    this.fromVersion = fromVersion;
  }
}

// ─── Migration steps ──────────────────────────────────────────────────────────

/**
 * A single migration step. Receives the raw data from the previous step (or
 * the original stored value) and returns the transformed data.
 *
 * Input is `unknown` — stored data may be partially corrupt, missing fields,
 * or structured differently from any known Conversation shape. Steps should
 * be defensive: check for the presence of fields before accessing them.
 */
type MigrationStep = (data: unknown) => unknown;

/**
 * Registry of migration steps, indexed by the fromVersion they handle.
 *
 * MIGRATION_STEPS[0] = migrate0To1  — handles version 0 → 1
 * MIGRATION_STEPS[1] = migrate1To2  — handles version 1 → 2 (not yet defined)
 *
 * To add version 2:
 *   1. Increment CURRENT_SCHEMA_VERSION to 2
 *   2. Add: MIGRATION_STEPS[1] = function migrate1To2(data) { ... }
 */
const MIGRATION_STEPS: MigrationStep[] = [
  // Step index 0: version 0 → 1 (identity migration)
  //
  // Existing stored Conversations written before the envelope existed are bare
  // Conversation objects. The Conversation shape has not changed between the
  // pre-envelope era and schema version 1, so this migration is a no-op.
  // It exists to establish the pipeline pattern and ensure legacy data is
  // correctly promoted to the current envelope on next write.
  function migrate0To1(data: unknown): unknown {
    return data;
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Minimal type guard — confirms value is a non-null, non-array object.
 * Used to validate data before attempting field access in migration steps.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// ─── Envelope detection ───────────────────────────────────────────────────────

/**
 * Detect whether a parsed localStorage value is a StoredConversation envelope
 * or a legacy bare Conversation (version 0).
 *
 * An envelope has:
 *   - schemaVersion: number
 *   - data: object
 *
 * Any value missing either field (or where schemaVersion is not a number, or
 * data is not an object) is treated as a version 0 bare Conversation.
 */
function isStoredConversationEnvelope(
  value: unknown
): value is { schemaVersion: number; data: unknown } {
  return (
    isObject(value) &&
    typeof value['schemaVersion'] === 'number' &&
    isObject(value['data'])
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the migration pipeline from `fromVersion` up to CURRENT_SCHEMA_VERSION.
 *
 * Each MIGRATION_STEPS[v] function is called in sequence, passing the output
 * of one step as the input of the next. The final result is cast to Conversation.
 *
 * @param raw         The raw data to migrate — the Conversation object extracted
 *                    from the envelope (or the bare value for version 0 legacy
 *                    data). Type is `unknown` because persisted data cannot be
 *                    trusted to match any typed shape.
 * @param fromVersion The schema version the data was written at.
 *                    0 = legacy pre-envelope data.
 *
 * @returns A Conversation cast from the migrated data.
 *
 * @throws MigrationError when:
 *   - `raw` is not an object (unrecoverable corruption)
 *   - `fromVersion` is greater than CURRENT_SCHEMA_VERSION (data from a future build)
 *   - A required migration step is not defined in MIGRATION_STEPS
 *
 * Callers must catch MigrationError and treat the record as unreadable.
 */
export function migrateConversation(raw: unknown, fromVersion: number): Conversation {
  if (!isObject(raw)) {
    throw new MigrationError(
      `Cannot migrate conversation: expected an object but got ${typeof raw}`,
      fromVersion
    );
  }

  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    // Data was written by a newer build — downgrade migration is not supported.
    throw new MigrationError(
      `Cannot migrate conversation from future version ${fromVersion} ` +
        `(current build supports up to version ${CURRENT_SCHEMA_VERSION})`,
      fromVersion
    );
  }

  if (fromVersion === CURRENT_SCHEMA_VERSION) {
    // Fast path: already at current version, no migration steps needed.
    // Double-cast through unknown: TypeScript cannot verify the shape of
    // stored data at compile time — we trust wrapForStorage wrote valid data.
    return raw as unknown as Conversation;
  }

  let data: unknown = raw;

  // Run each migration step in sequence from fromVersion to CURRENT_SCHEMA_VERSION.
  for (let v = fromVersion; v < CURRENT_SCHEMA_VERSION; v++) {
    const step = MIGRATION_STEPS[v];
    if (!step) {
      throw new MigrationError(
        `No migration step defined for version ${v} → ${v + 1}. ` +
          `CURRENT_SCHEMA_VERSION is ${CURRENT_SCHEMA_VERSION} but MIGRATION_STEPS[${v}] is missing.`,
        fromVersion
      );
    }
    data = step(data);
  }

  return data as Conversation;
}

/**
 * Wrap a Conversation in a StoredConversation envelope at CURRENT_SCHEMA_VERSION.
 *
 * Always call this before serialising a conversation to localStorage.
 * The envelope is what makes the schema version detectable on the read path.
 *
 * Ghost-mode guard: callers must have already checked `isGhost` before reaching
 * this function. wrapForStorage does not check isGhost — it is not on the write
 * path guard; it is a serialisation helper.
 */
export function wrapForStorage(conversation: Conversation): StoredConversation {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    data: conversation,
  };
}

/**
 * Parse a raw localStorage string into a Conversation, detecting and running
 * migrations as needed.
 *
 * This is the single entry point for all Conversation reads from localStorage.
 * LocalStorageProvider uses this in both loadConversation() and listConversations().
 *
 * Returns null when:
 *   - `raw` is null or empty (key not found in localStorage)
 *   - `raw` is not valid JSON (corrupt data)
 *   - Migration fails (MigrationError — logged as a console.warn, not thrown)
 *
 * Never throws. Callers receive null for any failure and may log or omit.
 */
export function parseStoredConversation(raw: string | null): Conversation | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not valid JSON — the stored data is corrupt beyond recovery.
    return null;
  }

  // ── Envelope path ────────────────────────────────────────────────────────────
  if (isStoredConversationEnvelope(parsed)) {
    const { schemaVersion, data } = parsed;

    if (schemaVersion === CURRENT_SCHEMA_VERSION) {
      // Fast path: already at current version. No migration steps needed.
      return data as Conversation;
    }

    // Migrate from the stored version up to the current version.
    try {
      return migrateConversation(data, schemaVersion);
    } catch (err) {
      console.warn(
        `[Vault] Failed to migrate conversation from schema version ${schemaVersion}:`,
        err instanceof Error ? err.message : err
      );
      return null;
    }
  }

  // ── Legacy path (version 0) ───────────────────────────────────────────────────
  // The value has no schemaVersion field — it was written before the envelope
  // existed. Treat it as version 0 and run the migration pipeline from there.
  try {
    return migrateConversation(parsed, 0);
  } catch (err) {
    console.warn(
      '[Vault] Failed to migrate legacy (version 0) conversation:',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
