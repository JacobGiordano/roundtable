/**
 * conversationDefaults.ts — Persist and retrieve conversation defaults.
 *
 * Stores the last-used active model roster and interaction mode so that new
 * conversations can be initialized with the user's prior choices.
 *
 * localStorage key: "roundtable:conversation-defaults"
 *
 * Ghost-mode guard: NOT present in this file. The ghost-mode guard for this
 * feature belongs in Aria — ConversationDefaults carries no isGhost field, so
 * Vault cannot detect ghost state here. Aria must NOT call saveConversationDefaults
 * when leaving a ghost conversation.
 *
 * Swappability note: these are standalone functions rather than StorageProvider
 * methods because ConversationDefaults is a singleton preference record, not a
 * conversation entity. Adding it to StorageProvider would require every future
 * ServerStorageProvider implementation to handle a concern that belongs to
 * client-side preferences. If Phase 4 requires server-side defaults sync, that
 * warrants its own interface extension at that time.
 */

import type { ConversationDefaults, InteractionMode } from '@/types/index';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULTS_KEY = 'roundtable:conversation-defaults';

// ─── Validation ───────────────────────────────────────────────────────────────

const VALID_INTERACTION_MODES: ReadonlySet<string> = new Set<InteractionMode>([
  'parallel',
  'manual',
  'auto-chain',
]);

/**
 * Type-guard that validates a parsed unknown value has the expected
 * ConversationDefaults shape before it is returned to callers.
 *
 * Accepts any array contents for activeModelIds — ModelId is an open union
 * (string & {}) so runtime element validation cannot be stricter than "string".
 * Corrupt or missing elements in the array are accepted as-is; Aria is
 * responsible for filtering inactive model IDs against the live provider roster.
 */
function isConversationDefaults(value: unknown): value is ConversationDefaults {
  if (typeof value !== 'object' || value === null) return false;

  const obj = value as Record<string, unknown>;

  if (!Array.isArray(obj.activeModelIds)) return false;
  if (!obj.activeModelIds.every((item) => typeof item === 'string')) return false;

  if (typeof obj.interactionMode !== 'string') return false;
  if (!VALID_INTERACTION_MODES.has(obj.interactionMode)) return false;

  return true;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the stored conversation defaults.
 *
 * Returns null when:
 *   - No value has been stored yet (first run, storage cleared).
 *   - The stored value is not valid JSON (corrupt storage).
 *   - The parsed value does not match the ConversationDefaults shape.
 *
 * Does not throw. Callers must treat null as "no defaults available" and apply
 * their own hardcoded fallbacks.
 */
export async function getConversationDefaults(): Promise<ConversationDefaults | null> {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isConversationDefaults(parsed)) return null;

    return parsed;
  } catch {
    // JSON.parse failure — stored data is corrupt; treat as missing.
    return null;
  }
}

/**
 * Persist conversation defaults for use when initializing the next new conversation.
 *
 * Throws if the storage backend is full (DOMException with name
 * "QuotaExceededError" or "NS_ERROR_DOM_QUOTA_REACHED" in Firefox). Callers
 * should handle this gracefully — failure to save defaults is non-fatal.
 *
 * Ghost-mode guard: Aria must NOT call this when leaving a ghost conversation.
 * See file header for rationale.
 */
export async function saveConversationDefaults(defaults: ConversationDefaults): Promise<void> {
  // Let QuotaExceededError bubble — Aria handles it gracefully. Do not swallow it.
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
}
