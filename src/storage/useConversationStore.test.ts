/**
 * Unit tests for useConversationStore — auto-select on initial load.
 *
 * Covers the behavior introduced in issue #124: after listConversations()
 * resolves on boot, the most recent non-archived conversation is automatically
 * selected as active, fixing the mode-switcher no-op bug.
 *
 * Uses @testing-library/react renderHook + jsdom environment (configured in
 * vite.config.ts). The StorageProvider is injected so we don't touch
 * real localStorage.
 *
 * Ghost-mode writes are not exercised here — those are covered by
 * LocalStorageProvider.test.ts and the integration suite in
 * /src/tests/integration/.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useConversationStore } from './useConversationStore';
import type { Conversation, StorageProvider, ModelConfig } from '@/types/index';

// ─── Minimal fixture ──────────────────────────────────────────────────────────

const MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

let _seq = 0;
function makeConv(overrides: Partial<Conversation> = {}): Conversation {
  const id = `conv-${++_seq}`;
  return {
    id,
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

// ─── Provider stub factory ────────────────────────────────────────────────────

/**
 * Build a minimal StorageProvider stub whose listConversations() returns the
 * supplied list. All other methods are no-ops (not exercised by these tests).
 */
function makeProvider(convs: Conversation[]): StorageProvider {
  return {
    listConversations: vi.fn().mockResolvedValue(convs),
    saveConversation: vi.fn().mockResolvedValue(undefined),
    loadConversation: vi.fn().mockResolvedValue(null),
    deleteConversation: vi.fn().mockResolvedValue(undefined),
    archiveConversation: vi.fn().mockResolvedValue(undefined),
    unarchiveConversation: vi.fn().mockResolvedValue(undefined),
    exportConversation: vi.fn().mockResolvedValue(null),
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _seq = 0;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Auto-select on load ──────────────────────────────────────────────────────

describe('useConversationStore — auto-select on initial load (#124)', () => {
  it('selects the first non-archived conversation when activeConversationId is null', async () => {
    const conv = makeConv({ id: 'recent', updatedAt: 9000 });
    const provider = makeProvider([conv]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeConversationId).toBe('recent');
  });

  it('skips archived conversations and selects the first non-archived one', async () => {
    const archived = makeConv({ id: 'archived', updatedAt: 9000, archivedAt: 8000 });
    const active = makeConv({ id: 'active', updatedAt: 8000 });
    // listConversations returns newest-first — archived is first here
    const provider = makeProvider([archived, active]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeConversationId).toBe('active');
  });

  it('leaves activeConversationId null when all conversations are archived', async () => {
    const a = makeConv({ id: 'a', archivedAt: 5000 });
    const b = makeConv({ id: 'b', archivedAt: 6000 });
    const provider = makeProvider([b, a]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeConversationId).toBeNull();
  });

  it('leaves activeConversationId null when no conversations exist', async () => {
    const provider = makeProvider([]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.activeConversationId).toBeNull();
  });

  it('does not override a conversation already set before load completes', async () => {
    // Simulate a slow load so the user (or a future SSR hydration path) can
    // set the active ID before the promise resolves. The guard in the
    // setActiveConversationId functional update must honour the pre-set value.
    let resolveList!: (convs: Conversation[]) => void;
    const listPromise = new Promise<Conversation[]>((res) => { resolveList = res; });

    const provider = makeProvider([]);
    (provider.listConversations as ReturnType<typeof vi.fn>).mockReturnValue(listPromise);

    const conv = makeConv({ id: 'pre-selected' });

    const { result } = renderHook(() => useConversationStore(provider));

    // Manually select before the load resolves.
    act(() => {
      result.current.setActiveConversation('pre-selected');
    });

    expect(result.current.activeConversationId).toBe('pre-selected');

    // Now resolve with a different conversation.
    act(() => {
      resolveList([conv]);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The pre-set selection must be preserved, not overwritten.
    expect(result.current.activeConversationId).toBe('pre-selected');
  });

  it('getActiveConversation returns the loaded conversation after auto-select', async () => {
    const conv = makeConv({ id: 'target', updatedAt: 5000 });
    const provider = makeProvider([conv]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const active = result.current.getActiveConversation();
    expect(active).toBeDefined();
    expect(active!.id).toBe('target');
  });

  it('explicitly selecting a different conversation overrides the auto-selection', async () => {
    const a = makeConv({ id: 'auto', updatedAt: 9000 });
    const b = makeConv({ id: 'manual', updatedAt: 1000 });
    const provider = makeProvider([a, b]);

    const { result } = renderHook(() => useConversationStore(provider));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Auto-select should have picked 'auto'.
    expect(result.current.activeConversationId).toBe('auto');

    // User picks a different conversation.
    act(() => {
      result.current.setActiveConversation('manual');
    });

    expect(result.current.activeConversationId).toBe('manual');
  });
});

// ─── Stale-write guard in replaceInState (#374) ───────────────────────────────

describe('useConversationStore — stale-write guard in updateConversation (#374)', () => {
  it('does not overwrite state with a stale (older updatedAt) snapshot', async () => {
    const conv = makeConv({ id: 'target', updatedAt: 1000 });
    const provider = makeProvider([conv]);

    const { result } = renderHook(() => useConversationStore(provider));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const newerSnapshot = { ...conv, updatedAt: 3000, title: 'newer' };
    const olderSnapshot = { ...conv, updatedAt: 2000, title: 'older' };

    // Apply the newer snapshot first.
    await act(async () => {
      await result.current.updateConversation(newerSnapshot);
    });

    expect(result.current.getConversation('target')?.title).toBe('newer');
    expect(result.current.getConversation('target')?.updatedAt).toBe(3000);

    // Simulate a late-resolving call with an older snapshot.
    await act(async () => {
      await result.current.updateConversation(olderSnapshot);
    });

    // State must remain at the newer snapshot — the stale write should be discarded.
    expect(result.current.getConversation('target')?.title).toBe('newer');
    expect(result.current.getConversation('target')?.updatedAt).toBe(3000);
  });

  it('allows an update with the same updatedAt through (equal timestamps are not stale)', async () => {
    const conv = makeConv({ id: 'target', updatedAt: 5000 });
    const provider = makeProvider([conv]);

    const { result } = renderHook(() => useConversationStore(provider));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const sameTimestamp = { ...conv, updatedAt: 5000, title: 'same-ts' };

    await act(async () => {
      await result.current.updateConversation(sameTimestamp);
    });

    // Same-timestamp update should be applied — equal timestamps are not stale.
    expect(result.current.getConversation('target')?.title).toBe('same-ts');
  });

  it('applies a newer snapshot after an older one has already been set', async () => {
    const conv = makeConv({ id: 'target', updatedAt: 1000 });
    const provider = makeProvider([conv]);

    const { result } = renderHook(() => useConversationStore(provider));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const olderSnapshot = { ...conv, updatedAt: 2000, title: 'older' };
    const newerSnapshot = { ...conv, updatedAt: 4000, title: 'newer' };

    await act(async () => {
      await result.current.updateConversation(olderSnapshot);
    });

    expect(result.current.getConversation('target')?.title).toBe('older');

    await act(async () => {
      await result.current.updateConversation(newerSnapshot);
    });

    // Newer snapshot must win.
    expect(result.current.getConversation('target')?.title).toBe('newer');
    expect(result.current.getConversation('target')?.updatedAt).toBe(4000);
  });
});
