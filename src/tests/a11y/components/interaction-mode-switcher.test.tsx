/**
 * InteractionModeSwitcher — Axe-core Accessibility Tests (#131, #199)
 *
 * Issue #131 changed Manual and Auto-chain mode buttons from interactive
 * `<button>` elements into non-interactive `<span>` elements with a
 * "coming soon" tooltip, while Parallel remains a functional `<button
 * role="radio">`.
 *
 * Issue #199 added aria-owns on the radiogroup listing only the enabled
 * radio button IDs, so AT does not misinterpret the coming-soon spans as
 * owned radio children (which would violate aria-required-children for
 * role="radiogroup"). The spans live in the DOM as children but are excluded
 * from the ARIA ownership tree via the explicit aria-owns list.
 *
 * Note on axe-core and aria-owns (#199):
 *   axe-core v4 does not fire aria-required-children for radiogroups that
 *   contain non-radio DOM children WITHOUT aria-owns. The violation is an AT
 *   behavior issue (JAWS/NVDA may announce the spans as part of the group)
 *   rather than a markup parse error axe detects. The aria-owns fix is still
 *   correct and important for AT compatibility — the tests below verify the
 *   implementation contract even though axe does not catch the original problem.
 *
 * Audit targets:
 *   1. No axe violations in the mixed button/span state
 *   2. Disabled spans are NOT focusable (no tabIndex, no keyboard entry point)
 *   3. Tooltip role="tooltip" is present for the coming-soon spans
 *   4. The radiogroup contains at least one functional radio — ARIA integrity
 *   5. #199: aria-owns lists only enabled radio IDs (not coming-soon span IDs)
 *   6. #199: coming-soon spans have no id that could appear in aria-owns
 *   7. #199: the sr-only "coming soon" note is outside the radiogroup DOM
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

// ─── #199: aria-owns radiogroup ownership contract ───────────────────────────

describe('InteractionModeSwitcher — #199: aria-owns radiogroup ownership (WCAG 4.1.2)', () => {
  it('radiogroup has aria-owns attribute', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();
    expect(radiogroup?.getAttribute('aria-owns')).toBeTruthy();
  });

  it('aria-owns contains only the enabled radio button id (interaction-mode-radio-parallel)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radiogroup = container.querySelector('[role="radiogroup"]');
    const ariaOwns = radiogroup?.getAttribute('aria-owns') ?? '';
    // Must include the parallel radio id
    expect(ariaOwns).toContain('interaction-mode-radio-parallel');
    // Must NOT include any coming-soon mode ids (they have no ids in the DOM)
    expect(ariaOwns).not.toContain('manual');
    expect(ariaOwns).not.toContain('auto-chain');
  });

  it('the enabled Parallel radio button has the id referenced by aria-owns', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const parallelBtn = container.querySelector('#interaction-mode-radio-parallel');
    expect(parallelBtn).not.toBeNull();
    expect(parallelBtn?.getAttribute('role')).toBe('radio');
  });

  it('coming-soon spans have no id attribute (cannot pollute aria-owns)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const comingSoonSpans = container.querySelectorAll('span[aria-label*="coming soon"]');
    expect(comingSoonSpans.length).toBeGreaterThan(0);
    for (const span of comingSoonSpans) {
      // Spans must not have an id — if they did, a naive aria-owns could inadvertently
      // include them, or AT could misidentify them as owned radio children.
      expect(span.getAttribute('id')).toBeNull();
    }
  });

  it('sr-only "coming soon" note is a sibling of the radiogroup, not inside it', () => {
    // #221: the sr-only note must be outside the radiogroup to prevent AT from
    // reading it twice in browse mode (once as aria-describedby, once as a child).
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const note = container.querySelector('#interaction-mode-coming-soon-note');
    expect(note).not.toBeNull();

    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();

    // The note must NOT be a descendant of the radiogroup.
    expect(radiogroup?.contains(note)).toBe(false);

    // The note must be a sibling or ancestor-level element (in the same fragment).
    // Verify it is referenced via aria-describedby from the radiogroup.
    expect(radiogroup?.getAttribute('aria-describedby')).toBe(
      'interaction-mode-coming-soon-note',
    );
  });

  it('the sr-only note describes the coming-soon modes accurately', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const note = container.querySelector('#interaction-mode-coming-soon-note');
    expect(note?.textContent).toMatch(/manual/i);
    expect(note?.textContent).toMatch(/auto-chain/i);
    expect(note?.textContent).toMatch(/coming soon/i);
  });

  it('has no axe violations with aria-owns in place', async () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // Wrap in a labelled region so axe has a valid document context.
    const wrapper = document.createElement('main');
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    const { axe: runAxe } = await import('vitest-axe');
    const results = await runAxe(wrapper);
    const summary = results.violations
      .map((v) => `[${v.impact}] ${v.id}: ${v.help}`)
      .join('\n');
    expect(results.violations, `Axe violations:\n${summary}`).toHaveLength(0);
  });
});
