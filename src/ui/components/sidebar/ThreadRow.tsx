/**
 * ThreadRow and AnimatedListItem — sidebar conversation row components.
 *
 * Extracted from Sidebar.tsx (#146) to improve maintainability.
 * ThreadRow is the largest self-contained section of the sidebar.
 */

import { useState, useRef, useCallback } from 'react';
import type { Conversation } from '@/types';
// #146: ThreadActionMenu is in the parent components/ directory.
import { ThreadActionMenu } from '../ThreadActionMenu';
// #147: shared icon system — EllipsisVerticalIcon replaces the inline SVG.
import { EllipsisVerticalIcon } from '@/ui/icons';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';
import { getThreadTitle } from '@/ui/sidebarUtils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a timestamp into a relative label per the spec. */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMs < 60_000) return '< 1m';
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

// ─── AnimatedListItem ─────────────────────────────────────────────────────────

/**
 * Applies thread-entering CSS animation on mount, then removes the class once
 * the animation completes. This prevents the <li> from retaining an active
 * `animation` property that creates a GPU compositing layer, which would make it
 * the containing block for `position: fixed` descendants (like the context menu
 * backdrop) and restrict the backdrop to only the 64px row height instead of
 * the full sidebar/viewport. See issue #125.
 */
export function AnimatedListItem({ children }: { children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);
  return (
    <li
      className={entered ? undefined : 'thread-entering'}
      onAnimationEnd={() => setEntered(true)}
    >
      {children}
    </li>
  );
}

// ─── ThreadRow ────────────────────────────────────────────────────────────────

export interface ThreadRowProps {
  conversation: Conversation;
  isActive: boolean;
  isChecked: boolean;
  existingGroups: string[];
  onClick: () => void;
  onToggleChecked: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onSetGroup: (groupId: string | undefined) => void;
  onRename: (newTitle: string) => void;
}

export function ThreadRow({
  conversation,
  isActive,
  isChecked,
  existingGroups,
  onClick,
  onToggleChecked,
  onArchive,
  onUnarchive,
  onDelete,
  onSetGroup,
  onRename,
}: ThreadRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  // Ref used to return focus to the trigger button when the menu closes via
  // keyboard (Escape or Tab). Passed into ThreadActionMenu as triggerRef.
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
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

  const handleMenuClose = useCallback(() => setMenuOpen(false), []);
  const handleMenuOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(true);
  }, []);

  const handleCheckboxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      onToggleChecked();
    },
    [onToggleChecked],
  );

  return (
    <div
      className={[
        'group relative w-full',
        isActive
          ? 'bg-hover border-l-2 border-border-strong'
          : 'border-l-2 border-transparent hover:bg-hover/50',
        'transition-colors duration-fast',
      ].join(' ')}
    >
      {/* Checkbox — visible on hover or when checked */}
      <div
        className={[
          'absolute left-2 top-1/2 -translate-y-1/2 z-10',
          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          'transition-opacity duration-fast',
        ].join(' ')}
      >
        <input
          type="checkbox"
          aria-label={`Select conversation: ${title}`}
          checked={isChecked}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="w-3.5 h-3.5 rounded accent-[var(--accent-claude)] cursor-pointer"
        />
      </div>

      {/* Main row button */}
      <button
        type="button"
        onClick={onClick}
        className={[
          'w-full text-left h-16 flex flex-col justify-center',
          isChecked ? 'pl-8' : 'pl-[14px] group-hover:pl-8',
          'pr-8',
          'transition-all duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
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

      {/* Three-dot menu trigger — visible on hover */}
      <button
        ref={menuTriggerRef}
        type="button"
        aria-label="Conversation actions"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={handleMenuOpen}
        className={[
          'absolute right-1.5 top-1/2 -translate-y-1/2 z-10',
          'w-6 h-6 rounded flex items-center justify-center',
          'text-text-muted hover:text-text-secondary hover:bg-hover',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
          menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        ].join(' ')}
      >
        {/* Vertical three-dot (ellipsis) icon — shared icon (#147) */}
        <EllipsisVerticalIcon className="flex-shrink-0" />
      </button>

      {/* Dropdown menu */}
      {menuOpen && (
        <ThreadActionMenu
          conversation={conversation}
          existingGroups={existingGroups}
          onArchive={onArchive}
          onUnarchive={onUnarchive}
          onDelete={onDelete}
          onSetGroup={onSetGroup}
          onRename={onRename}
          onClose={handleMenuClose}
          triggerRef={menuTriggerRef}
        />
      )}
    </div>
  );
}
