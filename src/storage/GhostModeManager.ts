/**
 * GhostModeManager — Vault's in-memory ghost conversation store.
 *
 * Ghost-mode conversations:
 *   - Live entirely in memory; `LocalStorageProvider.saveConversation` already
 *     hard-guards against writing them (`isGhost === true → silent no-op`).
 *   - Are automatically wiped when the page unloads (`beforeunload`).
 *   - Can be toggled on/off per conversation. Toggling OFF promotes the
 *     in-memory copy back to the normal storage path; toggling ON demotes an
 *     existing persisted conversation (the caller is responsible for deleting it
 *     from `LocalStorageProvider` via `deleteConversation`).
 *
 * This class is intentionally framework-agnostic (no React imports). The React
 * integration lives in `useGhostMode.ts`.
 */

import type { Conversation } from '@/types/index';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GhostModeListener = () => void;

// ─── GhostModeManager ─────────────────────────────────────────────────────────

export class GhostModeManager {
  /** In-memory store: conversationId → Conversation */
  private readonly _store = new Map<string, Conversation>();

  /** Subscribers notified on any state change. */
  private readonly _listeners = new Set<GhostModeListener>();

  constructor() {
    // Wipe all in-memory ghost conversations when the tab/window closes.
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this._handleUnload);
    }
  }

  // ─── Subscription ──────────────────────────────────────────────────────────

  subscribe(listener: GhostModeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    for (const l of this._listeners) l();
  }

  // ─── Ghost conversation CRUD ───────────────────────────────────────────────

  /**
   * Save (or update) a ghost conversation in memory.
   * Marks the conversation as `isGhost: true` regardless of the incoming value
   * so callers cannot accidentally write a non-ghost record here.
   */
  saveGhostConversation(conversation: Conversation): void {
    const ghost: Conversation = { ...conversation, isGhost: true };
    this._store.set(ghost.id, ghost);
    this._notify();
  }

  getGhostConversation(id: string): Conversation | undefined {
    return this._store.get(id);
  }

  getAllGhostConversations(): Conversation[] {
    return [...this._store.values()];
  }

  /**
   * Remove a ghost conversation from memory.
   * Called when the user explicitly closes a ghost conversation or navigates away.
   */
  deleteGhostConversation(id: string): void {
    this._store.delete(id);
    this._notify();
  }

  // ─── Ghost-mode toggle helpers ─────────────────────────────────────────────

  /**
   * Check whether a given conversation ID is currently tracked as a ghost.
   */
  isGhost(id: string): boolean {
    return this._store.has(id);
  }

  /**
   * Promote a ghost conversation back to a normal (persistable) conversation.
   * Returns the updated conversation object with `isGhost: false` so the caller
   * can hand it to `LocalStorageProvider.saveConversation`.
   * Returns `undefined` if the ID was not in the ghost store.
   */
  promoteToNormal(id: string): Conversation | undefined {
    const conv = this._store.get(id);
    if (!conv) return undefined;

    this._store.delete(id);
    this._notify();

    return { ...conv, isGhost: false };
  }

  /**
   * Demote a normal conversation into ghost mode in memory.
   * Returns the updated conversation with `isGhost: true`.
   * The caller is responsible for removing it from `LocalStorageProvider`.
   */
  demoteToGhost(conversation: Conversation): Conversation {
    const ghost: Conversation = { ...conversation, isGhost: true };
    this._store.set(ghost.id, ghost);
    this._notify();
    return ghost;
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  /** Clear all ghost conversations from memory (called on unload). */
  private _handleUnload = (): void => {
    this._store.clear();
    // No need to notify — the page is closing.
  };

  /** Tear down event listeners (useful in tests / SSR). */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', this._handleUnload);
    }
    this._store.clear();
    this._listeners.clear();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Application-wide singleton. Import this directly for non-React usage.
 * React consumers should use `useGhostMode` instead.
 */
export const ghostModeManager = new GhostModeManager();
