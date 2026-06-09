import type { Conversation, InteractionMode, Message, ModelConfig, ModelId, SessionTokenUsage } from '@/types';
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
}

export function AppLayout({
  conversations,
  activeConversationId,
  activeModels,
  allModels,
  messages,
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
}: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      {/* Sidebar — 256px fixed */}
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={onSelectConversation}
        onNewConversation={onNewConversation}
      />

      {/* Main area — flex-1 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Message thread — scrollable, fills available height */}
        <MessageThread
          messages={messages}
          models={activeModels}
          onRetry={onRetry}
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
          />
        </div>
      </main>
    </div>
  );
}
