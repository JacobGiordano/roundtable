import { useState, useCallback, useRef, useMemo } from 'react';
import type { Conversation, ExportFormat, InteractionMode, Message, ModelConfig, ModelId, ProviderRoster, StreamChunk } from '@/types';
import { AppLayout } from '@/ui/AppLayout';
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

  // ── Streaming state ───────────────────────────────────────────────────────
  // streamingMessages holds in-flight assistant responses, keyed by
  // `${conversationId}:${modelId}`. This is pure React state — never written
  // to localStorage until isDone. Multiple concurrent models are safe because
  // each key is unique per model per conversation.
  const [streamingMessages, setStreamingMessages] = useState<Record<string, Message>>({});

  // accumulatorRef mirrors streamingMessages but is readable inside the chunk
  // callback closure without stale-closure issues. We read from the ref and
  // write to both ref + state on every chunk.
  const accumulatorRef = useRef<Record<string, Message>>({});

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

  // Derive streaming messages for the active conversation — only messages whose
  // key matches the active conversationId are surfaced to the thread.
  const activeStreamingMessages = activeConversation
    ? Object.entries(streamingMessages)
        .filter(([key]) => key.startsWith(`${activeConversation.id}:`))
        .map(([, msg]) => msg)
    : [];

  // isStreaming is true when any model is still sending chunks for the active conv.
  const anyStreaming = activeStreamingMessages.length > 0;

  // Compute per-model session token totals for the active conversation.
  // getSessionTokenUsage is a pure utility from @/models — documented cross-agent exception.
  const sessionUsage = activeConversation ? getSessionTokenUsage(activeConversation) : [];

  const handleSend = (content: string) => {
    // Snapshot the active conversation before state updates so sendMessage
    // receives a consistent view and we have a base to build the updated conv from.
    const conversationSnapshot = store.getActiveConversation();
    if (!conversationSnapshot) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      // Stamp targetModelId onto the user message so it persists in the thread.
      targetModelId: pendingTargetModelId ?? undefined,
      timestamp: Date.now(),
    };

    // Build the updated conversation with the new user message.
    const updatedConversation: Conversation = {
      ...conversationSnapshot,
      messages: [...conversationSnapshot.messages, userMessage],
      updatedAt: Date.now(),
    };

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
    void sendMessage(
      {
        conversationId: sendingConversationId,
        content,
        // Thread targetModelId into SendMessageOptions so Atlas routes to only that model.
        targetModelId: pendingTargetModelId ?? undefined,
        conversation: updatedConversation,
      },
      (chunk: StreamChunk) => {
        const key = `${sendingConversationId}:${chunk.modelId}`;

        if (chunk.isDone) {
          // Finalize the streaming message: flip isStreaming off, attach usage/error.
          const existing = accumulatorRef.current[key];
          if (existing) {
            const finalMsg: Message = {
              ...existing,
              isStreaming: false,
              tokenUsage: chunk.tokenUsage,
              // Arch added error?: ModelError to Message — propagate when stream fails.
              ...(chunk.error ? { error: chunk.error } : {}),
            };
            // Remove from accumulator ref so it no longer appears in streamingMessages.
            const next = { ...accumulatorRef.current };
            delete next[key];
            accumulatorRef.current = next;
            setStreamingMessages(next);

            // Persist the completed message to the conversation store.
            // We read the current conversation from either the persisted store
            // (normal) or the in-memory GhostModeManager (ghost) to get any
            // other messages that may have finalized while this one streamed.
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
          }
        } else {
          // Non-done chunk: accumulate content onto the in-progress message.
          const existing = accumulatorRef.current[key];
          const streamMsg: Message = existing
            ? { ...existing, content: existing.content + chunk.content }
            : {
                id: `stream-${sendingConversationId}-${chunk.modelId}-${Date.now()}`,
                role: 'assistant',
                modelId: chunk.modelId,
                content: chunk.content,
                timestamp: Date.now(),
                isStreaming: true,
              };

          const next = { ...accumulatorRef.current, [key]: streamMsg };
          accumulatorRef.current = next;
          setStreamingMessages(next);
        }
      },
    );
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
    // Clear directed-reply target when switching conversations.
    setPendingTargetModelId(null);
  };

  const handleSelectConversation = (id: string) => {
    store.setActiveConversation(id);
    // Clear directed-reply target when switching conversations.
    setPendingTargetModelId(null);
  };

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
    <AppLayout
      conversations={store.conversations}
      activeConversationId={store.activeConversationId}
      activeModels={activeModels}
      allModels={models}
      messages={messages}
      streamingMessages={activeStreamingMessages}
      isStreaming={anyStreaming}
      isGhostMode={isGlobalGhostMode}
      onToggleGhostMode={handleToggleGhostMode}
      onSend={handleSend}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onToggleModel={handleToggleModel}
      onAddModel={handleAddModel}
      activeMode={activeConversation?.interactionMode ?? 'parallel'}
      onModeChange={handleModeChange}
      onUpdateSystemPrompt={handleUpdateSystemPrompt}
      onSelectModelVersion={handleSelectModelVersion}
      onClearModelVersion={handleClearModelVersion}
      sessionUsage={sessionUsage}
      directedReplyTarget={directedReplyTarget}
      onDirectedReply={handleDirectedReply}
      onClearDirectedReply={handleClearDirectedReply}
      tokenCountVisibility={tokenCountVisibility}
      isConversationsLoading={store.isLoading}
      conversationStoreError={store.storageError}
      onExportConversation={
        store.activeConversationId ? handleExportConversation : undefined
      }
      onArchiveConversation={handleArchiveConversation}
      onUnarchiveConversation={handleUnarchiveConversation}
      onDeleteConversation={handleDeleteConversation}
      onSetConversationGroup={handleSetConversationGroup}
      onBulkArchive={handleBulkArchive}
      onBulkDelete={handleBulkDelete}
      isRosterEmpty={isRosterEmpty}
      onRosterChange={handleRosterChange}
    />
  );
}
