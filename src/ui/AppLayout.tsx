import type { Conversation, ExportFormat, InteractionMode, Message, ModelConfig, ModelId, SessionTokenUsage, TokenCountVisibility } from '@/types';
import { MessageThread } from './MessageThread';
import { InputBar } from './InputBar';
import { InteractionModeSwitcher } from './InteractionModeSwitcher';
import { Sidebar } from './Sidebar';
import { ModelSelectorPanel } from './ModelSelectorPanel';

interface AppLayoutProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeModels: ModelConfig[];
  /** Full model list for the active conversation (active + inactive). */
  allModels: ModelConfig[];
  messages: Message[];
  /**
   * In-flight streaming messages for the active conversation.
   * Keyed externally by `${conversationId}:${modelId}` in App; threaded here
   * as a flat array for MessageThread to append after persisted messages.
   * Cleared from this array when isDone — at that point the message is in `messages`.
   */
  streamingMessages?: Message[];
  isStreaming?: boolean;
  isGhostMode?: boolean;
  onSend: (content: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRetry?: (messageId: string) => void;
  /** Called when user toggles a model pill on/off. */
  onToggleModel: (modelId: ModelId) => void;
  /** Called when user adds an inactive model back into the active set. */
  onAddModel: (modelId: ModelId) => void;
  /** Current interaction mode for the active conversation. */
  activeMode: InteractionMode;
  /** Called when the user switches interaction modes. Parent persists the change. */
  onModeChange: (mode: InteractionMode) => void;
  /** Called when user edits or clears a per-model system prompt. */
  onUpdateSystemPrompt: (modelId: ModelId, value: string) => void;
  /**
   * Per-model token usage totals for the current conversation session.
   * Passed through to ModelSelectorPanel for display in the slide-up panel.
   */
  sessionUsage: SessionTokenUsage[];
  /**
   * When set, the InputBar shows a directed-reply pill for this model.
   * App owns this state; AppLayout threads it through to InputBar and MessageThread.
   */
  directedReplyTarget?: ModelConfig;
  /** Called when user clicks "Reply to [Model]" on a bubble. Sets the directed-reply target. */
  onDirectedReply: (modelId: ModelId) => void;
  /** Called when user clicks × on the directed-reply pill to clear the target. */
  onClearDirectedReply: () => void;
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility.
   * Threaded from App → AppLayout → MessageThread and ModelSelectorPanel.
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
  /**
   * True while the initial conversation list load is in flight.
   * Threaded from App (useConversationStore) → AppLayout → Sidebar.
   */
  isConversationsLoading?: boolean;
  /**
   * Set when a storage operation fails (e.g. quota exceeded).
   * Threaded from App (useConversationStore) → AppLayout → Sidebar.
   */
  conversationStoreError?: Error | null;
  /**
   * Called when the user picks an export format from the ExportButton popover.
   * Threaded from App → AppLayout → MessageThread → ExportButton.
   * Omit to hide the export button (e.g. when no active conversation exists).
   */
  onExportConversation?: (format: ExportFormat) => void;
  /** Archive a single conversation. Threaded App → AppLayout → Sidebar. */
  onArchiveConversation?: (id: string) => void;
  /** Unarchive a single conversation. Threaded App → AppLayout → Sidebar. */
  onUnarchiveConversation?: (id: string) => void;
  /** Permanently delete a single conversation. Threaded App → AppLayout → Sidebar. */
  onDeleteConversation?: (id: string) => void;
  /** Assign or clear a group on a conversation. Threaded App → AppLayout → Sidebar. */
  onSetConversationGroup?: (id: string, groupId: string | undefined) => void;
  /** Archive multiple conversations. Threaded App → AppLayout → Sidebar. */
  onBulkArchive?: (ids: string[]) => void;
  /** Delete multiple conversations. Threaded App → AppLayout → Sidebar. */
  onBulkDelete?: (ids: string[]) => void;
}

export function AppLayout({
  conversations,
  activeConversationId,
  activeModels,
  allModels,
  messages,
  streamingMessages,
  isStreaming = false,
  isGhostMode = false,
  onSend,
  onSelectConversation,
  onNewConversation,
  onRetry,
  onToggleModel,
  onAddModel,
  activeMode,
  onModeChange,
  onUpdateSystemPrompt,
  sessionUsage,
  directedReplyTarget,
  onDirectedReply,
  onClearDirectedReply,
  tokenCountVisibility,
  isConversationsLoading,
  conversationStoreError,
  onExportConversation,
  onArchiveConversation,
  onUnarchiveConversation,
  onDeleteConversation,
  onSetConversationGroup,
  onBulkArchive,
  onBulkDelete,
}: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Sidebar — 256px fixed */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
        isLoading={isConversationsLoading}
        storageError={conversationStoreError}
        onArchiveConversation={onArchiveConversation}
        onUnarchiveConversation={onUnarchiveConversation}
        onDeleteConversation={onDeleteConversation}
        onSetConversationGroup={onSetConversationGroup}
        onBulkArchive={onBulkArchive}
        onBulkDelete={onBulkDelete}
      />

      {/* Main area — flex-1 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Message thread — scrollable, fills available height */}
        <MessageThread
          messages={messages}
          streamingMessages={streamingMessages}
          models={activeModels}
          onRetry={onRetry}
          onDirectedReply={onDirectedReply}
          tokenCountVisibility={tokenCountVisibility}
          onExport={onExportConversation}
        />

        {/* Bottom section: model selector + mode switcher + input bar */}
        <div className="flex-shrink-0 px-4 pb-0">
          {/* Row: model selector trigger (left) + mode switcher (right) */}
          <div className="flex items-end justify-between">
            <ModelSelectorPanel
              models={allModels}
              onToggleModel={onToggleModel}
              onAddModel={onAddModel}
              onUpdateSystemPrompt={onUpdateSystemPrompt}
              sessionUsage={sessionUsage}
              tokenCountVisibility={tokenCountVisibility}
            />
            {/* Interaction mode switcher — persisted per conversation via onModeChange */}
            <div className="mb-2 flex-shrink-0">
              <InteractionModeSwitcher
                activeMode={activeMode}
                onModeChange={onModeChange}
              />
            </div>
          </div>
        </div>

        {/* Input bar — fixed at bottom of main area */}
        <div className="flex-shrink-0">
          <InputBar
            onSend={onSend}
            isStreaming={isStreaming}
            isGhostMode={isGhostMode}
            directedReplyTarget={directedReplyTarget}
            onClearDirectedReply={onClearDirectedReply}
          />
        </div>
      </main>
    </div>
  );
}
