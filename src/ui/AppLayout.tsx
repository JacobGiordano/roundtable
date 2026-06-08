import type { Conversation, Message, ModelConfig, ModelId } from '@/types';
import { MessageThread } from './MessageThread';
import { InputBar } from './InputBar';
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

        {/* Bottom section: model selector + input bar */}
        <div className="flex-shrink-0 px-4 pb-0">
          {/* Model selector panel — slides up above the input bar */}
          <ModelSelectorPanel
            models={allModels}
            onToggleModel={onToggleModel}
            onAddModel={onAddModel}
          />
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
