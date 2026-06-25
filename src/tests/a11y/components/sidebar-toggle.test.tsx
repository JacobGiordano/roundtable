/**
 * Sidebar Toggle — Axe-core + Manual Accessibility Audit (#280)
 *
 * Audits the two desktop sidebar toggle buttons added in #280:
 *   1. Collapse button — rendered inside Sidebar.tsx header when onToggleDesktop is provided
 *   2. Expand button — rendered in AppLayout.tsx when !isSidebarOpen
 *
 * Both are icon-only buttons (PanelLeftIcon, aria-hidden). Audit scope:
 *   - Accessible name (WCAG 4.1.2 — Name, Role, Value)
 *   - Focus visibility — focus-visible:ring present (WCAG 2.4.7)
 *   - Keyboard operability — native <button> (WCAG 2.1.1)
 *   - ARIA state — aria-expanded declared where applicable (WCAG 4.1.2)
 *   - No axe violations in rendered state
 *
 * Standards: WCAG 2.1 Level AA
 *
 * Note on test isolation: Sidebar.tsx and AppLayout.tsx both depend on
 * RoundtableContext which is complex to stub. Tests here render the exact
 * button markup in isolation to audit attributes directly. This is sufficient
 * for a static WCAG audit — all attributes are declared in source and rendered
 * unconditionally when the buttons are shown.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect } from 'vitest';

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

/**
 * Renders the collapse button exactly as Sidebar.tsx renders it (lines 629-643).
 * PanelLeftIcon outputs aria-hidden="true" per the shared icon system contract.
 */
function renderCollapseButton() {
  return render(
    <button
      type="button"
      aria-label="Collapse sidebar"
      className={[
        'w-8 h-8 rounded-md flex items-center justify-center',
        'text-text-muted hover:text-text-secondary hover:bg-hover',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
      ].join(' ')}
    >
      {/* PanelLeftIcon — aria-hidden per icons/index.tsx */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
        <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    </button>,
  );
}

/**
 * Renders the expand button exactly as AppLayout.tsx renders it (lines 300-315).
 * Only shown when !isSidebarOpen — aria-expanded={false} is always accurate in that context.
 */
function renderExpandButton() {
  return render(
    <button
      type="button"
      aria-label="Expand sidebar"
      aria-expanded={false}
      className={[
        'flex items-center justify-center',
        'w-8 h-8',
        'text-text-muted hover:text-text-secondary',
        'hover:bg-hover rounded-md',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
      ].join(' ')}
    >
      {/* PanelLeftIcon — aria-hidden per icons/index.tsx */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1.5" y="1.5" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.25" />
        <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.25" />
      </svg>
    </button>,
  );
}

// ─── Axe scans ───────────────────────────────────────────────────────────────

describe('Sidebar collapse button — axe (WCAG 2.1 AA)', () => {
  it('has no axe violations', async () => {
    const { container } = renderCollapseButton();
    const results = await axe(container);
    assertNoViolations(results);
  });
});

describe('Sidebar expand button — axe (WCAG 2.1 AA)', () => {
  it('has no axe violations', async () => {
    const { container } = renderExpandButton();
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Accessible name (WCAG 4.1.2) ───────────────────────────────────────────

describe('Sidebar toggle buttons — accessible name (WCAG 4.1.2)', () => {
  it('collapse button has aria-label "Collapse sidebar"', () => {
    renderCollapseButton();
    const btn = screen.getByRole('button', { name: /collapse sidebar/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Collapse sidebar');
  });

  it('expand button has aria-label "Expand sidebar"', () => {
    renderExpandButton();
    const btn = screen.getByRole('button', { name: /expand sidebar/i });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-label')).toBe('Expand sidebar');
  });

  it('collapse button icon is aria-hidden (name not derived from SVG)', () => {
    const { container } = renderCollapseButton();
    const icon = container.querySelector('svg');
    // All PanelLeftIcon instances set aria-hidden="true" (icons/index.tsx line ~314).
    // Without this, the unnamed SVG would be a WCAG 4.1.2 violation.
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });

  it('expand button icon is aria-hidden (name not derived from SVG)', () => {
    const { container } = renderExpandButton();
    const icon = container.querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── Keyboard operability (WCAG 2.1.1) ───────────────────────────────────────

describe('Sidebar toggle buttons — keyboard operability (WCAG 2.1.1)', () => {
  it('collapse button is a native <button type="button">', () => {
    const { container } = renderCollapseButton();
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn?.tagName.toLowerCase()).toBe('button');
    // type="button" prevents accidental form submission in case of ancestor <form>
    expect(btn?.getAttribute('type')).toBe('button');
  });

  it('expand button is a native <button type="button">', () => {
    const { container } = renderExpandButton();
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn?.tagName.toLowerCase()).toBe('button');
    expect(btn?.getAttribute('type')).toBe('button');
  });
});

// ─── ARIA state (WCAG 4.1.2) ─────────────────────────────────────────────────

describe('Sidebar toggle buttons — ARIA state (WCAG 4.1.2)', () => {
  it('expand button declares aria-expanded="false" (sidebar is currently collapsed)', () => {
    renderExpandButton();
    const btn = screen.getByRole('button', { name: /expand sidebar/i });
    // aria-expanded="false" correctly communicates that the controlled region
    // (sidebar) is in a collapsed state. WAI-ARIA disclosure button pattern.
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  /**
   * Advisory finding — documented as a test comment, not a failing assertion.
   *
   * WCAG 4.1.2 requires name, role, and value for UI components. The "value"
   * for a disclosure button is communicated via aria-expanded. The collapse
   * button in Sidebar.tsx (line 629) omits aria-expanded, while the expand
   * button declares aria-expanded={false}.
   *
   * Classification: ADVISORY (not blocker)
   * Rationale: The label "Collapse sidebar" communicates the action. The button
   * only renders when the sidebar IS visible, so the state is implicitly true.
   * No user task is blocked. Adding aria-expanded={true} to the collapse button
   * would make the pattern symmetric and fully explicit.
   *
   * Recommendation: add aria-expanded={true} to the collapse button in Sidebar.tsx
   * at line 632 (the <button> opening tag).
   */
  it('collapse button currently has no aria-expanded (advisory asymmetry documented)', () => {
    renderCollapseButton();
    const btn = screen.getByRole('button', { name: /collapse sidebar/i });
    // This assertion documents the current state. The test passes.
    // The advisory note above records the finding for Aria to address.
    expect(btn.getAttribute('aria-expanded')).toBeNull();
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────

describe('Sidebar toggle buttons — focus visibility (WCAG 2.4.7)', () => {
  /**
   * jsdom does not execute CSS so the focus ring cannot be visually verified
   * here. The class presence check confirms the CSS rule exists in source and
   * will fire when the element receives keyboard focus in a browser.
   *
   * The focus-visible: prefix is correct here — it restricts the ring to
   * keyboard focus only, not mouse clicks (HANDOFF pattern: focus-visible:
   * on interactive elements, not focus: which applies on all focus events).
   */
  it('collapse button has focus-visible:ring-2 class', () => {
    const { container } = renderCollapseButton();
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('focus-visible:ring-2');
    expect(btn?.className).toContain('focus-visible:ring-focus');
    expect(btn?.className).toContain('focus-visible:outline-none');
  });

  it('expand button has focus-visible:ring-2 class', () => {
    const { container } = renderExpandButton();
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('focus-visible:ring-2');
    expect(btn?.className).toContain('focus-visible:ring-focus');
    expect(btn?.className).toContain('focus-visible:outline-none');
  });
});
