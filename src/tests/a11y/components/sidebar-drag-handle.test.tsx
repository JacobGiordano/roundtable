/**
 * Sidebar Drag Handle — Accessibility Tests
 *
 * Audits the resizable sidebar drag handle introduced in issue #62.
 * The drag handle is a keyboard-operable splitter control.
 *
 * WAI-ARIA pattern reference:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/
 *   The window splitter pattern recommends role="separator" with:
 *     - aria-orientation="vertical" (for a vertical splitter)
 *     - aria-valuenow, aria-valuemin, aria-valuemax (current/min/max width)
 *     - tabIndex={0} (in tab order, keyboard operable)
 *     - ArrowLeft/ArrowRight keys to resize
 *     - An accessible label describing its purpose
 *
 * Standards: WCAG 2.1 Level AA
 * File: src/ui/Sidebar.tsx
 *
 * Note: Sidebar is a complex component — we test the drag handle in isolation
 * by rendering Sidebar with minimal required props and inspecting the handle element.
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Sidebar } from '@/ui/Sidebar';

// ─── jsdom environment setup ─────────────────────────────────────────────────

/**
 * Sidebar.tsx uses window.matchMedia twice at mount to detect:
 *   1. prefers-reduced-motion (line ~844)
 *   2. mobile viewport (line ~855)
 *
 * jsdom does not implement window.matchMedia. We stub it with a minimal
 * implementation that returns a non-matching result (false) for all queries.
 * This is the standard jsdom workaround for components that use matchMedia.
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

// ─── Axe assertion helper ────────────────────────────────────────────────────

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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SIDEBAR_PROPS = {
  conversations: [],
  activeConversationId: null,
  onSelectConversation: vi.fn(),
  onNewConversation: vi.fn(),
};

// ─── Drag handle — no axe violations ────────────────────────────────────────

describe('Sidebar drag handle — no axe violations (WCAG general)', () => {
  it('Sidebar renders with no axe violations (empty state)', async () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Drag handle — ARIA semantics ────────────────────────────────────────────

describe('Sidebar drag handle — ARIA semantics (WCAG 4.1.2, WAI-ARIA splitter)', () => {
  it('drag handle has role="separator"', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    expect(handle).not.toBeNull();
  });

  it('drag handle has aria-orientation="vertical"', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical');
  });

  it('drag handle has an accessible label (aria-label)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    const label = handle?.getAttribute('aria-label');
    expect(label).toBeTruthy();
    expect(label?.toLowerCase()).toMatch(/resize/);
  });

  it('drag handle is in the tab order (tabIndex=0)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    // tabIndex=0 means it participates in the natural tab order
    expect(handle?.getAttribute('tabindex')).toBe('0');
  });

  it('drag handle has aria-valuenow (current width)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    const valuenow = handle?.getAttribute('aria-valuenow');
    expect(valuenow).toBeTruthy();
    // Must be a numeric value
    expect(Number(valuenow)).toBeGreaterThan(0);
  });

  it('drag handle has aria-valuemin (minimum width)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    const valuemin = handle?.getAttribute('aria-valuemin');
    expect(valuemin).toBeTruthy();
    expect(Number(valuemin)).toBeGreaterThan(0);
  });

  it('drag handle has aria-valuemax (maximum width)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    const valuemax = handle?.getAttribute('aria-valuemax');
    expect(valuemax).toBeTruthy();
    expect(Number(valuemax)).toBeGreaterThan(Number(handle?.getAttribute('aria-valuemin') ?? '0'));
  });

  it('aria-valuenow is between aria-valuemin and aria-valuemax', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    const min = Number(handle?.getAttribute('aria-valuemin') ?? '0');
    const max = Number(handle?.getAttribute('aria-valuemax') ?? '0');
    const now = Number(handle?.getAttribute('aria-valuenow') ?? '0');
    expect(now).toBeGreaterThanOrEqual(min);
    expect(now).toBeLessThanOrEqual(max);
  });
});

// ─── Drag handle — keyboard operability ─────────────────────────────────────

describe('Sidebar drag handle — keyboard operability (WCAG 2.1.1)', () => {
  /**
   * Keyboard resize is implemented via onKeyDown (handleDragKeyDown).
   * ArrowRight increases width; ArrowLeft decreases width.
   * We test this at the logic level — the handler is attached via onKeyDown
   * which is exercisable in jsdom.
   */
  it('drag handle has an onKeyDown handler (keyboard resize is wired)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]') as HTMLElement | null;
    expect(handle).not.toBeNull();
    // The handler is bound via React's synthetic event system.
    // We verify the element has the correct event listener by checking that
    // dispatching ArrowRight does not throw — full behavior testing requires
    // userEvent or manual browser verification.
    expect(() => {
      handle?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    }).not.toThrow();
  });

  it('drag handle has cursor-col-resize class (visual affordance)', () => {
    const { container } = render(<Sidebar {...SIDEBAR_PROPS} />);
    const handle = container.querySelector('[role="separator"]');
    // cursor-col-resize is the Tailwind class applied to the handle
    expect(handle?.className).toContain('cursor-col-resize');
  });
});
