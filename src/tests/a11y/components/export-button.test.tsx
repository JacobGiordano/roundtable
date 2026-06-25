/**
 * ExportButton — Axe-core Accessibility Tests (#281)
 *
 * Audit scope:
 *   - Axe scans: closed, open, and disabled states
 *   - WAI-ARIA menu button attributes (WCAG 4.1.2)
 *   - Focus visibility: trigger ring vs. menuitem bg-hover pattern (WCAG 2.4.7)
 *   - Focus management: open → first item, Escape → trigger (WCAG 2.4.3)
 *   - Focus return after selection (WCAG 2.4.3) ← BLOCKER — see failing test below
 *
 * WCAG criteria:
 *   - 2.1.1 Keyboard — all functionality operable via keyboard alone
 *   - 2.4.3 Focus Order — focus managed correctly when menu opens and closes
 *   - 2.4.7 Focus Visible — focus indicators present on all interactive elements
 *   - 4.1.2 Name, Role, Value — ARIA roles, states, and accessible names correct
 *
 * WAI-ARIA Menu Button pattern reference:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/
 */

import { render, screen, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportButton } from '@/ui/ExportButton';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderButton(props: { disabled?: boolean } = {}) {
  const onExport = vi.fn();
  const utils = render(<ExportButton onExport={onExport} disabled={props.disabled} />);
  return { onExport, ...utils };
}

function getTrigger() {
  return screen.getByRole('button', { name: /export conversation/i });
}

/** Synchronous rAF stub — flushes double-rAF immediately in jsdom. */
function stubRafSync(): () => void {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  };
  return () => {
    window.requestAnimationFrame = original;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Axe scans ───────────────────────────────────────────────────────────────

describe('ExportButton — axe scans (WCAG 4.1.2)', () => {
  it('has no axe violations in closed state', async () => {
    const { container } = renderButton();
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in open state (menu rendered)', async () => {
    const { container } = renderButton();
    await userEvent.click(getTrigger());
    expect(screen.getByRole('menu')).toBeDefined();
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in disabled state', async () => {
    const { container } = renderButton({ disabled: true });
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ARIA attributes ──────────────────────────────────────────────────────────

describe('ExportButton — ARIA attributes (WCAG 4.1.2)', () => {
  it('trigger has aria-label="Export conversation"', () => {
    renderButton();
    expect(getTrigger().getAttribute('aria-label')).toBe('Export conversation');
  });

  it('trigger has aria-haspopup="menu"', () => {
    renderButton();
    expect(getTrigger().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('trigger has aria-expanded="false" when menu is closed', () => {
    renderButton();
    expect(getTrigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('trigger has aria-expanded="true" when menu is open', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    expect(getTrigger().getAttribute('aria-expanded')).toBe('true');
  });

  it('menu container has role="menu"', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('menu container has aria-label="Export format"', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    expect(screen.getByRole('menu').getAttribute('aria-label')).toBe('Export format');
  });

  it('menu contains exactly two menuitems', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
  });

  it('menuitems have accessible text names', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    expect(screen.getByRole('menuitem', { name: /download as markdown/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /download as html/i })).toBeDefined();
  });

  it('menuitems have tabIndex={-1} (excluded from natural Tab order)', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    const items = screen.getAllByRole('menuitem');
    items.forEach((item) => {
      expect((item as HTMLElement).tabIndex).toBe(-1);
    });
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────

describe('ExportButton — focus visibility (WCAG 2.4.7)', () => {
  it('trigger uses focus-visible:ring-2 (keyboard ring, not bare focus:ring)', () => {
    renderButton();
    const trigger = getTrigger();
    // focus-visible: prefix ensures ring only shows on keyboard focus, not mouse.
    expect(trigger.className).toContain('focus-visible:ring-2');
    // Bare focus:ring would show ring on every mouse click — banned project-wide.
    expect(trigger.className).not.toMatch(/(?<!\w)focus:ring/);
  });

  it('trigger uses focus-visible:ring-focus token', () => {
    renderButton();
    expect(getTrigger().className).toContain('focus-visible:ring-focus');
  });

  it('menuitems use focus:bg-hover for programmatic focus indication', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    const items = screen.getAllByRole('menuitem');
    // tabIndex={-1} items are only reachable programmatically (arrow keys), so
    // focus: (not focus-visible:) is correct — they need a visual indicator for
    // keyboard users navigating via arrow keys, which are never "pointer-like".
    items.forEach((item) => {
      expect(item.className).toContain('focus:bg-hover');
    });
  });

  it('menuitems pair focus:outline-none with focus:bg-hover (no invisible focus)', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    const items = screen.getAllByRole('menuitem');
    // outline-none removes the default UA ring. It is only acceptable here because
    // focus:bg-hover provides an alternative visible indicator. Both must be present.
    items.forEach((item) => {
      expect(item.className).toContain('focus:outline-none');
      expect(item.className).toContain('focus:bg-hover');
    });
  });
});

// ─── Focus management (WCAG 2.4.3) ───────────────────────────────────────────

describe('ExportButton — focus management (WCAG 2.4.3)', () => {
  it('Escape closes the menu and returns focus to the trigger button', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(getTrigger());
  });

  it('opening the menu moves focus to the first menuitem (double-rAF)', async () => {
    // The double-rAF moves focus to the first menuitem after React commits the menu
    // to the DOM. Stubbing rAF synchronously flushes both frames immediately.
    const restoreRaf = stubRafSync();
    renderButton();

    await act(async () => {
      await userEvent.click(getTrigger());
    });

    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
    restoreRaf();
  });

  // ── BLOCKER ──────────────────────────────────────────────────────────────────
  //
  // WCAG 2.4.3 Focus Order violation: selecting a format via keyboard drops
  // focus to document.body instead of returning it to the trigger button.
  //
  // WAI-ARIA Menu Button pattern (keyboard interaction — Enter or Space):
  //   "Activates the menu item, which closes the menu, and sets focus on
  //    the menu button." (https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/)
  //
  // Root cause: handleSelect() calls setIsOpen(false) directly. The focused
  // menuitem button unmounts with focus on it, so the browser moves focus to
  // document.body. The closeAndReturn() helper (used by the Escape path) already
  // does setIsOpen(false) + buttonRef.current?.focus() — it just isn't called
  // from handleSelect.
  //
  // Fix (Aria): replace `setIsOpen(false)` in handleSelect with `closeAndReturn()`.
  //
  //   const handleSelect = (format: ExportFormat) => {
  //     onExport(format);
  //     closeAndReturn();   // ← was: setIsOpen(false)
  //   };
  //
  // This test MUST pass before this branch is merged.
  // ─────────────────────────────────────────────────────────────────────────────
  it('selecting a format returns focus to the trigger button (WCAG 2.4.3 — WAI-ARIA menu pattern)', async () => {
    renderButton();
    await userEvent.click(getTrigger());
    const items = screen.getAllByRole('menuitem');

    // Place focus on the first item (as a keyboard user would via ArrowDown).
    act(() => items[0].focus());
    expect(document.activeElement).toBe(items[0]);

    // Activate the item (Enter fires click on a native button in real browsers;
    // we fire both events as in the existing keyboard navigation test suite).
    await act(async () => {
      fireEvent.keyDown(items[0], { key: 'Enter' });
      fireEvent.click(items[0]);
    });

    // Menu should be closed.
    expect(screen.queryByRole('menu')).toBeNull();

    // WCAG 2.4.3: focus must return to the menu button, not drop to document.body.
    expect(document.activeElement).toBe(getTrigger());
  });
});
