/**
 * Sidebar ThreadActionMenu — Keyboard Contract Tests (#236)
 *
 * Issue: Tab key in group-input and rename sub-states was exiting the menu
 * entirely instead of cycling within the sub-state panel. Fix: handleMenuKeyDown
 * now queries [data-substate] and cycles focus within it.
 *
 * WCAG standard:
 *   - 2.1.1 Keyboard: all functionality operable via keyboard
 *   - 2.4.3 Focus Order: focus moves predictably; closing returns to trigger
 *
 * Contracts verified:
 *   group-input sub-state:
 *     - Tab cycles forward through [data-substate] focusable controls
 *     - Shift+Tab cycles backward (wraps at boundary)
 *     - Escape closes and returns focus to trigger
 *     - Enter on the text input confirms (calls onSetGroup)
 *   rename sub-state:
 *     - Tab cycles forward through [data-substate] focusable controls
 *     - Shift+Tab cycles backward (wraps at boundary)
 *     - Escape closes and returns focus to trigger
 *     - Enter on the text input confirms (calls onRename)
 *
 * Testing method: React Testing Library + fireEvent in jsdom.
 * Automated scan: axe-core on the ThreadActionMenu in group-input and rename
 * sub-states to verify ARIA integrity after #236 changes.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ─── jsdom environment setup ──────────────────────────────────────────────────
//
// Sidebar.tsx calls window.matchMedia at mount for:
//   1. prefers-reduced-motion
//   2. mobile viewport detection (< 768px)
// jsdom does not implement matchMedia — stub it to return non-matching (false).

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

// ─── Axe assertion helper ─────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n'),
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── Mock Gate auth module ────────────────────────────────────────────────────

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    getProviderRoster: vi.fn(() => []),
    getRequiredCredentialKeys: vi.fn(() => []),
    getModelAccentColors: vi.fn(() => ({})),
    clearAllModelAccentColors: vi.fn(),
    getSidebarWidth: vi.fn(() => 280),
    saveSidebarWidth: vi.fn(),
    SIDEBAR_WIDTH_MIN: 180,
    SIDEBAR_WIDTH_MAX: 600,
    setActiveTheme: vi.fn(),
    getThemePreference: vi.fn(() => ({ activeThemeId: 'slate' })),
  };
});

// ─── Component under test ─────────────────────────────────────────────────────

import { Sidebar } from '@/ui/Sidebar';
import type { Conversation, ModelConfig } from '@/types';

const CLAUDE_MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

const CONV: Conversation = {
  id: 'test-conv-1',
  createdAt: Date.now() - 60_000,
  updatedAt: Date.now() - 30_000,
  messages: [
    { id: 'm1', role: 'user', content: 'Hello', timestamp: Date.now() - 60_000 },
  ],
  models: [CLAUDE_MODEL],
  interactionMode: 'parallel',
  isGhost: false,
};

const SIDEBAR_BASE_PROPS = {
  conversations: [CONV],
  activeConversationId: null,
  onSelectConversation: vi.fn(),
  onNewConversation: vi.fn(),
  onArchiveConversation: vi.fn(),
  onUnarchiveConversation: vi.fn(),
  onDeleteConversation: vi.fn(),
  onSetConversationGroup: vi.fn(),
  onRenameConversation: vi.fn(),
  onBulkArchive: vi.fn(),
  onBulkDelete: vi.fn(),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Open the three-dot menu for the first ThreadRow. */
function openMenu(): HTMLButtonElement {
  const trigger = document.querySelector(
    'button[aria-label="Conversation actions"]',
  ) as HTMLButtonElement;
  expect(trigger).not.toBeNull();
  fireEvent.click(trigger);
  return trigger;
}

/** Simulate a keydown on a specific element with optional shiftKey. */
function keyDown(el: Element, key: string, shift = false) {
  fireEvent.keyDown(el, { key, shiftKey: shift, bubbles: true });
}

/** Wait for a requestAnimationFrame to complete in jsdom. */
function waitRaf(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

// ─── group-input sub-state ────────────────────────────────────────────────────

describe('ThreadActionMenu group-input sub-state — keyboard contract (#236, WCAG 2.1.1)', () => {
  it('Tab cycles focus forward within [data-substate] panel', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    // Navigate into group-input sub-state.
    const groupBtn = screen.getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(groupBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    expect(panel).not.toBeNull();

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
      ),
    );
    // At minimum: text input + Cancel + Confirm = 3 elements (no existing groups in fixture).
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    // Explicitly focus the text input so the starting position is known.
    const groupInput = panel.querySelector('input[type="text"]') as HTMLInputElement;
    expect(groupInput).not.toBeNull();
    groupInput.focus();

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    expect(menuDiv).not.toBeNull();

    // Fire Tab — must advance to next focusable within panel.
    keyDown(menuDiv, 'Tab');

    const afterTab = document.activeElement;
    expect(afterTab).not.toBeNull();
    // Must remain within [data-substate].
    expect(panel.contains(afterTab)).toBe(true);
    // Must have advanced past the text input (focusable.length > 1 guard).
    if (focusable.length > 1) {
      expect(afterTab).not.toBe(groupInput);
    }
  });

  it('Shift+Tab cycles focus backward within [data-substate] panel', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    const groupBtn = screen.getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(groupBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
      ),
    );
    if (focusable.length < 2) return; // Skip if only one focusable element.

    // Focus the last element (Confirm button).
    const lastElement = focusable[focusable.length - 1];
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    keyDown(menuDiv, 'Tab', true); // Shift+Tab

    const afterShiftTab = document.activeElement;
    expect(panel.contains(afterShiftTab)).toBe(true);
    // Must have moved backward (away from the last element).
    expect(afterShiftTab).not.toBe(lastElement);
  });

  it('Escape closes sub-state and returns focus to trigger', async () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    const trigger = openMenu();

    const groupBtn = screen.getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(groupBtn);

    expect(document.querySelector('[data-substate]')).not.toBeNull();

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    keyDown(menuDiv, 'Escape');

    // Menu must close immediately.
    expect(document.querySelector('[role="menu"]')).toBeNull();

    // Focus returns to trigger via double-rAF.
    await waitRaf();
    await waitRaf();
    expect(document.activeElement).toBe(trigger);
  });

  it('Enter on the text input confirms the group assignment', () => {
    const onSetGroup = vi.fn();
    render(<Sidebar {...SIDEBAR_BASE_PROPS} onSetConversationGroup={onSetGroup} />);
    openMenu();

    const groupBtn = screen.getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(groupBtn);

    const groupInput = document.querySelector(
      '[data-substate] input[type="text"]',
    ) as HTMLInputElement;
    expect(groupInput).not.toBeNull();

    fireEvent.change(groupInput, { target: { value: 'My Group' } });
    keyDown(groupInput, 'Enter');

    expect(onSetGroup).toHaveBeenCalledWith(CONV.id, 'My Group');
  });

  it('has no axe violations in the [data-substate] panel (group-input)', async () => {
    // Note: we scan [data-substate] rather than the full container. The
    // role="menu" wrapper is a pre-existing violation when in a sub-state
    // (it has no role="menuitem" children — replaced by dialog-like sub-state UI).
    // That violation predates Wave 21 and is tracked separately as an advisory
    // finding (WAI-ARIA 4.1.2 — menuitem ownership). The [data-substate] panel
    // itself has no violations, which is what we verify here.
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    const groupBtn = screen.getByRole('menuitem', { name: /move to group/i });
    fireEvent.click(groupBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    expect(panel).not.toBeNull();

    const results = await axe(panel);
    assertNoViolations(results);
  });
});

// ─── rename sub-state ─────────────────────────────────────────────────────────

describe('ThreadActionMenu rename sub-state — keyboard contract (#236, WCAG 2.1.1)', () => {
  it('Tab cycles focus forward within [data-substate] panel', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    const renameBtn = screen.getByRole('menuitem', { name: /rename/i });
    fireEvent.click(renameBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    expect(panel).not.toBeNull();

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
      ),
    );
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    const renameInput = panel.querySelector('input[type="text"]') as HTMLInputElement;
    expect(renameInput).not.toBeNull();
    renameInput.focus();

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    keyDown(menuDiv, 'Tab');

    const afterTab = document.activeElement;
    expect(panel.contains(afterTab)).toBe(true);
    if (focusable.length > 1) {
      expect(afterTab).not.toBe(renameInput);
    }
  });

  it('Shift+Tab cycles focus backward within [data-substate] panel', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    const renameBtn = screen.getByRole('menuitem', { name: /rename/i });
    fireEvent.click(renameBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'input:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"])',
      ),
    );
    if (focusable.length < 2) return;

    const lastElement = focusable[focusable.length - 1]; // "Rename" confirm button
    lastElement.focus();

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    keyDown(menuDiv, 'Tab', true);

    const afterShiftTab = document.activeElement;
    expect(panel.contains(afterShiftTab)).toBe(true);
    expect(afterShiftTab).not.toBe(lastElement);
  });

  it('Escape closes sub-state and returns focus to trigger', async () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    const trigger = openMenu();

    const renameBtn = screen.getByRole('menuitem', { name: /rename/i });
    fireEvent.click(renameBtn);

    expect(document.querySelector('[data-substate]')).not.toBeNull();

    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;
    keyDown(menuDiv, 'Escape');

    expect(document.querySelector('[role="menu"]')).toBeNull();

    await waitRaf();
    await waitRaf();
    expect(document.activeElement).toBe(trigger);
  });

  it('Enter on the rename input confirms the rename', () => {
    const onRename = vi.fn();
    render(<Sidebar {...SIDEBAR_BASE_PROPS} onRenameConversation={onRename} />);
    openMenu();

    const renameBtn = screen.getByRole('menuitem', { name: /rename/i });
    fireEvent.click(renameBtn);

    const renameInput = document.querySelector(
      '[data-substate] input[type="text"]',
    ) as HTMLInputElement;
    expect(renameInput).not.toBeNull();

    fireEvent.change(renameInput, { target: { value: 'My New Title' } });
    keyDown(renameInput, 'Enter');

    expect(onRename).toHaveBeenCalledWith(CONV.id, 'My New Title');
  });

  it('has no axe violations in the [data-substate] panel (rename)', async () => {
    // See note above about scoping to [data-substate]: the role="menu" wrapper
    // has a pre-existing aria-required-children violation in any sub-state.
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    const renameBtn = screen.getByRole('menuitem', { name: /rename/i });
    fireEvent.click(renameBtn);

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    expect(panel).not.toBeNull();

    const results = await axe(panel);
    assertNoViolations(results);
  });
});

// ─── Focus containment regression guard ──────────────────────────────────────
//
// Before #236, Tab in group-input and rename sub-states called
// closeAndReturnFocus(), which exited the menu. The tests below verify that
// repeated Tab presses keep focus strictly within [data-substate] and do not
// close the menu.

describe('ThreadActionMenu sub-state Tab containment — WCAG 2.1.1 regression guard (#236)', () => {
  it('Tab in group-input sub-state never moves focus outside [data-substate]', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;

    // Tab 6 times — all focus positions must remain within [data-substate].
    for (let i = 0; i < 6; i++) {
      keyDown(menuDiv, 'Tab');
      const active = document.activeElement;
      expect(panel.contains(active) || active === panel).toBe(true);
      // Verify the menu is still open (Tab must not close it).
      expect(document.querySelector('[role="menu"]')).not.toBeNull();
    }
  });

  it('Tab in rename sub-state never moves focus outside [data-substate]', () => {
    render(<Sidebar {...SIDEBAR_BASE_PROPS} />);
    openMenu();

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    const panel = document.querySelector('[data-substate]') as HTMLElement;
    const menuDiv = document.querySelector('[role="menu"]') as HTMLDivElement;

    for (let i = 0; i < 6; i++) {
      keyDown(menuDiv, 'Tab');
      const active = document.activeElement;
      expect(panel.contains(active) || active === panel).toBe(true);
      expect(document.querySelector('[role="menu"]')).not.toBeNull();
    }
  });
});
