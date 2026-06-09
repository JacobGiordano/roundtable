import { useState, useCallback } from 'react';
import type { Conversation, InteractionMode, Message, ModelConfig, ModelId, StreamChunk } from '@/types';
import { AppLayout } from '@/ui/AppLayout';
// Cross-agent exception: sendMessage and getSessionTokenUsage are pure utilities
// exported from @/models per the documented exception in CLAUDE.md.
import { sendMessage, getSessionTokenUsage } from '@/models';
// Gate cross-agent exception: useUserPreferences reads/writes UserPreferences from
// localStorage. Called at the App root so tokenCountVisibility can be threaded
// down the component tree without per-component Gate imports.
import { useUserPreferences } from '@/auth';
// Vault cross-agent exception: useConversationStore is the persistence hook
// exported from @/storage. Aria consumes it at the App root to provide real
// persisted conversation state to the sidebar and message thread.
import { useConversationStore } from '@/storage';

// ─── Mock Data ────────────────────────────────────────────────────────────────

// Model config stays local — model selection is Phase 4 territory.
// Conversations are now owned by useConversationStore (Vault).
const MOCK_MODELS: ModelConfig[] = [
  {
    modelId: 'claude',
    name: 'Claude',
    color: 'accent-claude',
    isActive: true,
  },
  {
    modelId: 'gpt-5.5',
    name: 'GPT-5.5',
    color: 'accent-gpt',
    isActive: true,
  },
];

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  // ── Conversation store (Vault) ─────────────────────────────────────────────
  // useConversationStore is the persistence hook from @/storage. It provides
  // real persisted conversations and exposes mutation methods. Replaces the
  // former MOCK_CONVERSATIONS + useState<Conversation[]> approach.
  const store = useConversationStore();

  // Per-conversation model state: model selection is Phase 4 territory.
  // Keep a top-level models array that all conversations share for now.
  const [models, setModels] = useState<ModelConfig[]>(MOCK_MODELS);

  // Directed reply: when set, the next send is targeted at this model only.
  // Cleared automatically after a message is sent, or manually via the × pill.
  const [pendingTargetModelId, setPendingTargetModelId] = useState<ModelId | null>(null);

  // UserPreferences from Gate — read at the App root so tokenCountVisibility can
  // be threaded down the tree without per-component Gate imports.
  const [userPrefs] = useUserPreferences();
  const { tokenCountVisibility } = userPrefs;

  const activeConversation = store.getActiveConversation();
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
    void store.updateConversation(updatedConversation);

    // Clear the pending target after send — returns to broadcast mode.
    setPendingTargetModelId(null);

    // Pass the conversation so sendMessage can resolve per-model systemPrompts
    // from each ModelConfig.systemPrompt on the conversation's models array.
    void sendMessage(
      {
        conversationId: conversationSnapshot.id,
        content,
        // Thread targetModelId into SendMessageOptions so Atlas routes to only that model.
        targetModelId: pendingTargetModelId ?? undefined,
        conversation: updatedConversation,
      },
      (chunk: StreamChunk) => {
        // TODO (Phase 2): wire streaming chunks into conversation message state.
        // For now, chunks are received but not yet applied to UI state.
        void chunk;
      },
    );
  };

  const handleNewConversation = () => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      messages: [],
      models: models,
      interactionMode: 'parallel',
      isGhost: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Persist the new conversation and set it as active.
    void store.createConversation(newConv).then(() => {
      store.setActiveConversation(newConv.id);
    });
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
    if (!conv) return;
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
    const conv = store.getActiveConversation();
    if (conv) {
      void store.updateConversation({
        ...conv,
        models: conv.models.map((m) =>
          m.modelId === modelId ? { ...m, systemPrompt: updatedSystemPrompt } : m,
        ),
        updatedAt: Date.now(),
      });
    }
  };

  const handleDirectedReply = useCallback((modelId: ModelId) => {
    setPendingTargetModelId(modelId);
  }, []);

  const handleClearDirectedReply = useCallback(() => {
    setPendingTargetModelId(null);
  }, []);

  return (
    <AppLayout
      conversations={store.conversations}
      activeConversationId={store.activeConversationId}
      activeModels={activeModels}
      allModels={models}
      messages={messages}
      isStreaming={false}
      isGhostMode={false}
      onSend={handleSend}
      onSelectConversation={handleSelectConversation}
      onNewConversation={handleNewConversation}
      onToggleModel={handleToggleModel}
      onAddModel={handleAddModel}
      activeMode={activeConversation?.interactionMode ?? 'parallel'}
      onModeChange={handleModeChange}
      onUpdateSystemPrompt={handleUpdateSystemPrompt}
      sessionUsage={sessionUsage}
      directedReplyTarget={directedReplyTarget}
      onDirectedReply={handleDirectedReply}
      onClearDirectedReply={handleClearDirectedReply}
      tokenCountVisibility={tokenCountVisibility}
      isConversationsLoading={store.isLoading}
      conversationStoreError={store.storageError}
    />
  );
}
