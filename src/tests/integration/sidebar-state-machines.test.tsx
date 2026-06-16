/**
 * Integration: ThreadActionMenu and BulkActionBar state machines — issue #139
 *
 * These tests implement the 7 behaviors that were previously skipped in
 * src/ui/Sidebar.management.test.ts under the false claim that
 * @testing-library/react was not in devDependencies.
 * Both packages are present: @testing-library/react ^16.3.2 and
 * @testing-library/user-event ^14.6.1.
 *
 * Components under test:
 *   ThreadActionMenu — internal to Sidebar.tsx; exercised via ThreadRow's
 *     three-dot "Conversation actions" trigger button.
 *   BulkActionBar — internal to Sidebar.tsx; rendered only when
 *     selectedIds.size > 0 (user checks at least one conversation row).
 *
 * Test strategy:
 *   Both components are unexported private functions inside Sidebar.tsx.
 *   We exercise them by rendering the public <Sidebar> component and
 *   interacting with it via DOM events — exactly what a user would do.
 *
 *   - fireEvent is used throughout (not userEvent) because userEvent v14 uses
 *     setTimeout internally and deadlocks against vi.useFakeTimers() if those
 *     are ever introduced. Per the HANDOFF.md gotcha, fireEvent + synchronous
 *     assertions is the established pattern here.
 *
 * jsdom stubs:
 *   window.matchMedia — Sidebar uses this at mount to detect prefers-reduced-motion
 *     and mobile viewport. jsdom does not implement it. We stub it once in
 *     beforeAll following the same pattern as sidebar-drag-handle.test.tsx.
 *   window.requestAnimationFrame — used by ThreadActionMenu.closeAndReturnFocus to
 *     defer focus restoration. Replaced with a synchronous stub so focus side-effects
 *     complete without scheduling.
 *
 * Note on @/auth mocking: the real Gate functions use localStorage (available in
 * jsdom) and have no module-level side effects, so they do not need mocking.
 * This matches the approach in sidebar-drag-handle.test.tsx (Ada, issue #62).
 *
 * Note on matchers: this project does NOT install @testing-library/jest-dom,
 * so we use Vitest-native assertions only. Pattern:
 *   "element present"   → screen.getBy...() — throws if absent (presence IS assertion)
 *   "element absent"    → expect(screen.queryBy...()).toBeNull()
 *   "text content"      → expect(el.textContent).toContain('...')
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Sidebar } from '@/ui/Sidebar';
import type { Conversation, ModelConfig } from '@/types/index';

// ─── jsdom environment setup ──────────────────────────────────────────────────

/**
 * Sidebar.tsx calls window.matchMedia at mount to detect:
 *   1. prefers-reduced-motion (Sidebar.tsx ~line 895)
 *   2. mobile viewport (Sidebar.tsx ~line 903)
 *
 * jsdom does not implement window.matchMedia. Stub it with a minimal
 * implementation that returns non-matching (false) for all queries.
 * Standard jsdom workaround — same approach as sidebar-drag-handle.test.tsx.
 */
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

let _nextId = 0;

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = `sm-conv-${++_nextId}`;
  return {
    id,
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    title: `Conversation ${id}`,
    ...overrides,
  };
}

/**
 * Minimal Sidebar props — renders with one conversation and no-op callbacks.
 * Tests may override individual props (e.g. onBulkDelete) as needed.
 */
function defaultProps(conversations: Conversation[], overrides: Record<string, unknown> = {}) {
  return {
    conversations,
    activeConversationId: null,
    onSelectConversation: vi.fn(),
    onNewConversation: vi.fn(),
    onArchiveConversation: vi.fn(),
    onUnarchiveConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onSetConversationGroup: vi.fn(),
    onBulkArchive: vi.fn(),
    onBulkDelete: vi.fn(),
    ...overrides,
  };
}

/**
 * Open the ThreadActionMenu for the first conversation row by clicking the
 * "Conversation actions" trigger button. Returns the menu element for queries.
 */
function openThreadMenu(): HTMLElement {
  const trigger = screen.getByRole('button', { name: /conversation actions/i });
  fireEvent.click(trigger);
  return screen.getByRole('menu', { name: /conversation actions/i });
}

// ─── Per-test setup/teardown ──────────────────────────────────────────────────

beforeEach(() => {
  _nextId = 0;
  // Stub requestAnimationFrame — used by ThreadActionMenu.closeAndReturnFocus to
  // schedule focus restoration after menu unmount. Without this stub the rAF
  // callback never fires in jsdom and focus restoration becomes a no-op.
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── ThreadActionMenu state transitions ───────────────────────────────────────

describe('ThreadActionMenu state transitions', () => {
  it('menu → confirm-delete on Delete click', () => {
    const conv = makeConversation();
    render(<Sidebar {...defaultProps([conv])} />);

    const menu = openThreadMenu();

    // Top-level menu: three menuitems — Archive (or Unarchive), Move to group, Delete
    const deleteBtn = within(menu).getByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteBtn);

    // After clicking Delete, the menu transitions to the confirm-delete sub-state.
    // The confirm-delete sub-state renders "Delete this conversation?" and two
    // action buttons (not menuitems): Cancel and Delete.
    expect(menu.textContent).toContain('Delete this conversation?');

    // Confirm-state buttons are present
    within(menu).getByRole('button', { name: /cancel/i });
    within(menu).getByRole('button', { name: /^delete$/i });

    // The top-level menuitems are gone (replaced by the sub-state)
    expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('menu → group-input on "Move to group" click', () => {
    const conv = makeConversation();
    render(<Sidebar {...defaultProps([conv])} />);

    const menu = openThreadMenu();

    const moveToGroupBtn = within(menu).getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(moveToGroupBtn);

    // After clicking "Move to group…", the menu transitions to the group-input sub-state.
    // A text input for the group name appears.
    within(menu).getByRole('textbox');

    // The group name prompt text is visible
    expect(menu.textContent).toContain('Group name');

    // Top-level menuitems are replaced by the input sub-state
    expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0);
  });

  it('cancel in confirm-delete closes the menu (calls onClose)', () => {
    // The confirm-delete Cancel button calls onClose (not setMenuState back to 'menu').
    // ThreadActionMenu has no internal "back to menu" from confirm-delete — Cancel
    // exits the entire menu. This matches the Sidebar code: onClick={onClose}.
    const conv = makeConversation();
    render(<Sidebar {...defaultProps([conv])} />);

    openThreadMenu();

    // Transition to confirm-delete
    const menu = screen.getByRole('menu', { name: /conversation actions/i });
    const deleteBtn = within(menu).getByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteBtn);
    expect(menu.textContent).toContain('Delete this conversation?');

    // Click Cancel in the confirm-delete sub-state
    const cancelBtn = within(menu).getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);

    // After Cancel, ThreadActionMenu is unmounted (onClose → menuOpen=false).
    // The trigger button returns to aria-expanded=false.
    const trigger = screen.getByRole('button', { name: /conversation actions/i });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    // The menu is gone from the DOM
    expect(screen.queryByRole('menu', { name: /conversation actions/i })).toBeNull();
  });

  it('outside click (backdrop mousedown) closes menu', () => {
    const conv = makeConversation();
    render(<Sidebar {...defaultProps([conv])} />);

    openThreadMenu();

    // ThreadActionMenu renders a full-viewport backdrop: a fixed div with
    // aria-hidden="true" that intercepts pointer events. Its onMouseDown calls
    // e.preventDefault() + e.stopPropagation() + onClose().
    const backdrop = document.querySelector(
      'div[aria-hidden="true"][class*="fixed"][class*="inset-0"]',
    ) as HTMLElement;
    expect(backdrop).toBeTruthy();

    fireEvent.mouseDown(backdrop);

    // After backdrop mousedown, onClose fires → menuOpen=false → menu unmounts
    expect(screen.queryByRole('menu', { name: /conversation actions/i })).toBeNull();
  });
});

// ─── BulkActionBar barState transitions ───────────────────────────────────────

describe('BulkActionBar barState transitions', () => {
  /**
   * Click the conversation row checkbox to enter bulk-selection mode.
   * The BulkActionBar appears when selectedIds.size > 0.
   *
   * Returns the BulkActionBar root element, found by walking up from the
   * "Archive selected" button to the nearest border-b container div.
   */
  function selectFirstConversation(convTitle: string): HTMLElement {
    const checkbox = screen.getByRole('checkbox', {
      name: new RegExp(`select conversation.*${convTitle}`, 'i'),
    });
    fireEvent.click(checkbox);

    // BulkActionBar is now rendered — locate via the Archive selected button
    const archiveBtn = screen.getByRole('button', { name: /archive selected/i });
    return archiveBtn.closest('div') as HTMLElement;
  }

  it('idle → confirm-delete on "Delete selected" click', () => {
    const conv = makeConversation({ title: 'Alpha' });
    render(<Sidebar {...defaultProps([conv])} />);

    const bar = selectFirstConversation('Alpha');

    // Idle state: Archive selected + Delete selected buttons are present
    within(bar).getByRole('button', { name: /archive selected/i });
    const deleteSelectedBtn = within(bar).getByRole('button', { name: /delete selected/i });

    fireEvent.click(deleteSelectedBtn);

    // barState transitions to confirm-delete.
    // Confirmation text appears (e.g. "Delete 1 conversation?")
    expect(bar.textContent).toMatch(/delete.*conversation/i);

    // Cancel + Delete confirm buttons appear
    within(bar).getByRole('button', { name: /cancel/i });
    // The confirm Delete button text does not include "selected"
    const allDeleteBtns = within(bar).getAllByRole('button', { name: /delete/i });
    const confirmBtn = allDeleteBtns.find((b) => !/selected/i.test(b.textContent ?? ''));
    expect(confirmBtn).toBeTruthy();

    // Archive selected and Delete selected action buttons are gone
    expect(within(bar).queryByRole('button', { name: /archive selected/i })).toBeNull();
    expect(within(bar).queryByRole('button', { name: /delete selected/i })).toBeNull();
  });

  it('confirm-delete → idle on Cancel click', () => {
    const conv = makeConversation({ title: 'Beta' });
    render(<Sidebar {...defaultProps([conv])} />);

    const bar = selectFirstConversation('Beta');

    // Transition to confirm-delete
    fireEvent.click(within(bar).getByRole('button', { name: /delete selected/i }));
    expect(bar.textContent).toMatch(/delete.*conversation/i);

    // Click Cancel — barState resets to idle
    fireEvent.click(within(bar).getByRole('button', { name: /cancel/i }));

    // Idle state is restored: Archive selected + Delete selected reappear
    within(bar).getByRole('button', { name: /archive selected/i });
    within(bar).getByRole('button', { name: /delete selected/i });

    // Confirm-delete text and Cancel are gone
    expect(within(bar).queryByRole('button', { name: /cancel/i })).toBeNull();
  });

  it('confirm-delete → idle after Delete confirmed (calls onBulkDelete)', () => {
    const conv = makeConversation({ title: 'Gamma' });
    const onBulkDelete = vi.fn();
    render(<Sidebar {...defaultProps([conv], { onBulkDelete })} />);

    const bar = selectFirstConversation('Gamma');

    // Transition to confirm-delete
    fireEvent.click(within(bar).getByRole('button', { name: /delete selected/i }));

    // Click the confirm Delete button (does not contain "selected")
    const allDeleteBtns = within(bar).getAllByRole('button', { name: /delete/i });
    const confirmDeleteBtn = allDeleteBtns.find((b) => !/selected/i.test(b.textContent ?? ''))!;
    fireEvent.click(confirmDeleteBtn);

    // onBulkDelete called with the selected conversation ID
    expect(onBulkDelete).toHaveBeenCalledOnce();
    expect(onBulkDelete).toHaveBeenCalledWith([conv.id]);

    // Sidebar clears selectedIds after delete → BulkActionBar unmounts
    // (hasBulkSelection becomes false — no conversations selected)
    expect(screen.queryByRole('button', { name: /archive selected/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /delete selected/i })).toBeNull();
  });
});
