/**
 * useConversationStore — React hook that wires LocalStorageProvider to the UI
 * layer through the ConversationStore interface, plus mutation methods.
 *
 * Design invariants:
 *   - Ghost mode guard is the first check on every write path. If
 *     `conversation.isGhost === true`, no storage call is made — not even
 *     to update in-memory React state for the persisted list.
 *   - The LocalStorageProvider instance is created once and held in a ref;
 *     it is stable for the lifetime of the component that mounts this hook.
 *   - Mutations use optimistic in-memory updates: React state is updated
 *     immediately, then persisted asynchronously. This keeps the UI responsive
 *     without requiring a full `listConversations()` round-trip after each op.
 *   - Auto-title generation fires inside `updateConversation` when the
 *     conversation has no title yet and its messages now contain at least one
 *     user message. Title = first ~60 chars of the first user message (after
 *     stripping Markdown), trimmed at a word boundary. Falls back to "[Image]"
 *     for image-only messages (empty content, non-empty attachments).
 *   - `getSessionTokenUsage` delegates to Atlas's utility function — this is
 *     the documented cross-agent exception (see CLAUDE.md and HANDOFF.md).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Conversation,
  ConversationStore,
  ExportedConversation,
  ExportFormat,
  SessionTokenUsage,
  StorageProvider,
} from '@/types/index';
import { LocalStorageProvider } from './LocalStorageProvider';
import { buildExportedConversation } from './exporters';
import type { ExportOptions } from '@/types/index';
// Documented exception: pure utility from @/models may be imported by Vault for
// ConversationStore.getSessionTokenUsage delegation. See CLAUDE.md §exceptions.
import { getSessionTokenUsage as computeSessionTokenUsage } from '@/models';

// ─── Title generation ─────────────────────────────────────────────────────────

/**
 * Strip common Markdown syntax from a string, returning plain text suitable
 * for display as a conversation title. Only inline syntax is stripped — block
 * constructs (code fences, ordered lists) are reduced to their content rather
 * than being removed entirely, so the semantic meaning is preserved.
 *
 * Stripped: bold (**text** / __text__), italic (*text* / _text_), inline code
 * (`text`), strikethrough (~~text~~), links ([text](url) → text), images
 * (![alt](url) → alt), blockquote markers (leading >), heading markers
 * (leading #), and horizontal rules (---, ***, ___). Remaining whitespace is
 * collapsed to single spaces so the output is a clean single-line string.
 */
function stripMarkdown(text: string): string {
  return text
    // Images: ![alt](url) → alt text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Links: [text](url) → text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    // Bold: **text** or __text__ → text
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    // Italic: *text* or _text_ (single delimiters) → text
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Strikethrough: ~~text~~ → text
    .replace(/~~([^~]*)~~/g, '$1')
    // Inline code: `text` → text
    .replace(/`([^`]*)`/g, '$1')
    // Blockquote markers: leading > (possibly with spaces) → nothing
    .replace(/^>+\s*/gm, '')
    // Heading markers: leading # characters → nothing
    .replace(/^#{1,6}\s*/gm, '')
    // Horizontal rules (---, ***, ___) → nothing
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Collapse whitespace (newlines, tabs, multiple spaces) → single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Derive an auto-title from the first user message in a conversation.
 *
 * Markdown syntax is stripped before truncating so the title contains plain
 * text (e.g. a message opening with "**Important**:" yields "Important:" as
 * the title, not "**Important**:").
 *
 * Falls back to "[Image]" when the message content is empty but attachments
 * are present (image-only messages), so the sidebar never shows "Untitled
 * conversation" for a conversation the user clearly initiated.
 *
 * Returns undefined if there are no user messages, so the caller can skip
 * the title assignment.
 */
function deriveTitle(conversation: Conversation): string | undefined {
  const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return undefined;

  const plain = stripMarkdown(firstUserMsg.content);

  // Fallback for image-only messages: content is empty but attachments exist.
  if (!plain) {
    if (firstUserMsg.attachments && firstUserMsg.attachments.length > 0) {
      return '[Image]';
    }
    return undefined;
  }

  const MAX = 60;
  if (plain.length <= MAX) return plain;

  // Trim to MAX chars then walk back to a word boundary.
  let truncated = plain.slice(0, MAX);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > 0) {
    truncated = truncated.slice(0, lastSpace);
  }
  return truncated;
}

// ─── Return type ──────────────────────────────────────────────────────────────

/**
 * Everything the hook exposes. Aria imports this type from @/storage.
 *
 * Read-only ConversationStore fields + mutation methods. Aria should never
 * call LocalStorageProvider directly — all storage operations go through this
 * surface.
 */
export interface UseConversationStoreReturn extends ConversationStore {
  /**
   * Create and immediately persist a new conversation (unless it is a ghost).
   * Returns the created conversation so the caller can set it as active.
   */
  createConversation(conversation: Conversation): Promise<Conversation>;

  /**
   * Persist an updated conversation.
   *
   * Ghost-mode guard: if `conversation.isGhost` is true, skips all storage
   * calls. The caller is responsible for managing ghost conversations via
   * `useGhostMode`.
   *
   * Auto-title: if the conversation has no `title` yet and has at least one
   * user message, a title is auto-generated from that message before saving.
   */
  updateConversation(conversation: Conversation): Promise<void>;

  /**
   * Set the active conversation by ID. Pass null to deselect.
   * This is pure React state — no storage operation.
   */
  setActiveConversation(id: string | null): void;

  /**
   * Permanently remove a conversation and clean up all related state.
   * If the deleted conversation was active, clears activeConversationId.
   */
  deleteConversation(id: string): Promise<void>;

  /**
   * Archive a conversation (sets archivedAt timestamp).
   * Archived conversations remain in the list — the UI filters them.
   */
  archiveConversation(id: string): Promise<void>;

  /**
   * Reverse an archive operation (clears archivedAt).
   */
  unarchiveConversation(id: string): Promise<void>;

  /**
   * Assign a conversation to a group/folder.
   *
   * Per StorageProvider design: there is no dedicated `setGroup` method.
   * This helper loads the conversation, mutates `groupId`, and calls
   * `saveConversation` with the full updated object.
   *
   * Pass undefined as groupId to remove the conversation from any group.
   */
  setConversationGroup(id: string, groupId: string | undefined): Promise<void>;

  /**
   * Serialize a conversation to the requested format and return the result.
   *
   * Returns null if the conversation does not exist. Does NOT trigger a browser
   * download — the caller (Aria) is responsible for passing the result to
   * `downloadExportedConversation` from `@/storage` if a download is desired.
   *
   * `options.includeAttachments` (default `false`): when true, attachment
   * metadata (filename and mimeType) is included in the export. Raw base64
   * content is never embedded. See `ExportOptions` for full documentation.
   *
   * Implementation note: this method calls `provider.loadConversation(id)` and
   * then invokes the exporter functions directly via `buildExportedConversation`.
   * This bypasses `StorageProvider.exportConversation` (which lacks `options` in
   * its interface contract) so no cast against the narrower interface is needed.
   * See Phase 4 note in exporters.ts for the future Arch types PR that would
   * formalize `options` on the interface.
   *
   * No state mutation occurs — this is a pure read through to the provider.
   */
  exportConversation(id: string, format: ExportFormat, options?: ExportOptions): Promise<ExportedConversation | null>;

  /**
   * True while the initial `listConversations()` load is in flight.
   * Aria can use this to show a skeleton/loading state.
   */
  isLoading: boolean;

  /**
   * Set when any storage operation throws (e.g. quota exceeded).
   * Aria should surface this to the user. Cleared on the next successful op.
   */
  storageError: Error | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConversationStore(injectedProvider?: StorageProvider): UseConversationStoreReturn {
  // Single provider instance for the lifetime of this hook mount.
  // If a provider is injected (e.g. ServerStorageProvider by Gate in Phase 4),
  // use it; otherwise fall back to LocalStorageProvider.
  const providerRef = useRef<StorageProvider | null>(null);
  if (providerRef.current === null) {
    providerRef.current = injectedProvider ?? new LocalStorageProvider();
  }
  // Non-null assertion is safe: the block above guarantees initialization.
  const provider = providerRef.current as StorageProvider;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [storageError, setStorageError] = useState<Error | null>(null);

  // ─── Initial load ──────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    provider
      .listConversations()
      .then((loaded) => {
        if (!cancelled) {
          setConversations(loaded);

          // Auto-select the most recent non-archived conversation on initial
          // load — but only if no conversation is already active (i.e.
          // activeConversationId is still null). This unblocks the mode
          // switcher and any other UI that depends on getActiveConversation()
          // returning a value on boot.
          //
          // listConversations() is sorted newest-first by updatedAt, so
          // loaded[0] is already the best candidate.
          setActiveConversationId((currentId) => {
            if (currentId !== null) return currentId; // already set — don't override
            if (loaded.length === 0) return null;     // nothing to select
            const first = loaded.find((c) => !c.archivedAt);
            return first ? first.id : null;
          });

          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStorageError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [provider]);

  // ─── ConversationStore read interface ─────────────────────────────────────

  const getConversation = useCallback(
    (id: string): Conversation | undefined =>
      conversations.find((c) => c.id === id),
    [conversations],
  );

  const getActiveConversation = useCallback(
    (): Conversation | undefined => {
      if (activeConversationId === null) return undefined;
      return conversations.find((c) => c.id === activeConversationId);
    },
    [conversations, activeConversationId],
  );

  const getSessionTokenUsage = useCallback(
    (conversationId: string): SessionTokenUsage[] => {
      const conv = conversations.find((c) => c.id === conversationId);
      if (!conv) return [];
      return computeSessionTokenUsage(conv);
    },
    [conversations],
  );

  // ─── Mutation helpers ─────────────────────────────────────────────────────

  /**
   * Replace a single conversation in local React state without a full reload.
   * The list is re-sorted newest-first after the replacement.
   *
   * Stale-write guard: if the incoming snapshot has an `updatedAt` that is
   * strictly older than the version already in state, the update is silently
   * discarded. This prevents a late-resolving `updateConversation` call (e.g.
   * from a prior auto-chain step) from overwriting state that was already
   * advanced to a newer snapshot by a subsequent step (#374).
   *
   * Equal timestamps are allowed through — if two completions happen in the
   * same millisecond, either ordering is acceptable and neither should be lost.
   */
  const replaceInState = useCallback((updated: Conversation): void => {
    setConversations((prev) => {
      const next = prev.map((c) => {
        if (c.id !== updated.id) return c;
        // Discard stale updates: only replace when the incoming snapshot is
        // at least as new as what we already have in state.
        if (updated.updatedAt < c.updatedAt) return c;
        return updated;
      });
      // Re-sort newest-first so the list order stays consistent.
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      return next;
    });
  }, []);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createConversation = useCallback(
    async (conversation: Conversation): Promise<Conversation> => {
      // Ghost-mode guard: ghost conversations are not persisted and not tracked
      // in the persisted conversations list. The caller manages them via
      // useGhostMode.
      if (!conversation.isGhost) {
        try {
          await provider.saveConversation(conversation);
          setStorageError(null);
          setConversations((prev) => {
            const next = [conversation, ...prev];
            next.sort((a, b) => b.updatedAt - a.updatedAt);
            return next;
          });
        } catch (err: unknown) {
          setStorageError(err instanceof Error ? err : new Error(String(err)));
          throw err;
        }
      }
      return conversation;
    },
    [provider],
  );

  const updateConversation = useCallback(
    async (conversation: Conversation): Promise<void> => {
      // Ghost-mode guard: first check, before any operation.
      if (conversation.isGhost) return;

      // Auto-title: if the conversation has no title yet and has a first user
      // message, derive a title from it now. Only set if currently undefined —
      // never overwrite a title the user or a prior auto-title set.
      let toSave = conversation;
      if (toSave.title === undefined) {
        const derived = deriveTitle(toSave);
        if (derived !== undefined) {
          toSave = { ...toSave, title: derived };
        }
      }

      try {
        await provider.saveConversation(toSave);
        setStorageError(null);
        replaceInState(toSave);
      } catch (err: unknown) {
        setStorageError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [provider, replaceInState],
  );

  const setActiveConversation = useCallback((id: string | null): void => {
    setActiveConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string): Promise<void> => {
      try {
        await provider.deleteConversation(id);
        setStorageError(null);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        setActiveConversationId((prev) => (prev === id ? null : prev));
      } catch (err: unknown) {
        setStorageError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [provider],
  );

  const archiveConversation = useCallback(
    async (id: string): Promise<void> => {
      try {
        await provider.archiveConversation(id);
        setStorageError(null);
        // Reload the single conversation to get the updated archivedAt value.
        const updated = await provider.loadConversation(id);
        if (updated) replaceInState(updated);
      } catch (err: unknown) {
        setStorageError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [provider, replaceInState],
  );

  const unarchiveConversation = useCallback(
    async (id: string): Promise<void> => {
      try {
        await provider.unarchiveConversation(id);
        setStorageError(null);
        const updated = await provider.loadConversation(id);
        if (updated) replaceInState(updated);
      } catch (err: unknown) {
        setStorageError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [provider, replaceInState],
  );

  const setConversationGroup = useCallback(
    async (id: string, groupId: string | undefined): Promise<void> => {
      // Per StorageProvider design: load, mutate groupId, save full object.
      const conv = await provider.loadConversation(id);
      if (!conv) return;

      // Ghost-mode guard: a ghost conversation should never appear in localStorage
      // by definition, but guard explicitly in case of state inconsistency.
      if (conv.isGhost) return;

      const updated: Conversation = {
        ...conv,
        groupId,
        updatedAt: Date.now(),
      };

      try {
        await provider.saveConversation(updated);
        setStorageError(null);
        replaceInState(updated);
      } catch (err: unknown) {
        setStorageError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    },
    [provider, replaceInState],
  );

  // ─── Export ───────────────────────────────────────────────────────────────

  const exportConversation = useCallback(
    async (id: string, format: ExportFormat, options?: ExportOptions): Promise<ExportedConversation | null> => {
      // Load the conversation via the StorageProvider interface (no options
      // threading required here), then call the exporter directly so options
      // flow through without needing to widen the StorageProvider interface.
      // No state mutation occurs — this is a pure read.
      const conv = await provider.loadConversation(id);
      if (!conv) return null;
      return buildExportedConversation(conv, format, options);
    },
    [provider],
  );

  // ─── Return value ──────────────────────────────────────────────────────────

  return {
    // ConversationStore read interface
    conversations,
    activeConversationId,
    getConversation,
    getActiveConversation,
    getSessionTokenUsage,

    // Mutation methods
    createConversation,
    updateConversation,
    setActiveConversation,
    deleteConversation,
    archiveConversation,
    unarchiveConversation,
    setConversationGroup,

    // Export (read-only, no state mutation)
    exportConversation,

    // Loading / error state
    isLoading,
    storageError,
  };
}
