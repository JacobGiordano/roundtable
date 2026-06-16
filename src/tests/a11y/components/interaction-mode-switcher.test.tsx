/**
 * InteractionModeSwitcher — Axe-core Accessibility Tests (#131)
 *
 * Issue #131 changed Manual and Auto-chain mode buttons from interactive
 * `<button>` elements into non-interactive `<span>` elements with a
 * "coming soon" tooltip, while Parallel remains a functional `<button
 * role="radio">`.
 *
 * Audit targets:
 *   1. No axe violations in the mixed button/span state
 *   2. Disabled spans are NOT focusable (no tabIndex, no keyboard entry point)
 *   3. Tooltip role="tooltip" is present for the coming-soon spans
 *   4. The radiogroup contains at least one functional radio — ARIA integrity
 *
 * WCAG criteria:
 *   - 4.1.2 Name, Role, Value — interactive elements must have correct roles/names
 *   - 2.1.1 Keyboard — non-interactive elements must not be reachable by keyboard
 *   - 1.3.1 Info and Relationships — role="tooltip" provides semantic structure
 *
 * axe-core assertion pattern:
 *   assertNoViolations() helper — equivalent to toHaveNoViolations().
 *   Violation descriptions are included in failure output via the summary helper.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { InteractionModeSwitcher } from '@/ui/InteractionModeSwitcher';

// ─── Axe assertion helper ─────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n')
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InteractionModeSwitcher — #131: disabled coming-soon spans (WCAG 4.1.2, 2.1.1)', () => {
  it('has no axe violations in default state (parallel selected)', async () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('disabled "Manual" span is not focusable — no tabIndex attribute', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // The disabled spans must have no tabIndex (default -1 or unset means not in tab order).
    // Spans are not focusable by default in HTML — verify no tabIndex was accidentally added.
    const spans = container.querySelectorAll('span[aria-label*="coming soon"]');
    for (const span of spans) {
      // tabIndex >= 0 would make the span keyboard-reachable — that is the failure mode.
      const tabIndex = span.getAttribute('tabindex');
      expect(tabIndex === null || parseInt(tabIndex, 10) < 0).toBe(true);
    }
  });

  it('disabled spans are not reachable by getByRole keyboard patterns', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // Only one radio (Parallel) should be in the accessibility tree as interactive.
    // Manual and Auto-chain are spans — they carry no interactive role.
    const radios = screen.queryAllByRole('radio');
    expect(radios).toHaveLength(1);
    expect(radios[0].getAttribute('aria-label')).toMatch(/parallel/i);
  });

  it('coming-soon spans have an accessible label describing their state', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // Each disabled span carries aria-label="[Mode] — coming soon" to communicate
    // non-availability to screen readers when the element is reached via reading mode.
    const manualSpan = container.querySelector('span[aria-label="Manual — coming soon"]');
    const autoChainSpan = container.querySelector('span[aria-label="Auto-chain — coming soon"]');
    expect(manualSpan).not.toBeNull();
    expect(autoChainSpan).not.toBeNull();
  });

  it('tooltip elements carry role="tooltip"', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const tooltips = container.querySelectorAll('[role="tooltip"]');
    // Three mode buttons = three tooltips (Parallel + 2 coming-soon)
    expect(tooltips.length).toBeGreaterThanOrEqual(2);
    // At least one coming-soon tooltip contains the expected text
    const tooltipTexts = Array.from(tooltips).map((t) => t.textContent ?? '');
    expect(tooltipTexts.some((t) => t.includes('Coming soon'))).toBe(true);
  });

  it('the radiogroup itself has an accessible label', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Interaction mode');
  });

  it('Parallel radio button is accessible and operable', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    expect(parallelRadio).toBeTruthy();
    expect(parallelRadio.getAttribute('aria-checked')).toBe('true');
    expect(parallelRadio.tagName.toLowerCase()).toBe('button');
  });
});
