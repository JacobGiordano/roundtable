/**
 * ThreadActionMenu — three-dot context menu for a conversation thread row.
 *
 * Extracted from Sidebar.tsx (#146) into its own file so the component can be
 * read and tested in isolation. All logic (state, keyboard handling, focus
 * management) is self-contained; the parent (ThreadRow) only provides callbacks
 * and a trigger ref.
 *
 * ARIA contract (#241): the container switches role based on state:
 *   - 'menu'           → role="menu"   (aria-required-children: menuitem)
 *   - sub-states       → role="dialog" aria-modal="true" (dialog children)
 * This prevents the aria-required-children violation that occurs when the menu
 * container holds dialog-like controls (inputs, plain buttons) in sub-states.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { Conversation } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derive a display title from conversation data. */
export function getThreadTitle(conversation: Conversation): string {
  if (conversation.title) return conversation.title;
  const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.replace(/\n/g, ' ').slice(0, 40);
  }
  return 'New conversation';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadMenuState =
  | { type: 'closed' }
  | { type: 'menu' }
  | { type: 'confirm-delete' }
  | { type: 'group-input' }
  | { type: 'rename' };

export interface ThreadActionMenuProps {
  conversation: Conversation;
  /** All distinct group names currently in use across conversations. */
  existingGroups: string[];
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onSetGroup: (groupId: string | undefined) => void;
  onRename: (newTitle: string) => void;
  onClose: () => void;
  /** Ref to the trigger button — focus is returned here on Escape or Tab close. */
  triggerRef: React.RefObject<HTMLButtonElement>;
}

// ─── ThreadActionMenu ─────────────────────────────────────────────────────────

export function ThreadActionMenu({
  conversation,
  existingGroups,
  onArchive,
  onUnarchive,
  onDelete,
  onSetGroup,
  onRename,
  onClose,
  triggerRef,
}: ThreadActionMenuProps) {
  const [menuState, setMenuState] = useState<ThreadMenuState>({ type: 'menu' });
  const [groupInput, setGroupInput] = useState(conversation.groupId ?? '');
  // renameInput: initialized to the current title (or derived title) so the
  // user sees the existing name pre-filled and can edit it in place.
  const [renameInput, setRenameInput] = useState(getThreadTitle(conversation));
  const menuRef = useRef<HTMLDivElement>(null);
  const groupInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
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

  // Focus rename input when it appears; select all so the user can overtype immediately.
  useEffect(() => {
    if (menuState.type === 'rename') {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [menuState.type]);

  /** Close the menu and return focus to the trigger button. */
  const closeAndReturnFocus = useCallback(() => {
    onClose();
    // Double-rAF: first frame lets React unmount the menu; second frame
    // guarantees the browser has fully painted before restoring focus,
    // preventing React from moving focus to <body> between the two steps.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
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

  const handleRenameConfirm = useCallback(() => {
    const trimmed = renameInput.trim();
    // Empty title: revert to original auto-title by passing the original title
    // (or empty string which updateConversation will treat as "derive from messages").
    // Non-empty: persist the user's chosen name.
    onRename(trimmed === '' ? (conversation.title ?? '') : trimmed);
    closeAndReturnFocus();
  }, [renameInput, conversation.title, onRename, closeAndReturnFocus]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleRenameConfirm();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeAndReturnFocus();
      }
    },
    [handleRenameConfirm, closeAndReturnFocus],
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
      // Tab (or Shift+Tab): in confirm-delete, group-input, and rename states,
      // cycle between the sub-state's interactive controls (dialog-like behaviour).
      // In the top-level 'menu' state, Tab exits the menu — menus must not be
      // Tab-navigable per the ARIA menu keyboard contract.
      if (e.key === 'Tab') {
        e.preventDefault();
        if (menuState.type === 'confirm-delete') {
          // Cycle between the two confirm buttons only.
          const buttons = Array.from(
            menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-confirm="true"]') ?? [],
          );
          const focused = document.activeElement as HTMLButtonElement;
          const idx = buttons.indexOf(focused);
          const next = e.shiftKey
            ? idx > 0 ? idx - 1 : buttons.length - 1
            : idx < buttons.length - 1 ? idx + 1 : 0;
          buttons[next]?.focus();
        } else if (menuState.type === 'group-input' || menuState.type === 'rename') {
          // Cycle through all focusable elements in the sub-state panel.
          const panel = menuRef.current?.querySelector<HTMLElement>('[data-substate]');
          const focusable = Array.from(
            panel?.querySelectorAll<HTMLElement>(
              'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
            ) ?? [],
          );
          if (focusable.length > 0) {
            const focused = document.activeElement as HTMLElement;
            const idx = focusable.indexOf(focused);
            const next = e.shiftKey
              ? idx > 0 ? idx - 1 : focusable.length - 1
              : idx < focusable.length - 1 ? idx + 1 : 0;
            focusable[next]?.focus();
          }
        } else {
          closeAndReturnFocus();
        }
        return;
      }

      // Escape always closes and returns focus.
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAndReturnFocus();
        return;
      }

      // Left/Right arrow cycles between buttons in confirm-delete state.
      if (menuState.type === 'confirm-delete' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        const buttons = Array.from(
          menuRef.current?.querySelectorAll<HTMLButtonElement>('[data-confirm="true"]') ?? [],
        );
        const focused = document.activeElement as HTMLButtonElement;
        const idx = buttons.indexOf(focused);
        const next = e.key === 'ArrowRight'
          ? idx < buttons.length - 1 ? idx + 1 : 0
          : idx > 0 ? idx - 1 : buttons.length - 1;
        buttons[next]?.focus();
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
      {/*
        Role switching (#241): when the top-level 'menu' state is active, the
        container uses role="menu" (aria-required-children = menuitem). When a
        sub-state is active the children are dialog-like controls — inputs and
        plain buttons that are NOT menuitems. Using role="menu" in that state
        violates the aria-required-children contract. Fix: switch to role="dialog"
        aria-modal="true" in sub-states so the ownership contract always holds.
      */}
      <div
        ref={menuRef}
        role={menuState.type === 'menu' ? 'menu' : 'dialog'}
        aria-modal={menuState.type !== 'menu' ? true : undefined}
        aria-label={
          menuState.type === 'menu' ? 'Conversation actions'
          : menuState.type === 'confirm-delete' ? 'Confirm delete'
          : menuState.type === 'group-input' ? 'Move to group'
          : 'Rename conversation'
        }
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
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => { setRenameInput(getThreadTitle(conversation)); setMenuState({ type: 'rename' }); }}
            className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
          >
            Rename
          </button>
          {isArchived ? (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onUnarchive(); closeAndReturnFocus(); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              Unarchive
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => { onArchive(); closeAndReturnFocus(); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              Archive
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setMenuState({ type: 'group-input' })}
            className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
          >
            Move to group&hellip;
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => setMenuState({ type: 'confirm-delete' })}
            className="w-full text-left px-3 py-1.5 text-error hover:bg-hover transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
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
              data-confirm="true"
              onClick={onClose}
              className={[
                'flex-1 px-2 py-1 rounded text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              data-confirm="true"
              onClick={() => { onDelete(); onClose(); }}
              className={[
                'flex-1 px-2 py-1 rounded text-white bg-error-bg hover:opacity-90 transition-opacity duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {menuState.type === 'group-input' && (
        <div data-substate className="px-3 py-2">
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
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
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
                    className={[
                      'w-full text-left px-2 py-1 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast text-[11px] rounded',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    ].join(' ')}
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
              onClick={closeAndReturnFocus}
              className={[
                'flex-1 px-2 py-1 rounded text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGroupConfirm}
              className={[
                'flex-1 px-2 py-1 rounded text-text-primary bg-interactive-active hover:opacity-90 transition-opacity duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {menuState.type === 'rename' && (
        <div data-substate className="px-3 py-2">
          <p className="text-text-muted mb-1.5 text-[11px]">Rename conversation</p>
          <input
            ref={renameInputRef}
            type="text"
            value={renameInput}
            onChange={(e) => setRenameInput(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            placeholder="Conversation title"
            aria-label="Conversation title"
            className={[
              'w-full px-2 py-1 rounded text-[12px]',
              'bg-input border border-border',
              'text-text-primary placeholder:text-text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
            ].join(' ')}
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={closeAndReturnFocus}
              className={[
                'flex-1 px-2 py-1 rounded text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleRenameConfirm}
              className={[
                'flex-1 px-2 py-1 rounded text-text-primary bg-interactive-active hover:opacity-90 transition-opacity duration-fast text-[11px]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Rename
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
