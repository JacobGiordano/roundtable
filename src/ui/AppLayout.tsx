import type { Conversation, Message, ModelConfig } from '@/types';
import { MessageThread } from './MessageThread';
import { InputBar } from './InputBar';
import { Sidebar } from './Sidebar';

interface AppLayoutProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  activeModels: ModelConfig[];
  messages: Message[];
  isStreaming?: boolean;
  isGhostMode?: boolean;
  onSend: (content: string) => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRetry?: (messageId: string) => void;
}

export function AppLayout({
  conversations,
  activeConversationId,
  activeModels,
  messages,
  isStreaming = false,
  isGhostMode = false,
  onSend,
  onSelectConversation,
  onNewConversation,
  onRetry,
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
