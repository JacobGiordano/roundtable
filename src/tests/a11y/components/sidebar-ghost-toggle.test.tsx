/**
 * Sidebar Ghost Mode Toggle — Accessibility Tests
 *
 * Audits the ghost mode toggle button added in issue #126.
 * The toggle is a toggle button (role="button" with aria-pressed) in the
 * desktop sidebar header. It activates or deactivates ghost mode for the
 * current conversation (in-memory only, not persisted).
 *
 * WAI-ARIA pattern reference:
 *   https://www.w3.org/WAI/ARIA/apg/patterns/button/
 *   Toggle button pattern: native <button> with aria-pressed={boolean}
 *   - aria-pressed="true" — ghost mode active
 *   - aria-pressed="false" — ghost mode inactive
 *
 * Standards: WCAG 2.1 Level AA
 * File: src/ui/Sidebar.tsx
 *
 * Implementation note (updated after #196 fix):
 *   Aria changed the ghost toggle aria-label from a stateful string
 *   ("Ghost mode off — click to enable" / "Ghost mode on — click to disable")
 *   to a static "Ghost mode". State is now carried entirely by aria-pressed.
 *   Tests updated to match: label assertions use the static string,
 *   stateful-label assertions (contains "off"/"enable"/"on"/"disable") removed.
 */

import { render, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Sidebar } from '@/ui/Sidebar';

// ─── jsdom environment setup ─────────────────────────────────────────────────

/**
 * Sidebar.tsx uses window.matchMedia twice at mount to detect:
 *   1. prefers-reduced-motion
 *   2. mobile viewport
 * jsdom does not implement matchMedia — stub it with a minimal implementation.
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

// ─── Ghost toggle helper ─────────────────────────────────────────────────────

/**
 * Locate the ghost toggle button by its stable static aria-label.
 * After #196 the label is always "Ghost mode" regardless of state.
 * We avoid [aria-pressed] alone because ArchiveToggle buttons also carry
 * aria-pressed and would be matched first.
 */
function getGhostButton(container: HTMLElement): Element | null {
  return (
    Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'Ghost mode',
    ) ?? null
  );
}

// ─── Shared render helper ────────────────────────────────────────────────────

function renderSidebarWithGhostToggle(isGhostMode: boolean) {
  return render(
    <Sidebar
      conversations={[]}
      activeConversationId={null}
      onSelectConversation={vi.fn()}
      onNewConversation={vi.fn()}
      onToggleGhostMode={vi.fn()}
      isGhostMode={isGhostMode}
    />,
  );
}

// ─── Baseline axe test (runs against current main) ───────────────────────────

describe('Sidebar — no axe violations baseline (WCAG general)', () => {
  it('Sidebar renders with no axe violations (no ghost toggle prop)', async () => {
    const { container } = render(
      <Sidebar
        conversations={[]}
        activeConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Ghost toggle tests ───────────────────────────────────────────────────────

describe('Sidebar ghost toggle — no axe violations (WCAG general)', () => {
  it('Sidebar with ghost toggle renders with no axe violations (inactive state)', async () => {
    const { container } = renderSidebarWithGhostToggle(false);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('Sidebar with ghost toggle renders with no axe violations (active state)', async () => {
    const { container } = renderSidebarWithGhostToggle(true);
    const results = await axe(container);
    assertNoViolations(results);
  });
});

describe('Sidebar ghost toggle — ARIA semantics (WCAG 4.1.2)', () => {
  it('ghost toggle button is present when onToggleGhostMode prop is provided', () => {
    const { container } = renderSidebarWithGhostToggle(false);
    const button = getGhostButton(container);
    expect(button).not.toBeNull();
  });

  it('ghost toggle has aria-pressed="false" when inactive', () => {
    const { container } = renderSidebarWithGhostToggle(false);
    const button = getGhostButton(container);
    expect(button?.getAttribute('aria-pressed')).toBe('false');
  });

  it('ghost toggle has aria-pressed="true" when active', () => {
    const { container } = renderSidebarWithGhostToggle(true);
    const button = getGhostButton(container);
    expect(button?.getAttribute('aria-pressed')).toBe('true');
  });

  it('ghost toggle has an accessible name (aria-label) of "Ghost mode"', () => {
    const { container } = renderSidebarWithGhostToggle(false);
    const button = getGhostButton(container);
    expect(button?.getAttribute('aria-label')).toBe('Ghost mode');
  });

  it('ghost toggle is a native button element (keyboard operable by default)', () => {
    const { container } = renderSidebarWithGhostToggle(false);
    const button = getGhostButton(container);
    expect(button?.tagName.toLowerCase()).toBe('button');
  });

  it('ghost toggle is not rendered when onToggleGhostMode prop is absent', () => {
    const { container } = render(
      <Sidebar
        conversations={[]}
        activeConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
      />,
    );
    const button = getGhostButton(container);
    expect(button).toBeNull();
  });
});

describe('Sidebar ghost toggle — keyboard operability (WCAG 2.1.1)', () => {
  it('ghost toggle click handler fires onToggleGhostMode (keyboard Enter triggers click on native button)', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <Sidebar
        conversations={[]}
        activeConversationId={null}
        onSelectConversation={vi.fn()}
        onNewConversation={vi.fn()}
        onToggleGhostMode={onToggle}
        isGhostMode={false}
      />,
    );
    const button = getGhostButton(container) as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    fireEvent.click(button!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
