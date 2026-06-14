import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Conversation } from '@/types';
// Gate cross-agent exception: ApiKeyPanel and TokenCountControl are self-contained
// Gate components mounted here per the issue spec. They manage their own state
// internally via Gate hooks — Aria only mounts them in the settings panel.
// getRequiredCredentialKeys is a pure utility from @/auth — permitted exception per CLAUDE.md.
// getModelAccentColors, clearAllModelAccentColors: Gate persistence functions used by
// the "Reset all model colors to theme defaults" control in the settings panel.
// getSidebarWidth, saveSidebarWidth, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX: Gate
// persistence functions for drag-resize UI (#62) — permitted exception per CLAUDE.md.
import {
  ApiKeyPanel,
  TokenCountControl,
  getRequiredCredentialKeys,
  getModelAccentColors,
  clearAllModelAccentColors,
  getSidebarWidth,
  saveSidebarWidth,
  SIDEBAR_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  // Gate cross-agent exception: setActiveTheme persists the user's chosen theme ID
  // to localStorage. getThemePreference reads it for initializing the switcher state.
  // Both are pure Gate persistence functions — permitted exception per CLAUDE.md.
  setActiveTheme,
  getThemePreference,
} from '@/auth';
// Atlas cross-agent exception: MODEL_REGISTRY is a pure data constant exported from
// @/models — permitted per CLAUDE.md. Used to build a modelId→color lookup so that
// getModelDotStyle is data-driven and requires no changes when new models are added.
import { MODEL_REGISTRY } from '@/models';
import { groupConversations } from './groupConversations';
// applyUserAccentColors: re-runs the CSS override pass after clearing all stored colors.
// Called with {} so every model reverts to its theme default (no overrides applied).
// applyTheme: applies the selected theme's token set to :root CSS custom properties.
// THEME_MAP / THEME_IDS: shared static lookup constants (Vite requires static imports
// for JSON — these live in theme.ts so both main.tsx and Sidebar share the same map).
import { applyUserAccentColors, applyTheme, THEME_MAP, THEME_IDS } from './theme';
import type { ThemeId } from '@/types';
import { RoundtableLogo } from './RoundtableLogo';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  /** True while the initial conversation list load is in flight (from useConversationStore). */
  isLoading?: boolean;
  /** Set when a storage operation fails (e.g. quota exceeded). Surface to user. */
  storageError?: Error | null;
  /** Archive a single conversation. */
  onArchiveConversation?: (id: string) => void;
  /** Unarchive a single conversation. */
  onUnarchiveConversation?: (id: string) => void;
  /** Permanently delete a single conversation. */
  onDeleteConversation?: (id: string) => void;
  /** Assign or clear a group on a conversation. Pass undefined to clear. */
  onSetConversationGroup?: (id: string, groupId: string | undefined) => void;
  /** Archive multiple conversations at once (no confirmation required). */
  onBulkArchive?: (ids: string[]) => void;
  /** Delete multiple conversations at once. */
  onBulkDelete?: (ids: string[]) => void;
  /**
   * Controls the mobile drawer open state. On desktop (>= md breakpoint) this
   * prop is ignored — the sidebar is always visible via static positioning.
   * On mobile (< md) the sidebar is a fixed overlay that slides in/out based
   * on this value. Default false (closed).
   */
  isMobileOpen?: boolean;
  /** Called when the mobile drawer should close (e.g. a conversation is selected). */
  onMobileClose?: () => void;
  /**
   * When provided, overrides the internal isSettingsOpen state.
   * Used by AppLayout to synchronise the sidebar settings panel with the
   * header gear button trigger on both desktop and mobile.
   */
  isSettingsOpen?: boolean;
  /**
   * When provided, overrides the internal handleToggleSettings handler.
   * Paired with isSettingsOpen for external control of the settings panel.
   */
  onToggleSettings?: () => void;
  /**
   * Called when the user clicks the provider-settings gear icon in the sidebar
   * header. AppLayout handles the panel open state and mounts ProviderSettingsPanel
   * at the top level of the app. Optional — no gear icon is rendered if absent.
   */
  onOpenProviderSettings?: () => void;
  /**
   * Ref forwarded to the provider-settings gear icon button so that
   * ProviderSettingsPanel can return focus to it on close.
   */
  providerSettingsTriggerRef?: React.RefObject<HTMLButtonElement>;
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

/**
 * Lookup table from modelId → CSS variable string, built from MODEL_REGISTRY.
 * Adding a new model to MODEL_REGISTRY automatically makes it available here —
 * no manual switch/case update required.
 */
const MODEL_DOT_CSS_VAR: Record<string, string> = Object.fromEntries(
  MODEL_REGISTRY.map((entry) => [entry.modelId, `var(--${entry.color})`]),
);

/**
 * Returns the inline style for a model identity dot using the CSS variable
 * derived from MODEL_REGISTRY. Falls back to --accent-other for unknown modelIds.
 * ThreadRow only has modelId strings from message history (no full ModelConfig),
 * so this lookup is driven by MODEL_REGISTRY rather than a switch statement.
 */
function getModelDotStyle(modelId: string): React.CSSProperties {
  return { backgroundColor: MODEL_DOT_CSS_VAR[modelId] ?? 'var(--accent-other)' };
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

type ThreadMenuState =
  | { type: 'closed' }
  | { type: 'menu' }
  | { type: 'confirm-delete' }
  | { type: 'group-input' };

interface ThreadActionMenuProps {
  conversation: Conversation;
  /** All distinct group names currently in use across conversations. */
  existingGroups: string[];
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onSetGroup: (groupId: string | undefined) => void;
  onClose: () => void;
  /** Ref to the trigger button — focus is returned here on Escape or Tab close. */
  triggerRef: React.RefObject<HTMLButtonElement>;
}

function ThreadActionMenu({
  conversation,
  existingGroups,
  onArchive,
  onUnarchive,
  onDelete,
  onSetGroup,
  onClose,
  triggerRef,
}: ThreadActionMenuProps) {
  const [menuState, setMenuState] = useState<ThreadMenuState>({ type: 'menu' });
  const [groupInput, setGroupInput] = useState(conversation.groupId ?? '');
  const menuRef = useRef<HTMLDivElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  // Ref for the Cancel button in the confirm-delete sub-state.
  // Focus is moved here on transition so keyboard users land on the safe
  // default action (Cancel) rather than losing focus to document.body.
  // Same pattern as ProviderRow confirm state in #115 (WCAG 2.4.3).
  const confirmCancelRef = useRef<HTMLButtonElement>(null);

  // Outside-click close is handled by the full-viewport backdrop rendered in
  // ThreadActionMenu's JSX (fixed inset-0 z-30). The document-level mousedown
  // listener is no longer needed.

  // Focus first menuitem when the menu state is 'menu' (on initial open and
  // if the user navigates back to the top-level menu from a sub-state).
  useEffect(() => {
    if (menuState.type === 'menu') {
      const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [menuState.type]);

  // Focus Cancel button when confirm-delete sub-state opens (WCAG 2.4.3, #113).
  // Cancel is the safe default for a destructive action.
  useEffect(() => {
    if (menuState.type === 'confirm-delete') {
      confirmCancelRef.current?.focus();
    }
  }, [menuState.type]);

  // Focus group input when it appears
  useEffect(() => {
    if (menuState.type === 'group-input') {
      groupInputRef.current?.focus();
    }
  }, [menuState.type]);

  /** Close the menu and return focus to the trigger button. */
  const closeAndReturnFocus = useCallback(() => {
    onClose();
    // Schedule focus restoration via rAF so the DOM settles (menu unmounts)
    // before the trigger receives focus.
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  }, [onClose, triggerRef]);

  const handleGroupConfirm = useCallback(() => {
    const trimmed = groupInput.trim();
    onSetGroup(trimmed === '' ? undefined : trimmed);
    closeAndReturnFocus();
  }, [groupInput, onSetGroup, closeAndReturnFocus]);

  const handleGroupKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleGroupConfirm();
      } else if (e.key === 'Escape') {
        closeAndReturnFocus();
      }
    },
    [handleGroupConfirm, closeAndReturnFocus],
  );

  /**
   * Keyboard handler attached to the menu container (role="menu").
   *
   * ARIA menu keyboard contract:
   * - Tab / Shift+Tab: close menu (menus are not in the tab order).
   * - Escape: close menu and return focus to trigger.
   * - ArrowDown/Up: move focus between menuitems (wraps at boundaries).
   * - Home/End: jump to first/last menuitem.
   *
   * Arrow-key navigation only applies in the top-level 'menu' state.
   * The confirm-delete and group-input sub-states manage their own focus
   * and Tab behaviour (they are dialog-like widgets, not menus).
   */
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Tab (or Shift+Tab) exits the menu — menus must not be Tab-navigable.
      if (e.key === 'Tab') {
        e.preventDefault();
        closeAndReturnFocus();
        return;
      }

      // Escape always closes and returns focus.
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndReturnFocus();
        return;
      }

      // Arrow-key navigation is only relevant in the top-level menu state.
      if (menuState.type !== 'menu') return;

      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      if (items.length === 0) return;

      const focused = document.activeElement as HTMLElement;
      const currentIndex = items.indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prev]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        items[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        items[items.length - 1]?.focus();
      }
    },
    [menuState.type, closeAndReturnFocus],
  );

  const isArchived = conversation.archivedAt !== undefined;

  return (
    <>
      {/* Full-viewport backdrop — sits behind the menu, above all sibling rows.
          Intercepts pointer events so rows beneath the open menu cannot receive
          hover or click events (fixes #114 hover bleed). onMouseDown closes the
          menu and replaces the document-level mousedown listener for outside clicks. */}
      <div
        className="fixed inset-0 z-30"
        aria-hidden="true"
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
      />
      <div
        ref={menuRef}
        role="menu"
        aria-label="Conversation actions"
        onKeyDown={handleMenuKeyDown}
        className={[
          'absolute right-2 top-1 z-40',
          'min-w-[160px] py-1 rounded-md',
          'bg-card border border-border',
          'shadow-md',
          'text-[12px]',
        ].join(' ')}
      >
      {menuState.type === 'menu' && (
        <>
          {isArchived ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onUnarchive(); closeAndReturnFocus(); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast"
            >
              Unarchive
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onArchive(); closeAndReturnFocus(); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast"
            >
              Archive
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setMenuState({ type: 'group-input' })}
            className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast"
          >
            Move to group&hellip;
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setMenuState({ type: 'confirm-delete' })}
            className="w-full text-left px-3 py-1.5 text-error hover:bg-hover transition-colors duration-fast"
          >
            Delete
          </button>
        </>
      )}

      {menuState.type === 'confirm-delete' && (
        <div className="px-3 py-2">
          <p className="text-text-secondary mb-2">Delete this conversation?</p>
          <div className="flex gap-2">
            <button
              ref={confirmCancelRef}
              type="button"
              onClick={onClose}
              className="flex-1 px-2 py-1 rounded text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { onDelete(); onClose(); }}
              className="flex-1 px-2 py-1 rounded text-white bg-error-bg hover:opacity-90 transition-opacity duration-fast text-[11px]"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {menuState.type === 'group-input' && (
        <div className="px-3 py-2">
          <p className="text-text-muted mb-1.5 text-[11px]">Group name (blank to clear)</p>
          <input
            ref={groupInputRef}
            type="text"
            value={groupInput}
            onChange={(e) => setGroupInput(e.target.value)}
            onKeyDown={handleGroupKeyDown}
            placeholder="Enter group name"
            className={[
              'w-full px-2 py-1 rounded text-[12px]',
              'bg-input border border-border',
              'text-text-primary placeholder:text-text-muted',
              'focus:outline-none focus:ring-1 focus:ring-focus',
            ].join(' ')}
          />
          {/* Existing group suggestions */}
          {existingGroups.length > 0 && (
            <ul className="mt-1.5 max-h-24 overflow-y-auto">
              {existingGroups.map((g) => (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => { onSetGroup(g); onClose(); }}
                    className="w-full text-left px-2 py-1 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast text-[11px] rounded"
                  >
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-2 py-1 rounded text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGroupConfirm}
              className="flex-1 px-2 py-1 rounded text-text-primary bg-interactive-active hover:opacity-90 transition-opacity duration-fast text-[11px]"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ─── ThreadRow ────────────────────────────────────────────────────────────────

interface ThreadRowProps {
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
}

function ThreadRow({
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
          isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
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
        {/* Vertical three-dot (ellipsis) icon */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <circle cx="6" cy="2" r="1.1" />
          <circle cx="6" cy="6" r="1.1" />
          <circle cx="6" cy="10" r="1.1" />
        </svg>
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
          onClose={handleMenuClose}
          triggerRef={menuTriggerRef}
        />
      )}
    </div>
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
      <div className="h-2.5 w-3/4 rounded bg-border animate-pulse motion-reduce:animate-none" />
      <div className="h-2 w-1/2 rounded bg-border animate-pulse motion-reduce:animate-none" />
    </div>
  );
}

// ─── Archive filter toggle ────────────────────────────────────────────────────

type ArchiveFilter = 'active' | 'archived';

interface ArchiveToggleProps {
  value: ArchiveFilter;
  onChange: (value: ArchiveFilter) => void;
}

function ArchiveToggle({ value, onChange }: ArchiveToggleProps) {
  return (
    <div className="flex items-center mx-3 my-1.5 rounded-md overflow-hidden border border-border text-[11px] font-medium">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={[
          'flex-1 py-1 text-center transition-colors duration-fast',
          value === 'active'
            ? 'bg-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary hover:bg-hover/40',
        ].join(' ')}
        aria-pressed={value === 'active'}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange('archived')}
        className={[
          'flex-1 py-1 text-center transition-colors duration-fast',
          value === 'archived'
            ? 'bg-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary hover:bg-hover/40',
        ].join(' ')}
        aria-pressed={value === 'archived'}
      >
        Archived
      </button>
    </div>
  );
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

type BulkBarState = 'idle' | 'confirm-delete';

interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
}

function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkArchive,
  onBulkDelete,
}: BulkActionBarProps) {
  const [barState, setBarState] = useState<BulkBarState>('idle');
  const allSelected = selectedCount === totalCount && totalCount > 0;

  const handleBulkDeleteConfirm = useCallback(() => {
    onBulkDelete();
    setBarState('idle');
  }, [onBulkDelete]);

  return (
    <div className="flex-shrink-0 border-b border-border bg-hover/30">
      {/* Header row: select-all + deselect */}
      <div className="flex items-center px-3 py-1.5 gap-2">
        <input
          type="checkbox"
          aria-label={allSelected ? 'Deselect all' : 'Select all'}
          checked={allSelected}
          onChange={allSelected ? onDeselectAll : onSelectAll}
          className="w-3.5 h-3.5 rounded accent-[var(--accent-claude)] cursor-pointer"
        />
        <span className="flex-1 text-[11px] text-text-secondary">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onDeselectAll}
          className="text-[11px] text-text-muted hover:text-text-secondary transition-colors duration-fast"
        >
          Clear
        </button>
      </div>

      {/* Action row */}
      {barState === 'idle' ? (
        <div className="flex items-center px-3 pb-1.5 gap-2">
          <button
            type="button"
            onClick={onBulkArchive}
            className={[
              'flex-1 py-1 rounded text-[11px] text-center',
              'text-text-secondary bg-hover hover:bg-hover/80',
              'transition-colors duration-fast',
            ].join(' ')}
          >
            Archive selected
          </button>
          <button
            type="button"
            onClick={() => setBarState('confirm-delete')}
            className={[
              'flex-1 py-1 rounded text-[11px] text-center',
              'text-error bg-hover hover:bg-hover/80',
              'transition-colors duration-fast',
            ].join(' ')}
          >
            Delete selected
          </button>
        </div>
      ) : (
        /* Inline delete confirmation */
        <div className="px-3 pb-1.5">
          <p className="text-[11px] text-text-secondary mb-1.5">
            Delete {selectedCount} conversation{selectedCount !== 1 ? 's' : ''}?
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setBarState('idle')}
              className="flex-1 py-1 rounded text-[11px] text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteConfirm}
              className="flex-1 py-1 rounded text-[11px] text-white bg-error-bg hover:opacity-90 transition-opacity duration-fast"
            >
              Delete
            </button>
          </div>
        </div>
      )}
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
  onArchiveConversation,
  onUnarchiveConversation,
  onDeleteConversation,
  onSetConversationGroup,
  onBulkArchive,
  onBulkDelete,
  isMobileOpen = false,
  onMobileClose,
  isSettingsOpen: isSettingsOpenProp,
  onToggleSettings: onToggleSettingsProp,
  onOpenProviderSettings,
  providerSettingsTriggerRef,
}: SidebarProps) {
  // ── Sidebar resize ─────────────────────────────────────────────────────────
  // Width is initialized from Gate-persisted preference (default 280px).
  // Dynamic pixel values cannot be expressed as Tailwind JIT classes, so the
  // width is applied as an inline style on the <aside> element only.
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => getSidebarWidth());
  // isDragging drives the transition-none guard: no animated width during drag.
  const [isDragging, setIsDragging] = useState(false);

  // currentWidthRef mirrors sidebarWidth but is accessible inside event handlers
  // without stale closure issues — updated synchronously on every width change.
  // This allows handleMouseUp to persist the final width without re-registering
  // listeners on every pixel change during drag.
  const currentWidthRef = useRef<number>(sidebarWidth);
  currentWidthRef.current = sidebarWidth;

  // Ref holds drag origin data so mousemove can compute deltas without closure capture.
  const dragOriginRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Detect prefers-reduced-motion at mount. We check once; the value is stable
  // for the life of the component.
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  // Detect mobile (< 768px) at mount for the inline width style guard below.
  // The inline style must not apply on mobile because it overrides the Tailwind
  // w-72 class (inline styles have higher specificity than Tailwind utility classes).
  // Checked once — React re-renders on resize are not needed here because the
  // CSS `md:` breakpoint classes handle the visual switch automatically.
  const isMobileViewport = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px)').matches
      : false,
  );

  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragOriginRef.current = { startX: e.clientX, startWidth: currentWidthRef.current };
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e: MouseEvent) {
      if (!dragOriginRef.current) return;
      const delta = e.clientX - dragOriginRef.current.startX;
      const next = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, dragOriginRef.current.startWidth + delta),
      );
      setSidebarWidth(next);
    }

    function handleMouseUp() {
      // Persist only on mouseup — avoid localStorage thrash on every mousemove.
      // currentWidthRef.current holds the latest width without stale closure.
      saveSidebarWidth(currentWidthRef.current);
      dragOriginRef.current = null;
      setIsDragging(false);
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    // Effect only needs to run when isDragging toggles — width changes during
    // drag do not re-register listeners thanks to currentWidthRef.
  }, [isDragging]);

  // Keyboard nudge: left/right arrow keys move by 8px when the handle is focused.
  const handleDragKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSidebarWidth((w) => {
          const next = Math.min(SIDEBAR_WIDTH_MAX, w + 8);
          saveSidebarWidth(next);
          return next;
        });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSidebarWidth((w) => {
          const next = Math.max(SIDEBAR_WIDTH_MIN, w - 8);
          saveSidebarWidth(next);
          return next;
        });
      }
    },
    [],
  );

  // Internal settings open state — used when no external control is provided.
  const [isSettingsOpenInternal, setIsSettingsOpenInternal] = useState(false);
  // If external props are provided, use them; otherwise fall back to internal state.
  const isSettingsOpen = isSettingsOpenProp !== undefined ? isSettingsOpenProp : isSettingsOpenInternal;

  // Snapshot of stored accent colors — used to decide whether to render the
  // "Reset all model colors" affordance. Refreshed when settings open/close.
  const [hasAccentOverrides, setHasAccentOverrides] = useState(false);
  // Active theme ID — initialized from Gate's stored preference.
  const [activeThemeId, setActiveThemeId] = useState<ThemeId>(
    () => getThemePreference().activeThemeId,
  );

  // Track which named groups are collapsed. All groups start open.
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  // Archive filter: show active or archived conversations.
  const [archiveFilter, setArchiveFilter] = useState<ArchiveFilter>('active');
  // Bulk selection: set of selected conversation IDs.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleToggleSettingsInternal = useCallback(() => {
    setIsSettingsOpenInternal((prev) => {
      const next = !prev;
      // Refresh the accent override check whenever settings open.
      if (next) {
        setHasAccentOverrides(Object.keys(getModelAccentColors()).length > 0);
      }
      return next;
    });
  }, []);

  // Refresh accent override snapshot when the settings panel opens externally.
  // When external control is active and the panel transitions to open, we must
  // still update hasAccentOverrides — do so in an effect keyed on isSettingsOpen.
  const prevIsSettingsOpenRef = useRef(isSettingsOpen);
  useEffect(() => {
    if (isSettingsOpen && !prevIsSettingsOpenRef.current) {
      setHasAccentOverrides(Object.keys(getModelAccentColors()).length > 0);
    }
    prevIsSettingsOpenRef.current = isSettingsOpen;
  }, [isSettingsOpen]);

  // The toggle handler used by the bottom settings toggle button.
  // When external control is provided, delegates to it; otherwise uses internal.
  const handleToggleSettings = onToggleSettingsProp ?? handleToggleSettingsInternal;

  const handleResetAllAccentColors = useCallback(() => {
    clearAllModelAccentColors();
    applyUserAccentColors({});
    setHasAccentOverrides(false);
  }, []);

  const handleThemeChange = useCallback((themeId: ThemeId) => {
    // Persist via Gate, then apply the token set and re-run the accent
    // override pass. The applyUserAccentColors call is non-negotiable —
    // applyTheme resets all accent CSS vars to theme defaults, so user
    // overrides must be reapplied immediately after.
    setActiveTheme(themeId);
    applyTheme(THEME_MAP[themeId]);
    applyUserAccentColors(getModelAccentColors());
    setActiveThemeId(themeId);
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

  // Filter conversations by archive status, then memoize grouping.
  const filteredConversations = useMemo(
    () =>
      conversations.filter((c) =>
        archiveFilter === 'active' ? c.archivedAt === undefined : c.archivedAt !== undefined,
      ),
    [conversations, archiveFilter],
  );

  // Memoize grouping — recalculates only when the filtered conversations change.
  const { named: namedGroups, ungrouped } = useMemo(
    () => groupConversations(filteredConversations),
    [filteredConversations],
  );

  const hasAnyGroups = namedGroups.size > 0;

  // Collect all existing group names for suggestions in the group input.
  const existingGroups = useMemo(() => {
    const groups = new Set<string>();
    for (const conv of conversations) {
      if (conv.groupId) groups.add(conv.groupId);
    }
    return [...groups].sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  // ── Bulk selection helpers ─────────────────────────────────────────────────

  const handleToggleChecked = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredConversations.map((c) => c.id)));
  }, [filteredConversations]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Clear selection when the filter tab changes to avoid stale selections.
  const handleArchiveFilterChange = useCallback((value: ArchiveFilter) => {
    setArchiveFilter(value);
    setSelectedIds(new Set());
  }, []);

  const handleBulkArchive = useCallback(() => {
    if (onBulkArchive) onBulkArchive([...selectedIds]);
    setSelectedIds(new Set());
  }, [onBulkArchive, selectedIds]);

  const handleBulkDelete = useCallback(() => {
    if (onBulkDelete) onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
  }, [onBulkDelete, selectedIds]);

  // Per-row mutation handlers — stable references via useCallback not needed here
  // since they're constructed inline; memoized per-conversation would require useMemo
  // over an array which is heavier. These are passed directly into ThreadRow.

  const hasBulkSelection = selectedIds.size > 0;

  // On mobile, close the drawer when a conversation is selected so the chat
  // area becomes visible. On desktop onMobileClose is undefined — no-op.
  const handleSelectConversation = useCallback(
    (id: string) => {
      onSelectConversation(id);
      onMobileClose?.();
    },
    [onSelectConversation, onMobileClose],
  );

  // Derive required credential keys for the active conversation's active models.
  const activeConv = conversations.find((c) => c.id === activeConversationId);
  const requiredKeys = getRequiredCredentialKeys(activeConv?.models ?? []);

  // Transition class: suppress width transitions during drag and for users who
  // prefer reduced motion. Restore a subtle transition after drag ends.
  const transitionClass =
    isDragging || prefersReducedMotion.current ? 'transition-none' : 'transition-[width] duration-75';

  return (
    <aside
      className={[
        // Mobile: fixed drawer, slides in/out via translate
        'fixed inset-y-0 left-0 z-50 h-full w-72',
        isMobileOpen ? 'translate-x-0' : '-translate-x-full',
        prefersReducedMotion.current ? '' : 'transition-transform duration-200 ease-in-out',
        // Desktop: static, restores inline-style width, overrides fixed positioning
        'md:static md:translate-x-0 md:z-auto md:h-full md:flex-shrink-0',
        // Common layout classes — relative scoped to desktop only so it doesn't
        // override the mobile `fixed` class (Tailwind orders relative after fixed)
        'flex flex-col bg-sidebar border-r border-border overflow-hidden md:relative',
        // Width transition for desktop drag-resize (suppressed during drag or reduced-motion)
        transitionClass,
      ].join(' ')}
      // On mobile the Tailwind w-72 class controls width (288px fixed drawer).
      // On desktop the drag-resize inline style applies. Inline styles have higher
      // specificity than Tailwind classes, so we guard against mobile override here.
      style={isMobileViewport.current ? undefined : { width: sidebarWidth }}
    >
      {/* Drag handle — right edge of sidebar, desktop only */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={sidebarWidth}
        aria-valuemin={SIDEBAR_WIDTH_MIN}
        aria-valuemax={SIDEBAR_WIDTH_MAX}
        tabIndex={0}
        onMouseDown={handleDragMouseDown}
        onKeyDown={handleDragKeyDown}
        className={[
          'absolute right-0 top-0 h-full w-1 z-30',
          'cursor-col-resize',
          'hover:bg-border-strong focus-visible:bg-border-strong',
          'focus-visible:outline-none',
          // Hide drag handle on mobile — fixed-width drawer, no resize affordance
          'hidden md:block',
          isDragging ? 'bg-border-strong' : 'bg-transparent',
        ].join(' ')}
      />

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <RoundtableLogo />
        {/* Close button — mobile drawer only (desktop uses backdrop or hamburger toggle) */}
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close navigation"
          className={[
            'md:hidden w-8 h-8 rounded-md flex items-center justify-center',
            'text-text-secondary hover:bg-hover',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        {/* Desktop header right-side controls: new conversation + provider-settings gear */}
        <div className="hidden md:flex items-center gap-1">
          {/* New conversation button — desktop only (mobile top bar has its own) */}
          <button
            type="button"
            onClick={onNewConversation}
            aria-label="New conversation"
            className={[
              'w-8 h-8 rounded-md flex items-center justify-center',
              'text-text-secondary hover:bg-hover',
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
          {/* Provider settings gear — opens ProviderSettingsPanel slide-in (#99).
              Only rendered when AppLayout provides the onOpenProviderSettings prop. */}
          {onOpenProviderSettings && (
            <button
              ref={providerSettingsTriggerRef}
              type="button"
              aria-label="Provider settings"
              onClick={onOpenProviderSettings}
              className={[
                'w-8 h-8 rounded-md flex items-center justify-center',
                'text-text-muted hover:text-text-secondary hover:bg-hover',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
              ].join(' ')}
            >
              {/* 20×20 gear icon */}
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path
                  d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="M17 10c0-.43-.04-.85-.11-1.25l1.98-1.54-1.88-3.24-2.36.95a7 7 0 0 0-2.16-1.25L12.12 2H7.88L7.53 3.67a7 7 0 0 0-2.16 1.25L3.01 3.97 1.13 7.21l1.98 1.54C3.04 9.15 3 9.57 3 10c0 .43.04.85.11 1.25L1.13 12.79l1.88 3.24 2.36-.95a7 7 0 0 0 2.16 1.25L7.88 18h4.24l.35-1.67a7 7 0 0 0 2.16-1.25l2.36.95 1.88-3.24-1.98-1.54C16.96 10.85 17 10.43 17 10Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* Archive filter toggle — below header, above thread list */}
      <div className="flex-shrink-0">
        <ArchiveToggle value={archiveFilter} onChange={handleArchiveFilterChange} />
      </div>

      {/* Bulk action bar — shown when 1+ conversations are selected */}
      {hasBulkSelection && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalCount={filteredConversations.length}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onBulkArchive={handleBulkArchive}
          onBulkDelete={handleBulkDelete}
        />
      )}

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
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[13px] text-text-muted text-center px-4">
              {archiveFilter === 'archived'
                ? 'No archived conversations'
                : 'Start a conversation'}
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
                            isChecked={selectedIds.has(conv.id)}
                            existingGroups={existingGroups}
                            onClick={() => handleSelectConversation(conv.id)}
                            onToggleChecked={() => handleToggleChecked(conv.id)}
                            onArchive={() => onArchiveConversation?.(conv.id)}
                            onUnarchive={() => onUnarchiveConversation?.(conv.id)}
                            onDelete={() => onDeleteConversation?.(conv.id)}
                            onSetGroup={(gid) => onSetConversationGroup?.(conv.id, gid)}
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
                  isChecked={selectedIds.has(conv.id)}
                  existingGroups={existingGroups}
                  onClick={() => handleSelectConversation(conv.id)}
                  onToggleChecked={() => handleToggleChecked(conv.id)}
                  onArchive={() => onArchiveConversation?.(conv.id)}
                  onUnarchive={() => onUnarchiveConversation?.(conv.id)}
                  onDelete={() => onDeleteConversation?.(conv.id)}
                  onSetGroup={(gid) => onSetConversationGroup?.(conv.id, gid)}
                />
              </li>
            ))}
          </ul>
        ) : (
          // ── Flat view (no groups present) ───────────────────────────────
          <ul className="py-1">
            {filteredConversations.map((conv) => (
              <li key={conv.id} className="thread-entering">
                <ThreadRow
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  isChecked={selectedIds.has(conv.id)}
                  existingGroups={existingGroups}
                  onClick={() => handleSelectConversation(conv.id)}
                  onToggleChecked={() => handleToggleChecked(conv.id)}
                  onArchive={() => onArchiveConversation?.(conv.id)}
                  onUnarchive={() => onUnarchiveConversation?.(conv.id)}
                  onDelete={() => onDeleteConversation?.(conv.id)}
                  onSetGroup={(gid) => onSetConversationGroup?.(conv.id, gid)}
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
          className="flex-shrink-0 px-4 py-2 text-[11px] text-error border-t border-border"
        >
          Storage error: {storageError.message}
        </div>
      )}

      {/* Settings panel — collapsible, pinned to the bottom of the sidebar.
          Houses ApiKeyPanel (Gate) and TokenCountControl (Gate).
          Both components are self-contained and manage their own state. */}
      <div className="flex-shrink-0 border-t border-border">
        {/* Settings toggle row.
            data-testid distinguishes this from the mobile header settings button;
            both legitimately share aria-controls="sidebar-settings-panel" (same panel). */}
        <button
          type="button"
          aria-expanded={isSettingsOpen}
          aria-controls="sidebar-settings-panel"
          data-testid="sidebar-settings-toggle"
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
            <ApiKeyPanel requiredKeys={requiredKeys} />

            {/* Token count visibility preference — Gate component, self-contained */}
            <TokenCountControl />

            {/* Theme switcher — 7 themes rendered as a grid of labeled buttons */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
                Theme
              </p>
              <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Theme">
                {THEME_IDS.map((themeId) => {
                  const isActive = themeId === activeThemeId;
                  // Capitalize first letter for display
                  const label = themeId.charAt(0).toUpperCase() + themeId.slice(1);
                  return (
                    <button
                      key={themeId}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => handleThemeChange(themeId)}
                      className={[
                        'flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px]',
                        'border transition-colors duration-fast',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                        isActive
                          ? 'bg-hover border-border-strong text-text-primary font-medium'
                          : 'border-transparent text-text-secondary hover:bg-hover/60 hover:text-text-primary',
                      ].join(' ')}
                    >
                      {/* Mode swatch dot: filled for dark themes, ring for light */}
                      <span
                        className={[
                          'w-2 h-2 rounded-full flex-shrink-0 border',
                          THEME_MAP[themeId].mode === 'dark'
                            ? 'bg-text-primary border-transparent'
                            : 'bg-transparent border-text-muted',
                        ].join(' ')}
                        aria-hidden="true"
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reset all model accent colors — shown only when at least one override is stored */}
            {hasAccentOverrides && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleResetAllAccentColors}
                  className={[
                    'text-[13px] text-text-secondary',
                    'hover:text-text-primary hover:underline',
                    'transition-colors duration-fast',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
                  ].join(' ')}
                >
                  Reset all model colors to theme defaults
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
