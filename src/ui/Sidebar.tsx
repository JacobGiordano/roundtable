import type { Conversation } from '@/types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

/** Format a timestamp into a relative label per the spec. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 60) return `${diffMinutes}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;

  // Same day: "2:34 PM"
  const msgDate = new Date(timestamp);
  const today = new Date();
  if (
    msgDate.getDate() === today.getDate() &&
    msgDate.getMonth() === today.getMonth() &&
    msgDate.getFullYear() === today.getFullYear()
  ) {
    return msgDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Otherwise: "Jan 4"
  return msgDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Derive thread title from conversation data. */
function getThreadTitle(conversation: Conversation): string {
  if (conversation.title) return conversation.title;
  const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.replace(/\n/g, ' ').slice(0, 40);
  }
  return 'New conversation';
}

/** Maps a ModelId to the matching CSS custom property class for the dot color. */
function getModelDotStyle(modelId: string): React.CSSProperties {
  switch (modelId) {
    case 'claude':  return { backgroundColor: 'var(--accent-claude)' };
    case 'gpt-5.5': return { backgroundColor: 'var(--accent-gpt)' };
    default:        return { backgroundColor: 'var(--accent-other)' };
  }
}

interface ThreadRowProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

function ThreadRow({ conversation, isActive, onClick }: ThreadRowProps) {
  const title = getThreadTitle(conversation);
  const timestamp = formatRelativeTime(conversation.updatedAt);

  // Collect unique participating model IDs (in order first seen)
  const modelIds: string[] = [];
  for (const msg of conversation.messages) {
    if (msg.role === 'assistant' && msg.modelId && !modelIds.includes(msg.modelId)) {
      modelIds.push(msg.modelId);
    }
  }
  const visibleDots = modelIds.slice(0, 4);
  const extraCount = modelIds.length > 4 ? modelIds.length - 4 : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'w-full text-left h-16 flex flex-col justify-center',
        'transition-colors duration-fast',
        isActive
          ? 'bg-hover border-l-2 border-border-strong pl-[14px] pr-4'
          : 'border-l-2 border-transparent pl-[14px] pr-4 hover:bg-hover/50',
      ].join(' ')}
    >
      {/* Row 1: title + timestamp */}
      <div className="flex items-center justify-between gap-2 w-full">
        <span
          className={[
            'text-[13px] font-medium truncate',
            isActive ? 'text-text-primary' : 'text-text-secondary',
          ].join(' ')}
        >
          {title}
        </span>
        <span className="text-[11px] font-normal text-text-muted flex-shrink-0">
          {timestamp}
        </span>
      </div>

      {/* Row 2: model dots */}
      <div className="flex items-center gap-[3px] mt-1">
        {visibleDots.map((modelId) => (
          <span
            key={modelId}
            className="w-[6px] h-[6px] rounded-full flex-shrink-0"
            style={getModelDotStyle(modelId)}
          />
        ))}
        {extraCount > 0 && (
          <span className="text-[10px] text-text-muted ml-1">+{extraCount}</span>
        )}
      </div>
    </button>
  );
}

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: SidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col h-full bg-sidebar border-r border-border overflow-hidden">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <span className="text-[15px] font-semibold text-text-primary tracking-tight">
          Roundtable
        </span>
        <button
          type="button"
          onClick={onNewConversation}
          aria-label="New conversation"
          className={[
            'w-8 h-8 rounded-md flex items-center justify-center',
            'text-text-secondary',
            'hover:bg-hover',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M8 2v12M2 8h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* Thread list */}
      <nav className="flex-1 overflow-y-auto" aria-label="Conversations">
        {conversations.length === 0 ? (
          <div className="flex-1 flex items-center justify-center h-full">
            <p className="text-[13px] text-text-muted text-center px-4">
              Start a conversation
            </p>
          </div>
        ) : (
          <ul className="py-1">
            {conversations.map((conv) => (
              <li key={conv.id} className="thread-entering">
                <ThreadRow
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => onSelectConversation(conv.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>
    </aside>
  );
}
