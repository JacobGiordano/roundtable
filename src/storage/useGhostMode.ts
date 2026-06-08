/**
 * useGhostMode — React hook for ghost-mode state management.
 *
 * Aria imports this hook (and only this hook) to:
 *   1. Read whether the active conversation is in ghost mode.
 *   2. Toggle ghost mode on/off for the active conversation.
 *   3. Save ghost-mode message updates without touching localStorage.
 *
 * The hook is self-contained: it wires up the GhostModeManager singleton,
 * subscribes to its change events, and re-renders when state changes.
 *
 * Usage:
 *   const { isGhost, toggleGhostMode, saveGhostConversation } = useGhostMode(
 *     activeConversation,
 *     storageProvider,
 *   );
 */

import { useCallback, useEffect, useReducer } from 'react';
import type { Conversation } from '@/types/index';
import type { StorageProvider } from '@/types/index';
import { ghostModeManager } from './GhostModeManager';

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGhostModeReturn {
  /** True when the given conversation is currently in ghost mode. */
  isGhost: boolean;

  /**
   * Toggle ghost mode for the provided conversation.
   *
   * ON  → demotes to ghost: removed from localStorage, tracked in memory only.
   * OFF → promotes to normal: removed from memory, persisted to localStorage.
   *
   * Returns the updated conversation so the caller can update its local state.
   */
  toggleGhostMode: (conversation: Conversation) => Promise<Conversation>;

  /**
   * Persist a ghost-mode conversation to the in-memory store.
   * Call this whenever a ghost conversation's messages change — it is a no-op
   * for non-ghost conversations (checked internally).
   */
  saveGhostConversation: (conversation: Conversation) => void;

  /**
   * Explicitly delete a ghost conversation from memory.
   * Call on tab close or when the user closes a ghost conversation.
   */
  deleteGhostConversation: (id: string) => void;

  /**
   * Retrieve the live in-memory copy of a ghost conversation.
   * Returns undefined if the conversation is not ghost or not found.
   */
  getGhostConversation: (id: string) => Conversation | undefined;

  /**
   * All currently active ghost conversations (in-memory only).
   * Useful for building a conversation list that includes ghost entries.
   */
  allGhostConversations: Conversation[];
}

export function useGhostMode(
  activeConversationId: string | null,
  storageProvider: StorageProvider,
): UseGhostModeReturn {
  // Force re-render whenever the GhostModeManager emits a change.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const unsub = ghostModeManager.subscribe(rerender);
    return unsub;
  }, []);

  // ─── isGhost ───────────────────────────────────────────────────────────────

  const isGhost =
    activeConversationId !== null &&
    ghostModeManager.isGhost(activeConversationId);

  // ─── toggleGhostMode ───────────────────────────────────────────────────────

  const toggleGhostMode = useCallback(
    async (conversation: Conversation): Promise<Conversation> => {
      if (conversation.isGhost) {
        // Ghost → Normal: promote to localStorage, remove from memory.
        const promoted = ghostModeManager.promoteToNormal(conversation.id);
        if (!promoted) {
          // Already not ghost — normalise the flag and return.
          return { ...conversation, isGhost: false };
        }
        await storageProvider.saveConversation(promoted);
        return promoted;
      } else {
        // Normal → Ghost: remove from localStorage, track in memory.
        await storageProvider.deleteConversation(conversation.id);
        return ghostModeManager.demoteToGhost(conversation);
      }
    },
    [storageProvider],
  );

  // ─── saveGhostConversation ─────────────────────────────────────────────────

  const saveGhostConversation = useCallback((conversation: Conversation) => {
    if (!conversation.isGhost) return;
    ghostModeManager.saveGhostConversation(conversation);
  }, []);

  // ─── deleteGhostConversation ───────────────────────────────────────────────

  const deleteGhostConversation = useCallback((id: string) => {
    ghostModeManager.deleteGhostConversation(id);
  }, []);

  // ─── getGhostConversation ──────────────────────────────────────────────────

  const getGhostConversation = useCallback((id: string) => {
    return ghostModeManager.getGhostConversation(id);
  }, []);

  // ─── allGhostConversations ─────────────────────────────────────────────────

  const allGhostConversations = ghostModeManager.getAllGhostConversations();

  return {
    isGhost,
    toggleGhostMode,
    saveGhostConversation,
    deleteGhostConversation,
    getGhostConversation,
    allGhostConversations,
  };
}
