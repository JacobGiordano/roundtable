/**
 * storageUsage.ts — Storage usage estimation utilities.
 *
 * Provides `getStorageUsage()` for reading current localStorage consumption and
 * quota estimates. Also provides `estimateSerializedSize()` for pre-flight size
 * checks before write operations, and `evictOldGeneratedImages()` for trimming
 * base64 blobs from large conversation payloads before persisting.
 *
 * None of these functions touch /src/ui or /src/types/index.ts.
 * They are consumed internally by LocalStorageProvider and re-exported from
 * /src/storage/index.ts for the companion storage-usage UI (issue #495).
 *
 * Interface gap: `getStorageUsage()` is not yet on the `StorageProvider` contract
 * in /src/types/index.ts. Adding it there requires a cross-agent types PR (Arch).
 * Until that PR lands, this function is a standalone export from /src/storage.
 * ServerStorageProvider has no localStorage and would return a trivial
 * { used: 0, quota: Infinity, percentUsed: 0 } — that implementation is deferred
 * to the types PR and Phase 4 work.
 *
 * Interface gap: `GeneratedImage` in /src/types/index.ts has no `url` field.
 * The issue spec mentions keeping "the original prompt result URL"; that field
 * does not exist on the current type. Eviction therefore preserves all fields
 * except `base64` (which is replaced with an empty string as an eviction marker).
 * When Arch adds a `url` field to `GeneratedImage`, the eviction logic here
 * should be updated to document that the `url` is retained alongside the
 * empty-string `base64` marker.
 */

import type { Conversation, GeneratedImage } from '@/types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Conservative localStorage quota floor used for pre-flight checks (bytes).
 * Real quotas range from 5 MB to 10 MB across browsers; we use 5 MB as the
 * minimum to never overestimate available space.
 */
export const STORAGE_QUOTA_FLOOR_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Fraction of the quota at which we warn and begin eviction (0–1).
 * At 80% of the conservative 5 MB floor (4 MB), we trim old generated-image
 * base64 blobs before writing.
 */
export const STORAGE_WARN_THRESHOLD = 0.8;

/**
 * Number of most-recent GeneratedImage entries per conversation to retain
 * with their full base64 payload. Older entries have their base64 evicted.
 */
export const GENERATED_IMAGE_KEEP_COUNT = 3;

// ─── StorageUsage result ──────────────────────────────────────────────────────

/**
 * Storage consumption snapshot returned by `getStorageUsage()`.
 *
 * `used` — bytes currently consumed across all localStorage keys.
 * `quota` — estimated quota in bytes. When `navigator.storage.estimate()` is
 *   available, this is the browser-reported estimate. When it is not, this is
 *   `STORAGE_QUOTA_FLOOR_BYTES` (5 MB conservative floor).
 * `percentUsed` — `used / quota * 100`, rounded to two decimal places.
 */
export interface StorageUsage {
  used: number;
  quota: number;
  percentUsed: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Synchronously estimate how many bytes are currently consumed in localStorage
 * by summing the UTF-16 encoded length of every key and value.
 *
 * localStorage is a UTF-16 store in most browsers — each character occupies
 * 2 bytes. For typical ASCII JSON payloads the UTF-16 and UTF-8 sizes are
 * identical, but we use the character count * 2 convention to match what the
 * browser actually allocates.
 *
 * This is an estimate, not a precise measurement. It does not account for
 * per-key metadata overhead that some browsers add.
 */
export function estimateLocalStorageBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key === null) continue;
      const value = localStorage.getItem(key) ?? '';
      // Key + value, UTF-16 (2 bytes per char)
      total += (key.length + value.length) * 2;
    }
  } catch {
    // localStorage access can throw in certain browser security modes.
    // Return whatever we accumulated so far.
  }
  return total;
}

/**
 * Estimate the serialized byte size of a string, using the UTF-16 convention
 * (2 bytes per character) consistent with `estimateLocalStorageBytes`.
 */
export function estimateStringBytes(s: string): number {
  return s.length * 2;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Return current localStorage consumption and quota estimates.
 *
 * Attempts to use `navigator.storage.estimate()` for an accurate browser-
 * reported quota. On browsers that do not support the Storage API (older
 * Safari, some WebViews) falls back to `STORAGE_QUOTA_FLOOR_BYTES` (5 MB).
 *
 * This function is async because `navigator.storage.estimate()` is async.
 * The localStorage byte scan is performed synchronously in both paths.
 *
 * Intended consumers:
 *   - LocalStorageProvider.saveConversation() for pre-flight threshold checks.
 *   - Issue #495 companion UI via re-export from /src/storage/index.ts.
 *
 * Interface note: this function is NOT on the StorageProvider contract.
 * ServerStorageProvider does not use localStorage and cannot implement it
 * meaningfully. Adding it to the contract requires an Arch types PR.
 */
export async function getStorageUsage(): Promise<StorageUsage> {
  const used = estimateLocalStorageBytes();

  let quota = STORAGE_QUOTA_FLOOR_BYTES;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (typeof estimate.quota === 'number' && estimate.quota > 0) {
        quota = estimate.quota;
      }
    } catch {
      // navigator.storage.estimate() can fail in sandboxed iframes or
      // when permissions are denied. Fall back to the floor.
    }
  }

  const percentUsed = Math.round((used / quota) * 10000) / 100; // 2 decimal places
  return { used, quota, percentUsed };
}

// ─── Eviction ─────────────────────────────────────────────────────────────────

/**
 * Return a copy of the conversation with base64 blobs evicted from all but the
 * most recent `GENERATED_IMAGE_KEEP_COUNT` GeneratedImage entries.
 *
 * "Most recent" is defined by message order: we walk messages in chronological
 * order (as they are stored in `conversation.messages`), collect all
 * GeneratedImage entries across all messages, and keep the last N images'
 * base64 intact. Older images have `base64` replaced with an empty string.
 *
 * The original conversation object and all its sub-objects are NOT mutated.
 * This function produces a new Conversation value safe to serialise without
 * affecting the in-memory representation that Aria is rendering.
 *
 * Eviction is in-memory only — it produces a deflated payload for the
 * localStorage write without touching the live conversation in the store.
 *
 * Note on `url` field: `GeneratedImage` in /src/types/index.ts has no `url`
 * field. When Arch adds one, the eviction logic should be updated to document
 * that the `url` is retained. All non-base64 fields are already preserved here.
 */
export function evictOldGeneratedImages(conversation: Conversation): Conversation {
  // First pass: count total generated images across all messages so we know
  // whether eviction is needed at all.
  let totalImages = 0;
  for (const msg of conversation.messages) {
    if (msg.generatedImages && msg.generatedImages.length > 0) {
      totalImages += msg.generatedImages.length;
    }
  }

  if (totalImages <= GENERATED_IMAGE_KEEP_COUNT) {
    // Nothing to evict — return the original object unchanged.
    return conversation;
  }

  // Build a flat ordered list of (messageIndex, imageIndex) for every GeneratedImage.
  // This gives us a canonical chronological ordering to identify "most recent N".
  const imageLocations: Array<{ msgIdx: number; imgIdx: number }> = [];
  for (let msgIdx = 0; msgIdx < conversation.messages.length; msgIdx++) {
    const msg = conversation.messages[msgIdx];
    if (msg.generatedImages) {
      for (let imgIdx = 0; imgIdx < msg.generatedImages.length; imgIdx++) {
        imageLocations.push({ msgIdx, imgIdx });
      }
    }
  }

  // The last GENERATED_IMAGE_KEEP_COUNT locations are retained with full base64.
  // Everything before that threshold has base64 evicted (replaced with '').
  const keepFrom = imageLocations.length - GENERATED_IMAGE_KEEP_COUNT;
  const evictSet = new Set<string>();
  for (let i = 0; i < keepFrom; i++) {
    const loc = imageLocations[i];
    evictSet.add(`${loc.msgIdx}:${loc.imgIdx}`);
  }

  // Build a new messages array with evicted base64 where needed.
  const newMessages = conversation.messages.map((msg, msgIdx) => {
    if (!msg.generatedImages || msg.generatedImages.length === 0) {
      return msg;
    }

    const newImages: GeneratedImage[] = msg.generatedImages.map((img, imgIdx) => {
      if (evictSet.has(`${msgIdx}:${imgIdx}`)) {
        // Evict base64 — replace with empty string to mark as evicted.
        // All other fields (id, mimeType, altText, width, height) are preserved.
        return { ...img, base64: '' };
      }
      return img;
    });

    // Only allocate a new message object if images actually changed.
    const changed = newImages.some((img, i) => img !== msg.generatedImages![i]);
    if (!changed) return msg;

    return { ...msg, generatedImages: newImages };
  });

  // Only allocate a new conversation if messages actually changed.
  const messagesChanged = newMessages.some((m, i) => m !== conversation.messages[i]);
  if (!messagesChanged) return conversation;

  return { ...conversation, messages: newMessages };
}

/**
 * Determine whether storage usage is at or above the warning threshold.
 *
 * `usedBytes` is the current localStorage byte count (from `estimateLocalStorageBytes()`).
 * `quotaBytes` is the effective quota (from `getStorageUsage()` or the floor constant).
 *
 * Returns true when `usedBytes / quotaBytes >= STORAGE_WARN_THRESHOLD`.
 */
export function isStorageNearCapacity(usedBytes: number, quotaBytes: number): boolean {
  return usedBytes / quotaBytes >= STORAGE_WARN_THRESHOLD;
}
