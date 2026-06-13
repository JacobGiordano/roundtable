/**
 * Integration: Ghost mode + Storage
 *
 * Tests the contract between GhostModeManager (Vault) and LocalStorageProvider
 * (Vault) across the ghost conversation lifecycle. The key invariant is that a
 * ghost conversation NEVER touches localStorage — not even transiently — from
 * creation through to end.
 *
 * Cross-agent contract exercised:
 *   GhostModeManager.saveGhostConversation() ← lives in Vault
 *   LocalStorageProvider.saveConversation()  ← lives in Vault
 *   Conversation.isGhost === true            ← contract from Arch's types
 *   useConversationStore.createConversation()  ← ghost guard at hook layer
 *   useConversationStore.updateConversation()  ← ghost guard at hook layer
 *
 * These two classes live in the same agent directory but the ghost-mode contract
 * spans the conceptual boundary between "what lives in memory" and "what lives in
 * localStorage" — the highest-risk invariant in Phase 1.
 *
 * The final describe block exercises the full flow through the React hook layer
 * (useConversationStore) to ensure the ghost guard holds end-to-end, not just
 * at the LocalStorageProvider boundary.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { GhostModeManager } from '@/storage/GhostModeManager';
import { LocalStorageProvider } from '@/storage/LocalStorageProvider';
import { useConversationStore } from '@/storage/useConversationStore';
import {
  makeConversation,
  makeGhostConversation,
  makeUserMessage,
  buildLocalStorageMock,
  resetIdSeq,
} from '../fixtures/conversations';

// ─── Setup ────────────────────────────────────────────────────────────────────

let store: Map<string, string>;
let restoreLocalStorage: () => void;
let ghostManager: GhostModeManager;
let storageProvider: LocalStorageProvider;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  store = mock.store;
  restoreLocalStorage = mock.restore;
  ghostManager = new GhostModeManager();
  storageProvider = new LocalStorageProvider();
});

afterEach(() => {
  ghostManager.destroy();
  restoreLocalStorage();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/** All roundtable:* localStorage keys currently set. */
function roundtableKeys(): string[] {
  return Array.from(store.keys()).filter((k) => k.startsWith('roundtable:'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ghost mode — zero localStorage trace', () => {
  it('saving a ghost conversation writes nothing to localStorage', async () => {
    const ghost = makeGhostConversation();

    ghostManager.saveGhostConversation(ghost);
    // Also explicitly attempt to persist through the storage provider —
    // the provider's own guard should silently no-op.
    await storageProvider.saveConversation(ghost);

    expect(roundtableKeys()).toHaveLength(0);
  });

  it('ghost conversation is retrievable from GhostModeManager after save', () => {
    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);

    const retrieved = ghostManager.getGhostConversation(ghost.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(ghost.id);
    expect(retrieved!.isGhost).toBe(true);
  });

  it('ghost conversation with messages added leaves no localStorage trace', async () => {
    const ghost = makeGhostConversation();
    const msg = makeUserMessage('hello from the shadow realm');

    // Simulate messages being added during a ghost conversation.
    const withMessages = { ...ghost, messages: [msg] };
    ghostManager.saveGhostConversation(withMessages);
    await storageProvider.saveConversation(withMessages);

    expect(roundtableKeys()).toHaveLength(0);
  });

  it('ghost conversation does not appear in listConversations', async () => {
    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);
    await storageProvider.saveConversation(ghost);

    const list = await storageProvider.listConversations();
    expect(list).toHaveLength(0);
  });

  it('deleting a ghost from GhostModeManager leaves it inaccessible', () => {
    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);
    ghostManager.deleteGhostConversation(ghost.id);

    const retrieved = ghostManager.getGhostConversation(ghost.id);
    expect(retrieved).toBeUndefined();
    expect(ghostManager.isGhost(ghost.id)).toBe(false);
  });

  it('a ghost promoted to normal is persisted and removed from ghost store', async () => {
    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);

    // Promote back to a normal conversation.
    const promoted = ghostManager.promoteToNormal(ghost.id);
    expect(promoted).toBeDefined();
    expect(promoted!.isGhost).toBe(false);

    // Now persist it — it is no longer a ghost.
    await storageProvider.saveConversation(promoted!);

    // Should appear in storage.
    const list = await storageProvider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(ghost.id);
    expect(list[0].isGhost).toBe(false);

    // Should no longer be tracked as a ghost.
    expect(ghostManager.isGhost(ghost.id)).toBe(false);
    expect(ghostManager.getGhostConversation(ghost.id)).toBeUndefined();
  });

  it('a normal conversation demoted to ghost is removed from localStorage', async () => {
    const normal = makeConversation();
    await storageProvider.saveConversation(normal);

    // Confirm it is persisted.
    expect(roundtableKeys().length).toBeGreaterThan(0);

    // Demote to ghost (simulating what useGhostMode.toggleGhostMode does).
    await storageProvider.deleteConversation(normal.id);
    const ghosted = ghostManager.demoteToGhost(normal);

    // localStorage must now be clean.
    const convKey = `roundtable:conv:${normal.id}`;
    expect(store.has(convKey)).toBe(false);

    // Ghost store must have it.
    expect(ghostManager.isGhost(ghosted.id)).toBe(true);
    expect(ghostManager.getGhostConversation(ghosted.id)!.isGhost).toBe(true);
  });

  it('multiple ghost conversations are all memory-only — none reach localStorage', async () => {
    const ghosts = [
      makeGhostConversation(),
      makeGhostConversation(),
      makeGhostConversation(),
    ];

    for (const g of ghosts) {
      ghostManager.saveGhostConversation(g);
      await storageProvider.saveConversation(g);
    }

    expect(roundtableKeys()).toHaveLength(0);
    expect(ghostManager.getAllGhostConversations()).toHaveLength(3);
  });

  it('isGhost() returns false for a conversation that was never registered', () => {
    expect(ghostManager.isGhost('never-seen-id')).toBe(false);
  });

  it('GhostModeManager forces isGhost:true regardless of the incoming flag', () => {
    // Even if the caller passes a conversation with isGhost:false, the manager
    // must mark it ghost. This guards against accidental flag corruption.
    const conv = makeConversation({ isGhost: false });
    ghostManager.saveGhostConversation(conv);

    const retrieved = ghostManager.getGhostConversation(conv.id);
    expect(retrieved!.isGhost).toBe(true);
  });
});

describe('ghost mode — GhostModeManager subscription notifications', () => {
  it('notifies listeners when a ghost conversation is saved', () => {
    let notified = false;
    ghostManager.subscribe(() => { notified = true; });

    ghostManager.saveGhostConversation(makeGhostConversation());
    expect(notified).toBe(true);
  });

  it('notifies listeners when a ghost conversation is deleted', () => {
    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);

    let notified = false;
    ghostManager.subscribe(() => { notified = true; });

    ghostManager.deleteGhostConversation(ghost.id);
    expect(notified).toBe(true);
  });

  it('notified listener can read updated ghost list immediately', () => {
    let capturedList: ReturnType<typeof ghostManager.getAllGhostConversations> = [];

    ghostManager.subscribe(() => {
      capturedList = ghostManager.getAllGhostConversations();
    });

    const ghost = makeGhostConversation();
    ghostManager.saveGhostConversation(ghost);

    expect(capturedList).toHaveLength(1);
    expect(capturedList[0].id).toBe(ghost.id);
  });

  it('unsubscribe prevents further notifications', () => {
    let callCount = 0;
    const unsub = ghostManager.subscribe(() => { callCount++; });

    ghostManager.saveGhostConversation(makeGhostConversation());
    expect(callCount).toBe(1);

    unsub();
    ghostManager.saveGhostConversation(makeGhostConversation());
    expect(callCount).toBe(1); // still 1 — listener removed
  });
});

// ─── Hook-layer ghost guard ───────────────────────────────────────────────────
//
// The following tests exercise the ghost isolation contract through the full
// useConversationStore hook path — createConversation() and updateConversation()
// — rather than calling LocalStorageProvider directly.
//
// This is a distinct integration surface: the hook adds its own ghost-mode guard
// before delegating to the provider. A bug at the hook layer (e.g. accidentally
// removing the `if (!conversation.isGhost)` check in createConversation) would
// not be caught by the provider-level tests above.
//
// Real LocalStorageProvider + real in-memory localStorage mock — no mocks at
// the agent boundary.

describe('ghost mode — useConversationStore hook-layer isolation', () => {
  let hookStore: Map<string, string>;
  let hookRestoreLocalStorage: () => void;
  let provider: LocalStorageProvider;

  beforeEach(() => {
    resetIdSeq();
    const mock = buildLocalStorageMock();
    hookStore = mock.store;
    hookRestoreLocalStorage = mock.restore;
    provider = new LocalStorageProvider();
  });

  afterEach(() => {
    hookRestoreLocalStorage();
  });

  /** All roundtable:* localStorage keys currently set. */
  function hookRoundtableKeys(): string[] {
    return Array.from(hookStore.keys()).filter((k) => k.startsWith('roundtable:'));
  }

  it('createConversation with isGhost:true writes nothing to localStorage', async () => {
    const { result } = renderHook(() => useConversationStore(provider));

    const ghost = makeGhostConversation();
    await act(async () => {
      await result.current.createConversation(ghost);
    });

    expect(hookRoundtableKeys()).toHaveLength(0);
  });

  it('createConversation with isGhost:true does not add the conversation to the store list', async () => {
    const { result } = renderHook(() => useConversationStore(provider));

    const ghost = makeGhostConversation();
    await act(async () => {
      await result.current.createConversation(ghost);
    });

    expect(result.current.conversations).toHaveLength(0);
  });

  it('updateConversation with isGhost:true writes nothing to localStorage', async () => {
    const { result } = renderHook(() => useConversationStore(provider));

    const ghost = makeGhostConversation();
    ghost.messages.push(makeUserMessage('hello from the shadow realm'));

    await act(async () => {
      await result.current.updateConversation(ghost);
    });

    expect(hookRoundtableKeys()).toHaveLength(0);
  });

  it('full ghost conversation lifecycle: create → add messages → update → zero localStorage keys', async () => {
    // This is the end-to-end flow the issue specifically calls for:
    // start ghost conversation → add messages → end session (updateConversation)
    // → verify no roundtable:* keys written at any point.
    const { result } = renderHook(() => useConversationStore(provider));

    const ghost = makeGhostConversation();

    await act(async () => {
      // Step 1: create ghost conversation
      await result.current.createConversation(ghost);
    });

    // No keys written after create.
    expect(hookRoundtableKeys()).toHaveLength(0);

    const withMessages = {
      ...ghost,
      messages: [
        makeUserMessage('message one'),
        makeUserMessage('message two'),
      ],
    };

    await act(async () => {
      // Step 2: update with messages (simulates each message being added)
      await result.current.updateConversation(withMessages);
    });

    // Still no keys written after update with messages.
    expect(hookRoundtableKeys()).toHaveLength(0);

    // Step 3: end session — ghost conversation simply goes away.
    // Verify the ghost never touched the index or any conv key.
    const convKey = `roundtable:conv:${ghost.id}`;
    expect(hookStore.has(convKey)).toBe(false);
    expect(hookStore.has('roundtable:index')).toBe(false);
  });

  it('a normal conversation created alongside a ghost only persists the normal one', async () => {
    const { result } = renderHook(() => useConversationStore(provider));

    const normal = makeConversation();
    const ghost = makeGhostConversation();

    await act(async () => {
      await result.current.createConversation(normal);
      await result.current.createConversation(ghost);
    });

    // Only the normal conversation is in React state.
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].id).toBe(normal.id);
    expect(result.current.conversations[0].isGhost).toBe(false);

    // Only the normal conversation is in localStorage.
    const ghostKey = `roundtable:conv:${ghost.id}`;
    expect(hookStore.has(ghostKey)).toBe(false);

    const normalKey = `roundtable:conv:${normal.id}`;
    expect(hookStore.has(normalKey)).toBe(true);
  });
});
