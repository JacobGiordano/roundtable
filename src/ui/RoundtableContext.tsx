/**
 * RoundtableContext — UI-internal shared state, eliminating prop drilling.
 *
 * All types here are UI-internal (not in /src/types/index.ts) because they
 * describe how App.tsx shares state with its subtree, not cross-agent contracts.
 *
 * State still lives in App.tsx. This context is the delivery mechanism only.
 * Intermediate components (AppLayout) no longer need to accept and re-pass
 * the full list of App-owned callbacks and values.
 *
 * Provider: App.tsx renders <RoundtableContext.Provider value={...}>.
 * Consumers: Sidebar, MessageThread, ModelSelectorPanel, InputBar,
 *             InteractionModeSwitcher — each reads only the slice it needs.
 */

import { createContext, useContext } from 'react';
import type {
  Conversation,
  ExportFormat,
  InteractionMode,
  Message,
  ModelConfig,
  ModelId,
  SessionTokenUsage,
  StopMessageFn,
  TokenCountVisibility,
} from '@/types';

// ─── Context value shape ───────────────────────────────────────────────────────

export interface RoundtableContextValue {
  // ── Conversation list (Sidebar) ──────────────────────────────────────────
  conversations: Conversation[];
  activeConversationId: string | null;
  isConversationsLoading: boolean;
  conversationStoreError: Error | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onArchiveConversation: (id: string) => void;
  onUnarchiveConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onSetConversationGroup: (id: string, groupId: string | undefined) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onBulkArchive: (ids: string[]) => void;
  onBulkDelete: (ids: string[]) => void;

  // ── Ghost mode (Sidebar + InputBar) ─────────────────────────────────────
  isGhostMode: boolean;
  onToggleGhostMode: () => void;

  // ── Messages (MessageThread) ─────────────────────────────────────────────
  messages: Message[];
  streamingMessages: Message[];
  activeModels: ModelConfig[];
  /** Full list (active + inactive) — ModelSelectorPanel, InputBar */
  allModels: ModelConfig[];
  onRetry: (messageId: string) => void;
  onDirectedReply: (modelId: ModelId) => void;
  tokenCountVisibility: TokenCountVisibility;
  onExportConversation: ((format: ExportFormat) => void) | undefined;
  onEditMessage: (messageIndex: number) => void;

  // ── Edit mode (InputBar + MessageThread) ─────────────────────────────────
  editingMessage: { messageIndex: number; originalContent: string } | undefined;
  onCancelEdit: () => void;

  // ── Input bar ────────────────────────────────────────────────────────────
  isStreaming: boolean;
  directedReplyTarget: ModelConfig | undefined;
  onClearDirectedReply: () => void;
  /**
   * Abort all active streams for the current fan-out. No-op before any send
   * and after all streams settle. Wired to the stop button in InputBar.
   * Type: StopMessageFn (from @/types — Atlas-declared, Aria-consumed).
   */
  stopMessage: StopMessageFn;

  // ── Model selector (ModelSelectorPanel) ─────────────────────────────────
  onToggleModel: (modelId: ModelId) => void;
  onAddModel: (modelId: ModelId) => void;
  onUpdateSystemPrompt: (modelId: ModelId, value: string) => void;
  onSelectModelVersion: (modelId: ModelId, versionId: string) => void;
  onClearModelVersion: (modelId: ModelId) => void;
  /**
   * Persists the user's image generation opt-in for a model.
   * Writes to ModelConfig.imageGenerationEnabled in the active conversation.
   * Only meaningful for models with capabilities.imageGeneration === true.
   * Atlas reads this field in sendMessage.ts to gate image output modality params.
   */
  onToggleImageGeneration: (modelId: ModelId, enabled: boolean) => void;
  sessionUsage: SessionTokenUsage[];

  // ── Interaction mode (InteractionModeSwitcher) ───────────────────────────
  activeMode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;

  // ── Roster (ModelSelectorPanel + AppLayout OnboardingEmptyState guard) ───
  isRosterEmpty: boolean;
  /** Called whenever ProviderSettingsPanel closes; App re-reads the roster. */
  onRosterChange: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const RoundtableContext = createContext<RoundtableContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Consume the Roundtable UI context. Must be called inside a subtree rendered
 * by <RoundtableContext.Provider>. Throws if called outside the provider tree
 * (helps catch accidental misuse early).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useRoundtable(): RoundtableContextValue {
  const ctx = useContext(RoundtableContext);
  if (ctx === null) {
    throw new Error('useRoundtable must be used within a RoundtableContext.Provider');
  }
  return ctx;
}

export { RoundtableContext };
