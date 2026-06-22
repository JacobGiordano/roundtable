/**
 * ThreadActionMenu — ARIA and keyboard accessibility tests (#241)
 *
 * Issues addressed:
 *   #241 — role="menu" aria-required-children fix (switch to role="dialog" in sub-states)
 *
 * WCAG criteria:
 *   4.1.2 Name, Role, Value — roles must be used correctly with required children
 *   2.1.1 Keyboard — all functionality operable via keyboard alone
 *   2.4.3 Focus Order — focus managed correctly on sub-state transitions
 *
 * Testing method: axe-core + React Testing Library in jsdom.
 *
 * ARIA contract:
 *   - Top-level menu state: container is role="menu" (owned children: menuitem)
 *   - Sub-states (confirm-delete, group-input, rename): container switches to
 *     role="dialog" aria-modal="true" — plain buttons and inputs are valid here.
 *   - The container carries data-menu-container so tests can locate it
 *     regardless of its current role.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { ThreadActionMenu } from '@/ui/components/ThreadActionMenu';
import type { Conversation } from '@/types';

// ─── jsdom environment setup ──────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONV: Conversation = {
  id: 'test-conv-1',
  createdAt: Date.now() - 60_000,
  updatedAt: Date.now() - 30_000,
  messages: [
    { id: 'm1', role: 'user', content: 'Hello', timestamp: Date.now() - 60_000 },
  ],
  models: [{ modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true }],
  interactionMode: 'parallel',
  isGhost: false,
};

function makeTriggerRef(): React.RefObject<HTMLButtonElement> {
  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'Conversation actions');
  document.body.appendChild(btn);
  return { current: btn } as React.RefObject<HTMLButtonElement>;
}

const BASE_PROPS = {
  conversation: CONV,
  existingGroups: [],
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDelete: vi.fn(),
  onSetGroup: vi.fn(),
  onRename: vi.fn(),
  onClose: vi.fn(),
};

function keyDown(el: Element, key: string, shift = false) {
  fireEvent.keyDown(el, { key, shiftKey: shift, bubbles: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

// ─── Top-level menu state — axe ───────────────────────────────────────────────

describe('ThreadActionMenu — menu state, axe scan (WCAG 4.1.2)', () => {
  it('has no axe violations in the top-level menu state', async () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('menu container has aria-label "Conversation actions"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);
    const menu = screen.getByRole('menu', { name: /conversation actions/i });
    expect(menu).toBeTruthy();
  });

  it('all top-level menu items have accessible names and role="menuitem"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);
    const items = screen.getAllByRole('menuitem');
    // Rename, Archive, Move to group, Delete — at least 4
    expect(items.length).toBeGreaterThanOrEqual(4);
    for (const item of items) {
      expect(item.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('menu items use tabIndex={-1} (roving focus — not in tab order)', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);
    const items = screen.getAllByRole('menuitem');
    for (const item of items) {
      expect(item.getAttribute('tabindex')).toBe('-1');
    }
  });

  it('all SVG icons are aria-hidden="true" (decorative)', () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );
    const svgs = container.querySelectorAll('svg');
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('backdrop overlay is aria-hidden="true" (not in a11y tree)', () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );
    const backdrop = container.querySelector('.fixed.inset-0.z-30');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── Sub-state axe scans — #241 fix verification ─────────────────────────────
//
// #241 fix: the container switches to role="dialog" aria-modal="true" in all
// sub-states (confirm-delete, group-input, rename). This resolves the critical
// aria-required-children axe violation that fired when role="menu" contained
// plain <button> and <input> elements.
//
// These tests verify there are NO violations in each sub-state after the fix.

describe('ThreadActionMenu — #241 fixed: no aria-required-children in sub-states', () => {
  it('confirm-delete: no axe violations (container is role="dialog")', async () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('group-input: no axe violations (container is role="dialog")', async () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('rename: no axe violations (container is role="dialog")', async () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('sub-state container switches to role="dialog" aria-modal="true"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const dialog = document.querySelector('[data-menu-container]') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

// ─── Focus management — WCAG 2.4.3 ───────────────────────────────────────────

describe('ThreadActionMenu — focus management (WCAG 2.4.3)', () => {
  it('first menuitem receives focus on mount', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
  });

  it('Cancel button (safe default) receives focus on confirm-delete transition', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    // confirmCancelRef points to the first [data-confirm="true"] button.
    const cancelBtn = document.querySelector(
      'button[data-confirm="true"]',
    ) as HTMLButtonElement;
    expect(cancelBtn).not.toBeNull();
    expect(cancelBtn.textContent?.trim()).toBe('Cancel');
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('group input field receives focus on group-input transition', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const input = document.querySelector(
      '[data-substate] input[type="text"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });

  it('rename input field receives focus on rename transition', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    const input = document.querySelector(
      '[data-substate] input[type="text"]',
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
  });
});

// ─── Keyboard contract — top-level menu ──────────────────────────────────────

describe('ThreadActionMenu — keyboard contract, menu state (WCAG 2.1.1)', () => {
  it('ArrowDown moves focus to next menuitem', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    keyDown(menu, 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowUp wraps to last menuitem from first', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');

    items[0].focus();
    keyDown(menu, 'ArrowUp');
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Home moves focus to first menuitem', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    items[items.length - 1].focus();
    keyDown(menu, 'Home');
    expect(document.activeElement).toBe(items[0]);
  });

  it('End moves focus to last menuitem', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    const items = screen.getAllByRole('menuitem');
    items[0].focus();
    keyDown(menu, 'End');
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('Tab in menu state calls onClose (menus are not tab-navigable)', () => {
    const onClose = vi.fn();
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} onClose={onClose} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    keyDown(menu, 'Tab');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape in menu state calls onClose', () => {
    const onClose = vi.fn();
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} onClose={onClose} triggerRef={triggerRef} />);

    const menu = screen.getByRole('menu');
    keyDown(menu, 'Escape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── Keyboard contract — confirm-delete sub-state ────────────────────────────

describe('ThreadActionMenu — confirm-delete keyboard contract (WCAG 2.1.1)', () => {
  it('ArrowRight cycles between confirm buttons', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    const menuContainer = document.querySelector('[data-menu-container]') as HTMLElement;
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-confirm="true"]'),
    );
    expect(buttons.length).toBe(2);
    buttons[0].focus();

    keyDown(menuContainer, 'ArrowRight');
    expect(document.activeElement).toBe(buttons[1]);
  });

  it('ArrowLeft wraps to last confirm button from first', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    const menuContainer = document.querySelector('[data-menu-container]') as HTMLElement;
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-confirm="true"]'),
    );
    buttons[0].focus();

    keyDown(menuContainer, 'ArrowLeft');
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
  });

  it('confirm-delete group has accessible label "Confirm delete"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    const group = document.querySelector('[role="group"][aria-label="Confirm delete"]');
    expect(group).not.toBeNull();
  });

  it('Escape from confirm-delete calls onClose', () => {
    const onClose = vi.fn();
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} onClose={onClose} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /delete/i }));

    const menuContainer = document.querySelector('[data-menu-container]') as HTMLElement;
    keyDown(menuContainer, 'Escape');
    expect(onClose).toHaveBeenCalled();
  });
});

// ─── group-input and rename sub-state labels ─────────────────────────────────

describe('ThreadActionMenu — sub-state group labels (WCAG 4.1.2)', () => {
  it('group-input sub-state has role="group" with aria-label "Move to group"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const group = document.querySelector('[role="group"][aria-label="Move to group"]');
    expect(group).not.toBeNull();
  });

  it('rename sub-state has role="group" with aria-label "Rename conversation"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    const group = document.querySelector('[role="group"][aria-label="Rename conversation"]');
    expect(group).not.toBeNull();
  });

  it('rename input has aria-label "Conversation title"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /rename/i }));

    const input = document.querySelector(
      '[data-substate] input[aria-label="Conversation title"]',
    );
    expect(input).not.toBeNull();
  });
});

// ─── group-input aria-label regression — #246 / WCAG 4.1.2 ──────────────────
//
// #241 fix: the group-input <input> received aria-label="Group name" to provide
// a persistent programmatic label. Without it, the only labelling mechanism was
// placeholder="Enter group name", which WCAG 4.1.2 does not accept as an
// accessible name (placeholders disappear when the user types, and some AT never
// expose them as the name at all).
//
// These regression tests prevent the aria-label from being silently removed.

describe('ThreadActionMenu — group-input aria-label regression (#246, WCAG 4.1.2)', () => {
  it('group-input <input> has aria-label="Group name"', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    // getByRole matches on accessible name — this fails if aria-label is absent.
    const input = screen.getByRole('textbox', { name: 'Group name' });
    expect(input).toBeTruthy();
    expect(input.getAttribute('aria-label')).toBe('Group name');
  });

  it('group-input accessible name persists when the field has a value (label is not placeholder)', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    const input = screen.getByRole('textbox', { name: 'Group name' });

    // Type a value — the placeholder vanishes, but aria-label must remain.
    fireEvent.change(input, { target: { value: 'Project Alpha' } });

    // The accessible name must still be "Group name" (from aria-label, not placeholder).
    expect(input.getAttribute('aria-label')).toBe('Group name');
    // The placeholder attribute is still in the DOM but is NOT the accessible name.
    expect(input.getAttribute('placeholder')).toBe('Enter group name');
    // Confirm the input now contains the typed value.
    expect((input as HTMLInputElement).value).toBe('Project Alpha');
  });

  it('group-input accessible name is not sourced from placeholder alone', () => {
    const triggerRef = makeTriggerRef();
    render(<ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />);

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    // getByRole with name "Group name" succeeds. If the accessible name came only
    // from the placeholder, this query would fail because placeholder text is
    // "Enter group name", not "Group name". The aria-label is the actual source.
    const input = screen.getByRole('textbox', { name: 'Group name' });
    expect(input.getAttribute('aria-label')).toBe('Group name');
    expect(input.getAttribute('placeholder')).not.toBe('Group name');
  });

  it('group-input axe scan passes with aria-label present (WCAG 4.1.2)', async () => {
    const triggerRef = makeTriggerRef();
    const { container } = render(
      <ThreadActionMenu {...BASE_PROPS} triggerRef={triggerRef} />,
    );

    fireEvent.click(screen.getByRole('menuitem', { name: /move to group/i }));

    // axe validates that the input has a valid accessible name — this would fail
    // if aria-label were absent and only placeholder were present.
    const results = await axe(container);
    assertNoViolations(results);
  });
});
