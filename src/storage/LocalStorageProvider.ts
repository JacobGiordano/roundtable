/**
 * LocalStorageProvider — Vault implementation of StorageProvider.
 *
 * Storage layout:
 *   roundtable:conv:{id}   → JSON-serialised StoredConversation envelope
 *                            (or bare Conversation for legacy version 0 records)
 *   roundtable:index       → JSON-serialised string[] of conversation IDs
 *
 * Ghost-mode conversations must never reach this layer — isGhost is the first
 * guard on every write path, before any index or data key is touched.
 *
 * Schema versioning:
 *   All writes go through the StoredConversation envelope defined in migration.ts.
 *   All reads go through parseStoredConversation(), which detects the envelope,
 *   identifies bare (version 0) records, and runs migrations as needed.
 *   See migration.ts for how to add a new schema version.
 *
 * Caching:
 *   listConversations() maintains a Map<id, Conversation> cache on the instance.
 *   The first call does a full localStorage scan and populates the cache.
 *   Subsequent calls return from the cache without touching localStorage.
 *   saveConversation() and deleteConversation() keep the cache in sync on every
 *   write so the cached result is never stale.
 */

import type {
  Conversation,
  ExportedConversation,
  ExportFormat,
  StorageProvider,
} from '@/types/index';

import { buildExportedConversation } from './exporters';
import type { ExportOptions } from './exporters';
import { triggerDownload } from './fileio';
import { wrapForStorage, parseStoredConversation } from './migration';
import {
  estimateLocalStorageBytes,
  estimateStringBytes,
  evictOldGeneratedImages,
  isStorageNearCapacity,
  STORAGE_QUOTA_FLOOR_BYTES,
} from './storageUsage';

// ─── Constants ────────────────────────────────────────────────────────────────

const NS = 'roundtable';
const INDEX_KEY = `${NS}:index`;

function convKey(id: string): string {
  return `${NS}:conv:${id}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps localStorage.setItem and converts QuotaExceededError into a
 * descriptive Error so callers can surface it gracefully.
 */
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        // Firefox legacy name
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new Error(
        'Storage quota exceeded. Please delete some conversations to free space.'
      );
    }
    throw err;
  }
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    // Corrupted index — treat as empty; existing conversations remain accessible
    // by direct key lookup but won't appear in list until re-saved.
    return [];
  }
}

function writeIndex(ids: string[]): void {
  safeSet(INDEX_KEY, JSON.stringify(ids));
}

/**
 * Parse a raw localStorage value into a Conversation, running schema
 * migrations as needed. Delegates to migration.ts — see parseStoredConversation()
 * for the full behaviour (envelope detection, version 0 legacy path, error handling).
 */
function parseConversation(raw: string | null): Conversation | null {
  return parseStoredConversation(raw);
}

// ─── LocalStorageProvider ─────────────────────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  /**
   * In-memory cache of all persisted conversations, keyed by conversation ID.
   *
   * Populated on the first `listConversations()` call (full scan). After that,
   * every write path (`saveConversation`, `deleteConversation`) keeps the cache
   * in sync so subsequent `listConversations()` calls return from memory without
   * touching localStorage again.
   *
   * `null` means the cache has not yet been populated — the next
   * `listConversations()` call must do a full scan to initialise it.
   *
   * Cache invariants:
   *   - Only non-ghost conversations are ever stored here (ghost-mode guard runs
   *     before any cache update on write paths).
   *   - Corrupt entries are dropped during the initial full scan, matching the
   *     existing `listConversations()` behaviour.
   *   - The cache is private to this provider instance. `useConversationStore`
   *     holds the provider in a stable ref, so the cache persists for the
   *     lifetime of the hook mount.
   */
  private _cache: Map<string, Conversation> | null = null;

  /**
   * Persist a conversation. Ghost-mode conversations are silently skipped —
   * isGhost is the first guard on this write path; nothing is ever written to
   * storage for ghost conversations.
   *
   * Writes a StoredConversation envelope (schemaVersion + data) so the read
   * path can detect the schema version and run migrations if needed.
   *
   * Pre-flight size check: before writing, estimates the current localStorage
   * usage. If usage is at or above 80% of the conservative 5 MB quota floor,
   * a console warning is emitted and `evictOldGeneratedImages()` is applied
   * to the conversation payload before serialization — stripping base64 from
   * all but the most recent 3 GeneratedImage entries. This eviction is applied
   * to the serialized payload only; the in-memory conversation object passed
   * by the caller is never mutated. After eviction, the write proceeds normally
   * — safeSet still catches a final QuotaExceededError if the eviction was not
   * sufficient to bring usage below quota.
   *
   * Cache: after writing to localStorage, the cache entry is updated (or added)
   * so that subsequent `listConversations()` calls do not need to re-read from
   * storage. The cache stores the original un-evicted conversation so Aria
   * continues to render full base64 images for the current session. The cache
   * is only updated if it has already been populated — an uninitialised cache
   * (`null`) is left alone so the next `listConversations()` does the full
   * scan naturally.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    // Ghost-mode guard — first line, before any index or data key is touched.
    if (conversation.isGhost) return;

    // ── Pre-flight size check ──────────────────────────────────────────────────
    // Estimate current localStorage usage. If we are near capacity, evict old
    // GeneratedImage base64 blobs from the payload before serializing. This is
    // the only write-path that needs this check — all other writes (index,
    // conversation-defaults) are tiny compared to image blobs.
    const usedBytes = estimateLocalStorageBytes();
    const quotaBytes = STORAGE_QUOTA_FLOOR_BYTES;

    // Determine the conversation to actually serialize. We start with a
    // candidate payload and apply eviction if storage is near capacity.
    let convToWrite = conversation;

    if (isStorageNearCapacity(usedBytes, quotaBytes)) {
      // Estimate how large this conversation's payload would be after eviction.
      const evicted = evictOldGeneratedImages(conversation);
      const candidateJson = JSON.stringify(wrapForStorage(evicted));
      const candidateBytes = estimateStringBytes(candidateJson);
      const projectedTotal = usedBytes + candidateBytes;

      console.warn(
        `[Vault] Storage near capacity: ${usedBytes} / ${quotaBytes} bytes used ` +
          `(${Math.round((usedBytes / quotaBytes) * 100)}%). ` +
          `Evicting old generated image base64 blobs before saving conversation ` +
          `"${conversation.id}". Projected total after write: ~${projectedTotal} bytes.`
      );

      convToWrite = evicted;
    }

    // Wrap in the StoredConversation envelope before writing.
    // This records the current schemaVersion so the read path can migrate
    // stale records written by older builds.
    //
    // IMPORTANT — transactional ordering: write the data key FIRST, update the
    // index SECOND. If the data write throws (QuotaExceededError), the index is
    // never touched and no orphan ID is created. Reversing this order was the
    // root cause of #481: writeIndex() could succeed while the subsequent
    // safeSet() failed, leaving an index entry pointing at a key that does not
    // exist.
    const envelope = wrapForStorage(convToWrite);
    safeSet(convKey(conversation.id), JSON.stringify(envelope));

    // Data write succeeded — now it is safe to update the index.
    const ids = readIndex();
    if (!ids.includes(conversation.id)) {
      ids.push(conversation.id);
      writeIndex(ids);
    }

    // Keep the cache in sync with the original (un-evicted) conversation so
    // Aria continues to render full base64 images for the current session.
    // The persisted payload may have evicted base64 blobs, but the in-memory
    // representation is always the full original.
    if (this._cache !== null) {
      this._cache.set(conversation.id, conversation);
    }
  }

  /** Returns null if the conversation does not exist or the stored data is corrupt. */
  async loadConversation(id: string): Promise<Conversation | null> {
    const raw = localStorage.getItem(convKey(id));
    return parseConversation(raw);
  }

  /**
   * Returns all conversations sorted newest-first by `updatedAt`.
   *
   * First call: performs a full scan of localStorage (reads every conversation
   * referenced by the index), populates the internal cache, and returns the
   * sorted result.
   *
   * Subsequent calls: returns the cached result directly without touching
   * localStorage. The cache is kept in sync by `saveConversation` and
   * `deleteConversation`, so no re-scan is needed.
   *
   * Entries whose underlying data is missing or corrupt are silently skipped
   * to keep the list consistent even if storage is partially cleared.
   */
  async listConversations(): Promise<Conversation[]> {
    if (this._cache === null) {
      // First call — full scan to populate the cache.
      const ids = readIndex();
      this._cache = new Map();
      const orphanIds: string[] = [];

      for (const id of ids) {
        const conv = parseConversation(localStorage.getItem(convKey(id)));
        if (conv !== null) {
          this._cache.set(id, conv);
        } else {
          // The index references an ID with no corresponding data key — an orphan.
          // Collect it for pruning below.
          orphanIds.push(id);
        }
      }

      // Fire-and-forget background prune: remove orphan IDs from the index.
      // This handles IDs that accumulated before the transactional-ordering fix
      // for #481 (data write now precedes index write). Runs only when orphans
      // are detected to avoid unnecessary index writes on every cold start.
      if (orphanIds.length > 0) {
        this._pruneOrphanIds(orphanIds);
      }
    }

    // Return cache contents sorted newest-first by updatedAt.
    const conversations = Array.from(this._cache.values());
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    return conversations;
  }

  /**
   * Removes a set of known-orphan IDs from the persisted index.
   *
   * Called as a background maintenance step after `listConversations()` warms
   * the cache and detects index entries with no corresponding data key.
   *
   * Orphans are created when the index write succeeds but the subsequent data
   * write fails (e.g. QuotaExceededError). The fix in `saveConversation()` that
   * reverses the write order (data first, index second) prevents new orphans from
   * forming. This method cleans up any that accumulated before the fix shipped.
   *
   * This method never throws — a failure to prune the index is non-fatal. The
   * orphan IDs will simply be detected and re-queued on the next cold start.
   */
  private _pruneOrphanIds(orphanIds: string[]): void {
    try {
      const orphanSet = new Set(orphanIds);
      const currentIds = readIndex();
      const prunedIds = currentIds.filter((id) => !orphanSet.has(id));
      if (prunedIds.length < currentIds.length) {
        writeIndex(prunedIds);
        console.info(
          `[Vault] pruneIndex: removed ${currentIds.length - prunedIds.length} orphan ` +
            `ID(s) from the conversation index: ${orphanIds.join(', ')}`
        );
      }
    } catch {
      // Non-fatal — swallow and log. The orphan IDs will be detected again on
      // the next cold start. We do not surface this to the caller because it
      // does not affect the correctness of the returned conversation list.
      console.warn('[Vault] pruneIndex: failed to write pruned index; orphans will be retried on next cold start.');
    }
  }

  /** Removes the conversation from both the index and its storage key. */
  async deleteConversation(id: string): Promise<void> {
    const ids = readIndex().filter((i) => i !== id);
    writeIndex(ids);
    localStorage.removeItem(convKey(id));

    // Remove from cache if populated.
    if (this._cache !== null) {
      this._cache.delete(id);
    }
  }

  /**
   * Sets archivedAt on the stored conversation. No-op if it does not exist.
   * Archived conversations remain in the index — filtering is the UI's
   * responsibility. Group membership (groupId) is preserved.
   */
  async archiveConversation(id: string): Promise<void> {
    const conv = await this.loadConversation(id);
    if (!conv) return;

    const archived: Conversation = {
      ...conv,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveConversation(archived);
  }

  /**
   * Clears the archivedAt timestamp, returning the conversation to active
   * status. No-op if the conversation does not exist or was not archived.
   */
  async unarchiveConversation(id: string): Promise<void> {
    const conv = await this.loadConversation(id);
    if (!conv) return;
    if (conv.archivedAt === undefined) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { archivedAt: _archivedAt, ...rest } = conv;
    const unarchived: Conversation = {
      ...rest,
      updatedAt: Date.now(),
    };

    await this.saveConversation(unarchived);
  }

  /**
   * Serializes the conversation to the requested format and returns the result.
   * Returns null if the conversation does not exist.
   *
   * The optional `options` parameter is an extension beyond the `StorageProvider`
   * interface (which only has `id` and `format`). TypeScript accepts extra
   * optional parameters on implementations. Callers that hold a `StorageProvider`
   * reference cannot pass `options` — they should use the `useConversationStore`
   * hook's `exportConversation` method, which accepts the full options object and
   * threads it through `loadConversation` + `buildExportedConversation` directly.
   *
   * Does NOT trigger a browser download — that is handled by
   * `downloadExportedConversation`, a separate utility exported from this
   * module. This separation allows ServerStorageProvider to use the same
   * interface without browser DOM access.
   */
  async exportConversation(
    id: string,
    format: ExportFormat,
    options?: ExportOptions
  ): Promise<ExportedConversation | null> {
    const conv = await this.loadConversation(id);
    if (!conv) return null;
    return buildExportedConversation(conv, format, options);
  }
}

// ─── Download trigger — browser-only utility ──────────────────────────────────

/**
 * Triggers a browser download from an `ExportedConversation` returned by
 * `StorageProvider.exportConversation`. This is intentionally separate from
 * the interface method so that non-browser consumers (tests, server) can call
 * `exportConversation` without touching the DOM.
 *
 * Aria calls this after receiving the serialized result from Vault.
 */
export function downloadExportedConversation(exported: ExportedConversation): void {
  triggerDownload(exported.filename, exported.content, exported.mimeType);
}
