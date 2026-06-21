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
import { groupConversations } from './groupConversations';
// #136: sidebarUtils extracted pure functions — filterByArchiveStatus, deriveExistingGroups,
// and the ArchiveFilter type live in sidebarUtils.ts so they can be unit-tested
// without a DOM environment or React testing setup.
import { filterByArchiveStatus, deriveExistingGroups, type ArchiveFilter } from './sidebarUtils';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
// Extracted from inline implementations in Sidebar, ModelSelectorPanel, and
// ProviderSettingsPanel into utils/modelColor.ts — single source of truth.
import { getModelDotStyle } from './utils/modelColor';
// applyUserAccentColors: re-runs the CSS override pass after clearing all stored colors.
// Called with {} so every model reverts to its theme default (no overrides applied).
// applyTheme: applies the selected theme's token set to :root CSS custom properties.
// THEME_MAP / THEME_IDS: shared static lookup constants (Vite requires static imports
// for JSON — these live in theme.ts so both main.tsx and Sidebar share the same map).
import { applyUserAccentColors, applyTheme, THEME_MAP, THEME_IDS } from './theme';
import type { ThemeId } from '@/types';
import { RoundtableLogo } from './RoundtableLogo';
// #150: shared ChevronIcon replaces the down-chevron SVG in the settings toggle.
import { ChevronIcon } from './components/ChevronIcon';
// #146: ThreadActionMenu extracted to its own file for focus and testability.
// getThreadTitle is re-exported from ThreadActionMenu so ThreadRow can use it.
import { ThreadActionMenu, getThreadTitle } from './components/ThreadActionMenu';
// #147: shared icon system — PlusIcon, CloseIcon, GhostIcon, EllipsisVerticalIcon,
// GearIcon, and RightChevronIcon replace inline SVGs throughout this file.
import {
  PlusIcon,
  CloseIcon,
  GhostIcon,
  EllipsisVerticalIcon,
  GearIcon,
  RightChevronIcon,
} from './icons';

// #166: Platform detection for keyboard shortcut hint in button aria-labels.
// Module-level constant — navigator may be undefined in SSR/test environments.
const isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

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
  /** Rename a conversation. Empty string reverts to the auto-derived title. */
  onRenameConversation?: (id: string, newTitle: string) => void;
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
  /**
   * True when the active conversation is in ghost mode (not persisted).
   * Drives the visual state of the ghost mode toggle button.
   */
  isGhostMode?: boolean;
  /**
   * Called when the user clicks the ghost mode toggle button.
   * App handles the toggle logic via useGhostMode.
   */
  onToggleGhostMode?: () => void;
}

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

// getThreadTitle and ThreadActionMenu are imported from ./components/ThreadActionMenu (#146).
// They are re-exported from that file so they can be used by ThreadRow (below).


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
  onRename: (newTitle: string) => void;
}

// AnimatedListItem — applies thread-entering CSS animation on mount, then removes
// the class once the animation completes. This prevents the <li> from retaining
// an active `animation` property that creates a GPU compositing layer, which would
// make it the containing block for `position: fixed` descendants (like the context
// menu backdrop) and restrict the backdrop to only the 64px row height instead of
// the full sidebar/viewport. See issue #125.
function AnimatedListItem({ children }: { children: React.ReactNode }) {
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
      {/* Right-chevron rotates to indicate open/closed state — shared icon (#147) */}
      <RightChevronIcon isOpen={isOpen} />
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

// ArchiveFilter type is imported from ./sidebarUtils (#136).

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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
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

  // Refs for focus management (WCAG 2.4.3 — focus order on state transition).
  // confirmCancelRef: the "Cancel" button in the confirm-delete state — receives
  // focus when the confirm UI opens so keyboard users land on the safe default
  // action (Cancel) rather than the destructive Delete button.
  // deleteSelectedRef: the "Delete selected" trigger — receives focus when the
  // confirm state is dismissed (cancel or confirmed) to restore focus position.
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const deleteSelectedRef = useRef<HTMLButtonElement>(null);

  // Move focus to the Cancel button when entering confirm-delete state (WCAG 2.4.3).
  // Cancel is the safe default for a destructive action — initial focus must not
  // land on the Delete button.
  useEffect(() => {
    if (barState === 'confirm-delete') {
      confirmCancelRef.current?.focus();
    }
  }, [barState]);

  const handleCancelConfirm = useCallback(() => {
    setBarState('idle');
    // Return focus to the "Delete selected" trigger on cancel (WCAG 2.4.3).
    // Deferred to next tick so the button is visible before focus is applied.
    setTimeout(() => deleteSelectedRef.current?.focus(), 0);
  }, []);

  const handleBulkDeleteConfirm = useCallback(() => {
    onBulkDelete();
    setBarState('idle');
    // Return focus to "Delete selected" trigger after confirmation.
    // The button re-renders when barState returns to idle; next tick ensures
    // the DOM has updated before focus is applied.
    setTimeout(() => deleteSelectedRef.current?.focus(), 0);
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
          className={[
            'text-[11px] text-text-muted hover:text-text-secondary transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
          ].join(' ')}
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Archive selected
          </button>
          <button
            ref={deleteSelectedRef}
            type="button"
            onClick={() => setBarState('confirm-delete')}
            className={[
              'flex-1 py-1 rounded text-[11px] text-center',
              'text-error bg-hover hover:bg-hover/80',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
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
              ref={confirmCancelRef}
              type="button"
              onClick={handleCancelConfirm}
              className={[
                'flex-1 py-1 rounded text-[11px] text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteConfirm}
              className={[
                'flex-1 py-1 rounded text-[11px] text-white bg-error-bg hover:opacity-90 transition-opacity duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
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
  onRenameConversation,
  onBulkArchive,
  onBulkDelete,
  isMobileOpen = false,
  onMobileClose,
  isSettingsOpen: isSettingsOpenProp,
  onToggleSettings: onToggleSettingsProp,
  onOpenProviderSettings,
  providerSettingsTriggerRef,
  isGhostMode = false,
  onToggleGhostMode,
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

  // Sync --sidebar-width CSS custom property on :root so sibling components
  // (e.g. ProviderSettingsPanel) can derive their width from the actual sidebar
  // width rather than a hardcoded pixel value. Runs on mount and on every resize.
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidth}px`);
  }, [sidebarWidth]);

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

  // New conversation button tooltip state (#166).
  const [isNewConvTooltipVisible, setIsNewConvTooltipVisible] = useState(false);
  const newConvTooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleNewConvMouseEnter = useCallback(() => {
    newConvTooltipTimerRef.current = setTimeout(() => setIsNewConvTooltipVisible(true), 600);
  }, []);
  const handleNewConvMouseLeave = useCallback(() => {
    if (newConvTooltipTimerRef.current) clearTimeout(newConvTooltipTimerRef.current);
    setIsNewConvTooltipVisible(false);
  }, []);
  const handleNewConvFocus = useCallback(() => {
    if (newConvTooltipTimerRef.current) clearTimeout(newConvTooltipTimerRef.current);
    setIsNewConvTooltipVisible(true);
  }, []);
  const handleNewConvBlur = useCallback(() => setIsNewConvTooltipVisible(false), []);

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

  // Filter conversations by archive status via sidebarUtils (#136).
  const filteredConversations = useMemo(
    () => filterByArchiveStatus(conversations, archiveFilter),
    [conversations, archiveFilter],
  );

  // Memoize grouping — recalculates only when the filtered conversations change.
  const { named: namedGroups, ungrouped } = useMemo(
    () => groupConversations(filteredConversations),
    [filteredConversations],
  );

  const hasAnyGroups = namedGroups.size > 0;

  // Collect all existing group names for suggestions — via sidebarUtils (#136).
  const existingGroups = useMemo(
    () => deriveExistingGroups(conversations),
    [conversations],
  );

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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          // Hide drag handle on mobile — fixed-width drawer, no resize affordance
          'hidden md:block',
          isDragging ? 'bg-border-strong' : 'bg-transparent',
        ].join(' ')}
      />

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b border-border flex-shrink-0">
        <RoundtableLogo />
        {/* Header right-side controls */}
        <div className="flex items-center gap-1">
          {/* Ghost mode toggle — visible on mobile and desktop. Activates/deactivates
              ghost mode so new conversations are stored in-memory only (not persisted).
              Only rendered when AppLayout provides the onToggleGhostMode prop. */}
          {onToggleGhostMode && (
            <button
              type="button"
              onClick={onToggleGhostMode}
              aria-label="Ghost mode"
              aria-pressed={isGhostMode}
              className={[
                'w-8 h-8 rounded-md flex items-center justify-center',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                isGhostMode
                  ? 'text-text-primary bg-hover'
                  : 'text-text-muted hover:text-text-secondary hover:bg-hover',
              ].join(' ')}
            >
              {/* Ghost icon — shared icon (#147) */}
              <GhostIcon filled={isGhostMode} />
            </button>
          )}
          {/* Desktop-only controls: new conversation + provider-settings gear */}
          <div className="hidden md:flex items-center gap-1">
            {/* New conversation button (#166: tooltip + keyboard shortcut hint) */}
            <div
              className="relative"
              onMouseEnter={handleNewConvMouseEnter}
              onMouseLeave={handleNewConvMouseLeave}
            >
              <button
                type="button"
                onClick={onNewConversation}
                aria-label={`New conversation (${isMac ? '⌘N' : 'Ctrl+N'})`}
                aria-describedby="sidebar-new-conv-tooltip"
                onFocus={handleNewConvFocus}
                onBlur={handleNewConvBlur}
                className={[
                  'w-8 h-8 rounded-md flex items-center justify-center',
                  'text-text-secondary hover:bg-hover',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
                ].join(' ')}
              >
                {/* Plus icon — shared icon (#147) */}
                <PlusIcon />
              </button>
              <div
                id="sidebar-new-conv-tooltip"
                role="tooltip"
                className={[
                  'absolute top-full right-0 mt-2',
                  'w-max',
                  'bg-sidebar border border-border rounded-sm shadow-md',
                  'px-3 py-2 text-[11px] leading-[1.4] text-text-primary whitespace-nowrap',
                  'pointer-events-none',
                  'transition-opacity duration-fast',
                  'z-20',
                  isNewConvTooltipVisible ? 'opacity-100' : 'opacity-0',
                ].join(' ')}
              >
                New conversation
                <span className="ml-1.5 font-mono text-text-muted">{isMac ? '⌘N' : 'Ctrl+N'}</span>
                <span
                  className="absolute bottom-full right-3 -mb-px block border-l-[5px] border-r-[5px] border-b-[5px] border-l-transparent border-r-transparent border-b-border"
                  aria-hidden="true"
                />
              </div>
            </div>
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
              {/* Gear icon — shared icon (#147) */}
              <GearIcon size={20} />
            </button>
          )}
          </div>
          {/* Close button — mobile drawer only */}
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
            {/* Close icon — shared icon (#147) */}
            <CloseIcon />
          </button>
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
                        <AnimatedListItem key={conv.id}>
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
                            onRename={(title) => onRenameConversation?.(conv.id, title)}
                          />
                        </AnimatedListItem>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}

            {/* Ungrouped conversations — no header, listed after all named groups */}
            {ungrouped.map((conv) => (
              <AnimatedListItem key={conv.id}>
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
                  onRename={(title) => onRenameConversation?.(conv.id, title)}
                />
              </AnimatedListItem>
            ))}
          </ul>
        ) : (
          // ── Flat view (no groups present) ───────────────────────────────
          <ul className="py-1">
            {filteredConversations.map((conv) => (
              <AnimatedListItem key={conv.id}>
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
                  onRename={(title) => onRenameConversation?.(conv.id, title)}
                />
              </AnimatedListItem>
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
          {/* Gear icon — shared icon (#147) */}
          <GearIcon size={14} className="flex-shrink-0" />
          <span className="text-[12px] font-medium flex-1">Settings</span>
          {/* Chevron — shared ChevronIcon (#150) */}
          <ChevronIcon isOpen={isSettingsOpen} />
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
