import { useState, useCallback, useMemo } from 'react';
import type { Conversation } from '@/types';
// Gate cross-agent exception: ApiKeyPanel and TokenCountControl are self-contained
// Gate components mounted here per the issue spec. They manage their own state
// internally via Gate hooks — Aria only mounts them in the settings panel.
import { ApiKeyPanel, TokenCountControl } from '@/auth';
import { groupConversations } from './groupConversations';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  /** True while the initial conversation list load is in flight (from useConversationStore). */
  isLoading?: boolean;
  /** Set when a storage operation fails (e.g. quota exceeded). Surface to user. */
  storageError?: Error | null;
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
    case 'claude':
      return { backgroundColor: 'var(--accent-claude)' };
    case 'gpt-5.5':
      return { backgroundColor: 'var(--accent-gpt)' };
    default:
      return { backgroundColor: 'var(--accent-other)' };
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

// ─── Group support ────────────────────────────────────────────────────────────

// groupConversations is imported from ./groupConversations (extracted for testability).

interface GroupHeaderProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}

function GroupHeader({ label, isOpen, onToggle }: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={[
        'w-full flex items-center gap-1.5 h-8 px-4',
        'text-left cursor-pointer select-none',
        'text-text-muted hover:text-text-secondary',
        'hover:bg-hover/40 transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
      ].join(' ')}
    >
      {/* Chevron rotates to indicate open/closed state */}
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        aria-hidden="true"
        className="flex-shrink-0 transition-transform duration-fast"
        style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
      >
        <path
          d="M2 1.5L5.5 4L2 6.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
        {label}
      </span>
    </button>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ThreadSkeleton() {
  return (
    <div className="h-16 flex flex-col justify-center pl-[14px] pr-4 gap-2 opacity-40">
      <div className="h-2.5 w-3/4 rounded bg-border animate-pulse" />
      <div className="h-2 w-1/2 rounded bg-border animate-pulse" />
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  isLoading = false,
  storageError = null,
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  // Track which named groups are collapsed. All groups start open.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const handleToggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Memoize grouping — recalculates only when the conversations array changes.
  const { named: namedGroups, ungrouped } = useMemo(
    () => groupConversations(conversations),
    [conversations],
  );

  const hasAnyGroups = namedGroups.size > 0;

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
      <nav
        className={['flex-1 overflow-y-auto', isLoading ? 'opacity-60' : ''].join(' ')}
        aria-label="Conversations"
        aria-busy={isLoading}
      >
        {isLoading ? (
          // Skeleton state during initial load
          <ul className="py-1" aria-hidden="true">
            <li><ThreadSkeleton /></li>
            <li><ThreadSkeleton /></li>
            <li><ThreadSkeleton /></li>
          </ul>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-text-muted text-center px-4">
              Start a conversation
            </p>
          </div>
        ) : hasAnyGroups ? (
          // ── Grouped view ────────────────────────────────────────────────
          // Named groups first (alphabetical), ungrouped section last.
          <ul className="py-1">
            {[...namedGroups.entries()].map(([groupId, groupConvs]) => {
              const isOpen = !collapsedGroups.has(groupId);
              return (
                <li key={groupId}>
                  <GroupHeader
                    label={groupId}
                    isOpen={isOpen}
                    onToggle={() => handleToggleGroup(groupId)}
                  />
                  {isOpen && (
                    <ul>
                      {groupConvs.map((conv) => (
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
                </li>
              );
            })}

            {/* Ungrouped conversations — no header, listed after all named groups */}
            {ungrouped.map((conv) => (
              <li key={conv.id} className="thread-entering">
                <ThreadRow
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => onSelectConversation(conv.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          // ── Flat view (no groups present) ───────────────────────────────
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

      {/* Storage error notice — unobtrusive red text line above settings */}
      {storageError && (
        <div
          role="alert"
          className="flex-shrink-0 px-4 py-2 text-[11px] text-semantic-error border-t border-border"
        >
          Storage error: {storageError.message}
        </div>
      )}

      {/* Settings panel — collapsible, pinned to the bottom of the sidebar.
          Houses ApiKeyPanel (Gate) and TokenCountControl (Gate).
          Both components are self-contained and manage their own state. */}
      <div className="flex-shrink-0 border-t border-border">
        {/* Settings toggle row */}
        <button
          type="button"
          aria-expanded={isSettingsOpen}
          aria-controls="sidebar-settings-panel"
          onClick={handleToggleSettings}
          className={[
            'w-full flex items-center gap-2 h-10 px-4',
            'text-left cursor-pointer select-none',
            'text-text-muted hover:text-text-secondary',
            'hover:bg-hover transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          ].join(' ')}
        >
          {/* Gear icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            className="flex-shrink-0"
          >
            <path
              d="M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M11.5 7c0-.28-.03-.55-.07-.81l1.3-1.01-1.25-2.16-1.57.63a4.5 4.5 0 0 0-1.4-.81L8.25 1h-2.5l-.26 1.84a4.5 4.5 0 0 0-1.4.81L2.52 3.02 1.27 5.18l1.3 1.01A4.6 4.6 0 0 0 2.5 7c0 .28.03.55.07.81L1.27 8.82l1.25 2.16 1.57-.63c.43.33.9.6 1.4.81L5.75 13h2.5l.26-1.84c.5-.21.97-.48 1.4-.81l1.57.63 1.25-2.16-1.3-1.01c.04-.26.07-.53.07-.81Z"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[12px] font-medium flex-1">Settings</span>
          {/* Chevron */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
            className="transition-transform duration-fast flex-shrink-0"
            style={{ transform: isSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          >
            <path
              d="M1.5 3.5L5 7L8.5 3.5"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Expanded settings body */}
        {isSettingsOpen && (
          <div
            id="sidebar-settings-panel"
            className="px-4 pb-4 pt-2 flex flex-col gap-4 overflow-y-auto max-h-[60vh]"
          >
            {/* API key management — Gate component, self-contained */}
            <ApiKeyPanel />

            {/* Token count visibility preference — Gate component, self-contained */}
            <TokenCountControl />
          </div>
        )}
      </div>
    </aside>
  );
}
