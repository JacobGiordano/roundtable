import { useState, useCallback, useRef, useMemo } from 'react';
import type { Conversation, ExportFormat, InteractionMode, Message, ModelConfig, ModelId, ProviderRoster, StopMessageFn } from '@/types';
import { AppLayout } from '@/ui/AppLayout';
import { RoundtableContext } from '@/ui/RoundtableContext';
// useStreamingMessages: UI-owned hook for in-flight streaming accumulation (#158).
// Extracted from App.tsx to reduce the god-component footprint. Pure React state
// management — persistence callbacks are supplied by App so the hook stays
// agnostic about @/storage and ghost-mode concerns.
import { useStreamingMessages } from '@/ui/useStreamingMessages';
// Cross-agent exception: sendMessage, getSessionTokenUsage, and MODEL_REGISTRY
// are pure utilities exported from @/models per the documented exception in
// CLAUDE.md. MODEL_REGISTRY is the static display-metadata registry Atlas
// maintains; we use it to resolve name/color/versions for built-in providers
// when mapping ProviderRoster → ModelConfig[].
import { sendMessage, getSessionTokenUsage, MODEL_REGISTRY } from '@/models';
// Gate cross-agent exception: useUserPreferences reads/writes UserPreferences from
// localStorage. Called at the App root so tokenCountVisibility can be threaded
// down the component tree without per-component Gate imports.
// getModelVersion / setModelVersion / clearModelVersion are Gate-owned utilities
// for persisting per-model version selections (ModelConfig.selectedVersionId).
// getProviderRoster is Gate's public API for the user's configured provider list.
// Aria reads it at app boot to seed model selector state from the real roster
// instead of the static buildDefaultModelConfigs() fallback.
// getActiveStorageProvider is Gate's StorageProvider factory — used here to
// supply useGhostMode with the active provider without App needing to know
// which concrete implementation (Local vs Server) is in use.
import { useUserPreferences, getModelVersion, setModelVersion, clearModelVersion, getProviderRoster, getActiveStorageProvider } from '@/auth';
// Vault cross-agent exception: useConversationStore is the persistence hook
// exported from @/storage. Aria consumes it at the App root to provide real
// persisted conversation state to the sidebar and message thread.
// downloadExportedConversation triggers a Blob download — also imported from
// @/storage per the documented exception. Called by handleExportConversation
// after exportConversation returns the serialized content.
// useGhostMode is the ghost-mode React hook from @/storage. Aria calls it at
// the App root (alongside useConversationStore) to read and toggle ghost status
// for the active conversation, and to save ghost-mode message updates to the
// in-memory GhostModeManager instead of localStorage.
import { useConversationStore, downloadExportedConversation, useGhostMode } from '@/storage';

// ─── Roster → ModelConfig mapping ─────────────────────────────────────────────

/**
 * Maps a ProviderRoster to ModelConfig[]. Called both at boot (initializer)
 * and on every roster change (handleRosterChange) to keep the model selector
 * in sync with provider additions and removals without a full page reload.
 *
 * prevModels is used to preserve runtime state (isActive, systemPrompt,
 * selectedVersionId) for models that already exist. New models start inactive.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function rosterToModelConfigs(
  roster: ProviderRoster,
  prevModels: ModelConfig[],
): ModelConfig[] {
  if (roster.length === 0) return [];
  const registryMap = new Map(MODEL_REGISTRY.map((e) => [e.modelId, e]));
  const prevMap = new Map(prevModels.map((m) => [m.modelId, m]));
  return roster.map((config): ModelConfig => {
    const modelId = config.kind === 'builtin' ? config.modelId : config.id;
    const existing = prevMap.get(modelId);
    if (existing) return existing;
    if (config.kind === 'builtin') {
      const entry = registryMap.get(config.modelId);
      return {
        modelId: config.modelId,
        name: entry?.name ?? config.modelId,
        color: entry?.color ?? 'accent-other',
        isActive: false,
        systemPrompt: undefined,
        selectedVersionId: getModelVersion(config.modelId),
      };
    } else {
      // Custom provider — no registry entry; use roster display metadata.
      return {
        modelId: config.id,
        name: config.displayName,
        color: config.color ?? 'accent-other',
        isActive: false,
        systemPrompt: undefined,
        selectedVersionId: undefined,
      };
    }
  });
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Conversation store (Vault) ─────────────────────────────────────────────
  // useConversationStore is the persistence hook from @/storage. It provides
  // real persisted conversations and exposes mutation methods. Replaces the
  // former MOCK_CONVERSATIONS + useState<Conversation[]> approach.
  const store = useConversationStore();

  // ── Ghost mode (Vault) ────────────────────────────────────────────────────
  // storageProviderRef holds the active StorageProvider instance for the
  // lifetime of this component — used by useGhostMode to promote/demote
  // conversations between localStorage and the in-memory GhostModeManager.
  // Initialized once via getActiveStorageProvider() (Gate utility).
  const storageProviderRef = useRef(getActiveStorageProvider());

  const {
    toggleGhostMode,
    saveGhostConversation,
    getGhostConversation,
  } = useGhostMode(store.activeConversationId, storageProviderRef.current);

  // isGlobalGhostMode: when true, new conversations are created as ghost
  // conversations (not persisted to localStorage). Toggling via
  // handleToggleGhostMode also demotes/promotes the current active conversation.
  const [isGlobalGhostMode, setIsGlobalGhostMode] = useState(false);

  // Model state seeded from the user's ProviderRoster (Gate) rather than the
  // static buildDefaultModelConfigs(). On app boot we read the roster and map
  // each entry to a ModelConfig:
  //   - Built-in: look up name/color/versions from MODEL_REGISTRY; all start inactive.
  //   - Custom: use displayName and optional color; no versions available.
  // If the roster is empty we produce [] — AppLayout / ModelSelectorPanel will
  // render the empty-roster placeholder (no fallback to buildDefaultModelConfigs).
  // selectedVersionId is seeded from Gate's persisted store (getModelVersion).
  // Re-derived on every roster change via handleRosterChange (see below).
  const [models, setModels] = useState<ModelConfig[]>(() =>
    rosterToModelConfigs(getProviderRoster(), []),
  );

  // Directed reply: when set, the next send is targeted at this model only.
  // Cleared automatically after a message is sent, or manually via the × pill.
  const [pendingTargetModelId, setPendingTargetModelId] = useState<ModelId | null>(null);

  // Edit state (#162): when set, InputBar is in edit mode pre-filled with the
  // original message content. handleSend routes through the truncate+resend path
  // when this is non-null. Cleared on send, cancel, or conversation switch.
  const [editingMessage, setEditingMessage] = useState<{
    messageIndex: number;
    originalContent: string;
  } | null>(null);

  // UserPreferences from Gate — read at the App root so tokenCountVisibility can
  // be threaded down the tree without per-component Gate imports.
  const [userPrefs] = useUserPreferences();
  const { tokenCountVisibility } = userPrefs;


  // ── Provider roster empty state (#100) ────────────────────────────────────
  // rosterVersion is a monotonic counter. Bumping it forces a re-read of
  // getProviderRoster() whenever the ProviderSettingsPanel closes. This is the
  // simplest roster subscription model: Gate is sync-only, so we re-derive
  // isRosterEmpty on-demand instead of subscribing to storage events.
  const [rosterVersion, setRosterVersion] = useState(0);
  const isRosterEmpty = useMemo(
    () => getProviderRoster().length === 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rosterVersion],
  );
  const handleRosterChange = useCallback(() => {
    setRosterVersion((v) => v + 1);
    setModels((prev) => rosterToModelConfigs(getProviderRoster(), prev));
  }, []);

  // Derive the active conversation from either the persisted store (normal
  // conversations) or the in-memory GhostModeManager (ghost conversations).
  // Ghost conversations are not in store.conversations, so getActiveConversation()
  // returns undefined for them — fall back to getGhostConversation().
  const activeConversation =
    store.getActiveConversation() ??
    (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);
  const messages = activeConversation?.messages ?? [];

  // Derive active models from the shared models array
  const activeModels = models.filter((m) => m.isActive);

  // Resolve ModelConfig for the pending directed-reply target (for pill display).
  const directedReplyTarget = pendingTargetModelId
    ? models.find((m) => m.modelId === pendingTargetModelId)
    : undefined;

  // Compute per-model session token totals for the active conversation.
  // getSessionTokenUsage is a pure utility from @/models — documented cross-agent exception.
  const sessionUsage = activeConversation ? getSessionTokenUsage(activeConversation) : [];

  // ── Streaming cancellation (#159) ─────────────────────────────────────────
  // abortControllerRef holds the AbortController for the in-flight sendMessage
  // call. Created just before each sendMessage call; cleared when the promise
  // resolves (stream done OR aborted). Stored in a ref (not state) so changes
  // do not trigger re-renders — the stop button visibility is driven by
  // isStreaming (derived from streaming messages state), not by this ref.
  //
  // handleStopMessage is the stable StopMessageFn passed through context. It
  // aborts via the ref so it never goes stale. No-op before any send and after
  // all streams settle (ref is null). useCallback with [] gives a stable
  // reference for the entire lifetime of App — context consumers do not
  // re-render merely because a send started.
  const abortControllerRef = useRef<AbortController | null>(null);
  const handleStopMessage = useCallback<StopMessageFn>(() => {
    abortControllerRef.current?.abort();
  }, []);

  // ── Streaming state (useStreamingMessages hook, #158) ─────────────────────
  // Persistence callback supplied by App so the hook stays agnostic about
  // @/storage, ghost-mode, and conversation-store internals.
  const handleMessageComplete = useCallback(
    (sendingConversationId: string, finalMsg: Message) => {
      // Read the current conversation from whichever backend it lives in.
      // Must re-check here — another model may have finalized while this one streamed.
      const currentConv =
        store.getActiveConversation() ??
        getGhostConversation(sendingConversationId);
      if (currentConv && currentConv.id === sendingConversationId) {
        const updated: Conversation = {
          ...currentConv,
          messages: [...currentConv.messages, finalMsg],
          updatedAt: Date.now(),
        };
        if (updated.isGhost) {
          saveGhostConversation(updated);
        } else {
          void store.updateConversation(updated);
        }
      }
    },
    [store, getGhostConversation, saveGhostConversation],
  );

  const {
    activeStreamingMessages,
    isStreaming: anyStreaming,
    handleChunk,
  } = useStreamingMessages({
    activeConversationId: store.activeConversationId,
    onMessageComplete: handleMessageComplete,
  });

  const handleSend = (content: string) => {
    // Snapshot the active conversation before state updates so sendMessage
    // receives a consistent view and we have a base to build the updated conv from.
    const conversationSnapshot = store.getActiveConversation() ??
      (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);
    if (!conversationSnapshot) return;

    let updatedConversation: Conversation;

    if (editingMessage) {
      // ── Edit path (#162) ───────────────────────────────────────────────────
      // Truncate the conversation to the edit point, replace with the edited
      // user message, and re-send. All model responses after the edited message
      // are discarded — the user is restarting from that point.

      // 1. Truncate to the edit point (exclusive: drop the original + all after)
      const truncated: Conversation = {
        ...conversationSnapshot,
        messages: conversationSnapshot.messages.slice(0, editingMessage.messageIndex),
        updatedAt: Date.now(),
      };

      // 2. Build the edited user message
      const editedUserMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      // 3. Compose the updated conversation
      updatedConversation = {
        ...truncated,
        messages: [...truncated.messages, editedUserMessage],
      };

      // 4. Clear edit state before persisting so UI snaps to normal mode immediately
      setEditingMessage(null);
    } else {
      // ── Normal send path ───────────────────────────────────────────────────
      const userMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        // Stamp targetModelId onto the user message so it persists in the thread.
        targetModelId: pendingTargetModelId ?? undefined,
        timestamp: Date.now(),
      };

      // Build the updated conversation with the new user message.
      updatedConversation = {
        ...conversationSnapshot,
        messages: [...conversationSnapshot.messages, userMessage],
        updatedAt: Date.now(),
      };
    }

    // Persist the updated conversation to storage. updateConversation handles
    // auto-titling (first user message → title) and optimistic in-memory update.
    // Ghost-mode guard: ghost conversations go to GhostModeManager (in-memory),
    // normal conversations go to the LocalStorageProvider via the store.
    if (updatedConversation.isGhost) {
      saveGhostConversation(updatedConversation);
    } else {
      void store.updateConversation(updatedConversation);
    }

    // Clear the pending target after send — returns to broadcast mode.
    setPendingTargetModelId(null);

    // Capture conversationId in a local binding so the chunk handler closure
    // always refers to the conversation that initiated this send, not whatever
    // is active at chunk-receipt time (the user may switch conversations mid-stream).
    const sendingConversationId = conversationSnapshot.id;

    // Pass the conversation so sendMessage can resolve per-model systemPrompts
    // from each ModelConfig.systemPrompt on the conversation's models array.
    // handleChunk(sendingConversationId) returns a stable per-send callback that
    // accumulates chunks and calls onMessageComplete when isDone — see #158.
    //
    // AbortController lifecycle (#159): create a fresh controller per send.
    // The signal is threaded into SendMessageOptions so Atlas can abort all
    // in-flight provider streams when the user clicks stop. The controller is
    // cleared in the finally block so abortControllerRef never holds a stale
    // controller after the fan-out resolves (whether normally or via abort).
    const controller = new AbortController();
    abortControllerRef.current = controller;
    void sendMessage(
      {
        conversationId: sendingConversationId,
        content,
        // Thread targetModelId into SendMessageOptions so Atlas routes to only that model.
        targetModelId: pendingTargetModelId ?? undefined,
        conversation: updatedConversation,
        signal: controller.signal,
      },
      handleChunk(sendingConversationId),
    ).finally(() => {
      // Clear the ref when the stream settles (done or aborted) so
      // handleStopMessage becomes a safe no-op again.
      abortControllerRef.current = null;
    });
  };

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      messages: [],
      models: models,
      interactionMode: 'parallel',
      isGhost: isGlobalGhostMode,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Ghost-mode path: register with GhostModeManager (in-memory only) and
    // set as active — no localStorage write occurs.
    // Normal path: persist via the conversation store.
    if (isGlobalGhostMode) {
      saveGhostConversation(newConv);
      store.setActiveConversation(newConv.id);
    } else {
      void store.createConversation(newConv).then(() => {
        store.setActiveConversation(newConv.id);
      });
    }
    // Clear directed-reply target and edit state when switching conversations.
    setPendingTargetModelId(null);
    setEditingMessage(null);
  };

  const handleSelectConversation = (id: string) => {
    store.setActiveConversation(id);
    // Clear directed-reply target and edit state when switching conversations.
    setPendingTargetModelId(null);
    setEditingMessage(null);
  };

  /**
   * Called by MessageBubble (via MessageThread) when the user clicks the edit button.
   * Sets edit mode: InputBar pre-fills with the original content of that message.
   * The conversation is truncated and re-sent when the user submits the edit.
   */
  const handleEditMessage = useCallback((messageIndex: number) => {
    const conv = store.getActiveConversation() ??
      (store.activeConversationId ? getGhostConversation(store.activeConversationId) : undefined);
    const msg = conv?.messages[messageIndex];
    if (!msg || msg.role !== 'user') return;
    setEditingMessage({ messageIndex, originalContent: msg.content });
  }, [store, getGhostConversation]);

  /** Called by InputBar Cancel button or Escape key — abandons the current edit. */
  const handleCancelEdit = useCallback(() => {
    setEditingMessage(null);
  }, []);

  const handleToggleModel = (modelId: ModelId) => {
    setModels((prev) => {
      const activeCount = prev.filter((m) => m.isActive).length;
      return prev.map((m) => {
        if (m.modelId !== modelId) return m;
        // Guard: cannot deactivate the last active model
        if (m.isActive && activeCount === 1) return m;
        return { ...m, isActive: !m.isActive };
      });
    });
  };

  const handleAddModel = (modelId: ModelId) => {
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, isActive: true } : m)),
    );
  };

  /** Persists the chosen interaction mode on the active conversation. */
  const handleModeChange = (mode: InteractionMode) => {
    const conv = store.getActiveConversation();
    // Ghost-mode guard: skip storage writes for ghost conversations.
    if (!conv || conv.isGhost) return;
    void store.updateConversation({ ...conv, interactionMode: mode, updatedAt: Date.now() });
  };

  const handleUpdateSystemPrompt = (modelId: ModelId, value: string) => {
    const updatedSystemPrompt = value || undefined;

    // Keep top-level models mirror in sync.
    setModels((prev) =>
      prev.map((m) =>
        m.modelId === modelId ? { ...m, systemPrompt: updatedSystemPrompt } : m,
      ),
    );

    // Also sync into the active conversation's models so the prompt survives
    // persistence and is available to sendMessage when it reads conversation.models.
    // Ghost-mode guard: skip storage writes for ghost conversations.
    const conv = store.getActiveConversation();
    if (conv && !conv.isGhost) {
      void store.updateConversation({
        ...conv,
        models: conv.models.map((m) =>
          m.modelId === modelId ? { ...m, systemPrompt: updatedSystemPrompt } : m,
        ),
        updatedAt: Date.now(),
      });
    }
  };

  /**
   * Persists the user's version choice for a model (Gate) and mirrors it into
   * local ModelConfig state so the picker reflects the selection immediately.
   */
  const handleSelectModelVersion = useCallback((modelId: ModelId, versionId: string) => {
    setModelVersion(modelId, versionId);
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, selectedVersionId: versionId } : m)),
    );
  }, []);

  /**
   * Clears the stored version for a model (Gate), reverting to provider default.
   * Mirrors the reset into local state by setting selectedVersionId to undefined.
   */
  const handleClearModelVersion = useCallback((modelId: ModelId) => {
    clearModelVersion(modelId);
    setModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, selectedVersionId: undefined } : m)),
    );
  }, []);

  const handleDirectedReply = useCallback((modelId: ModelId) => {
    setPendingTargetModelId(modelId);
  }, []);

  const handleClearDirectedReply = useCallback(() => {
    setPendingTargetModelId(null);
  }, []);

  // ── Ghost mode toggle ─────────────────────────────────────────────────────
  // Toggles the active conversation's ghost status via useGhostMode, and
  // flips isGlobalGhostMode so subsequent new conversations follow suit.
  const handleToggleGhostMode = useCallback(async () => {
    if (!activeConversation) {
      // No active conversation — just flip the global flag so the next new
      // conversation is created in the correct mode.
      setIsGlobalGhostMode((prev) => !prev);
      return;
    }
    const updated = await toggleGhostMode(activeConversation);
    // After toggle, the conversation has moved (ghost ↔ normal). If it was
    // promoted to normal, it is now in localStorage and we need to register
    // it with the store. If demoted to ghost, useGhostMode already handled
    // removal from localStorage and registration with GhostModeManager.
    if (!updated.isGhost) {
      // Promoted: register in the conversation store so it appears in the sidebar.
      void store.updateConversation(updated);
    }
    setIsGlobalGhostMode((prev) => !prev);
  }, [activeConversation, toggleGhostMode, store]);

  // ── Conversation management mutations ──────────────────────────────────────
  // These are thin pass-throughs — App only threads UI props, no business logic.

  const handleArchiveConversation = useCallback(
    (id: string) => { void store.archiveConversation(id); },
    [store],
  );

  const handleUnarchiveConversation = useCallback(
    (id: string) => { void store.unarchiveConversation(id); },
    [store],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => { void store.deleteConversation(id); },
    [store],
  );

  const handleSetConversationGroup = useCallback(
    (id: string, groupId: string | undefined) => { void store.setConversationGroup(id, groupId); },
    [store],
  );

  const handleBulkArchive = useCallback(
    (ids: string[]) => { for (const id of ids) void store.archiveConversation(id); },
    [store],
  );

  const handleBulkDelete = useCallback(
    (ids: string[]) => { for (const id of ids) void store.deleteConversation(id); },
    [store],
  );

  /**
   * Rename a conversation by setting (or clearing) its `title` field.
   * An empty newTitle clears the title so auto-title can re-derive it from
   * the first user message on next updateConversation. A non-empty newTitle
   * is persisted directly, bypassing auto-title (which only fires when title
   * is undefined — so explicitly setting "" is treated as "let auto-title fire").
   */
  const handleRenameConversation = useCallback(
    (id: string, newTitle: string) => {
      const conv = store.getConversation(id);
      if (!conv || conv.isGhost) return;
      const trimmed = newTitle.trim();
      // Pass undefined for title to let auto-title re-derive; pass the string to set explicitly.
      void store.updateConversation({
        ...conv,
        title: trimmed === '' ? undefined : trimmed,
        updatedAt: Date.now(),
      });
    },
    [store],
  );

  /**
   * Export handler: delegates to store.exportConversation then triggers a
   * browser download via downloadExportedConversation from @/storage.
   * Only fires when there is an active conversation — ExportButton is disabled
   * when no conversation is active or it has no messages.
   */
  const handleExportConversation = useCallback(
    async (format: ExportFormat) => {
      if (!store.activeConversationId) return;
      const result = await store.exportConversation(store.activeConversationId, format);
      if (result) downloadExportedConversation(result);
    },
    [store],
  );

  return (
    <RoundtableContext.Provider
      value={{
        conversations: store.conversations,
        activeConversationId: store.activeConversationId,
        isConversationsLoading: store.isLoading,
        conversationStoreError: store.storageError,
        onSelectConversation: handleSelectConversation,
        onNewConversation: handleNewConversation,
        onArchiveConversation: handleArchiveConversation,
        onUnarchiveConversation: handleUnarchiveConversation,
        onDeleteConversation: handleDeleteConversation,
        onSetConversationGroup: handleSetConversationGroup,
        onRenameConversation: handleRenameConversation,
        onBulkArchive: handleBulkArchive,
        onBulkDelete: handleBulkDelete,
        isGhostMode: isGlobalGhostMode,
        onToggleGhostMode: handleToggleGhostMode,
        messages,
        streamingMessages: activeStreamingMessages,
        activeModels,
        allModels: models,
        onRetry: () => { /* stub — retry not yet wired */ },
        onDirectedReply: handleDirectedReply,
        tokenCountVisibility,
        onExportConversation: store.activeConversationId ? handleExportConversation : undefined,
        onEditMessage: handleEditMessage,
        editingMessage: editingMessage ?? undefined,
        onCancelEdit: handleCancelEdit,
        isStreaming: anyStreaming,
        directedReplyTarget,
        onClearDirectedReply: handleClearDirectedReply,
        stopMessage: handleStopMessage,
        onToggleModel: handleToggleModel,
        onAddModel: handleAddModel,
        onUpdateSystemPrompt: handleUpdateSystemPrompt,
        onSelectModelVersion: handleSelectModelVersion,
        onClearModelVersion: handleClearModelVersion,
        sessionUsage,
        activeMode: activeConversation?.interactionMode ?? 'parallel',
        onModeChange: handleModeChange,
        isRosterEmpty,
        onRosterChange: handleRosterChange,
      }}
    >
      <AppLayout onSend={handleSend} />
    </RoundtableContext.Provider>
  );
}
