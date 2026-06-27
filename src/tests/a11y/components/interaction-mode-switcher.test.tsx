/**
 * InteractionModeSwitcher — Axe-core Accessibility Tests (#131, #199)
 *
 * Issue #131 changed Manual and Auto-chain modes to "coming soon" disabled radio
 * items. Issue #299 wired Auto-chain into handleSend — Auto-chain is now a fully
 * interactive `<button role="radio">`. Only Manual remains disabled (`comingSoon:
 * true`), rendered as `<span role="radio" aria-disabled="true">`.
 *
 * Issue #199 fixed the ARIA ownership model. The previous approach used
 * aria-owns on the radiogroup to exclude coming-soon spans, but aria-owns
 * cannot remove DOM children from the ARIA ownership tree — it only adds
 * non-DOM children. The correct fix: give coming-soon items role="radio" +
 * aria-disabled="true" so every owned child of the radiogroup is a valid
 * radio member (satisfying aria-required-children). aria-disabled (not HTML
 * disabled) keeps items tab-reachable so keyboard users can discover the
 * "coming soon" tooltip.
 *
 * Audit targets:
 *   1. No axe violations with role="radio" + aria-disabled="true" on disabled items
 *   2. Disabled radio items ARE focusable via Tab (tabIndex={0}, aria-disabled not HTML disabled)
 *   3. Tooltip role="tooltip" is present for coming-soon items
 *   4. All three items in the radiogroup have role="radio" — ARIA integrity satisfied
 *   5. #199: disabled items carry aria-disabled="true" and aria-checked="false"
 *   6. #199: radiogroup has no aria-owns (all DOM children are valid radio members)
 *   7. sr-only "coming soon" note is outside the radiogroup DOM
 *
 * WCAG criteria:
 *   - 4.1.2 Name, Role, Value — all radiogroup members have correct roles/names
 *   - 2.1.1 Keyboard — disabled radios remain tab-reachable (aria-disabled, not disabled)
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

describe('InteractionModeSwitcher — #131/#199: radiogroup ownership model (WCAG 4.1.2, 2.1.1)', () => {
  it('has no axe violations in default state (parallel selected)', async () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('all three modes have role="radio" — radiogroup ownership model satisfied (#199)', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // All three members of the radiogroup must carry role="radio" so aria-required-children
    // is satisfied without an aria-owns workaround. Previously only Parallel had role="radio".
    const radios = screen.queryAllByRole('radio');
    expect(radios).toHaveLength(3);
    const labels = radios.map((r) => r.getAttribute('aria-label') ?? '');
    expect(labels.some((l) => /parallel/i.test(l))).toBe(true);
    expect(labels.some((l) => /manual/i.test(l))).toBe(true);
    expect(labels.some((l) => /auto-chain/i.test(l))).toBe(true);
  });

  it('disabled radio items have aria-disabled="true" and aria-checked="false" (#199)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // aria-disabled (not HTML disabled) ensures keyboard users can Tab to the item
    // and hear the "coming soon" tooltip — satisfying WCAG 2.1.1.
    const disabledRadios = container.querySelectorAll('[role="radio"][aria-disabled="true"]');
    expect(disabledRadios.length).toBe(1);
    for (const radio of disabledRadios) {
      expect(radio.getAttribute('aria-checked')).toBe('false');
    }
  });

  it('disabled radio items are Tab-reachable (tabIndex={0}, aria-disabled not HTML disabled)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // aria-disabled keeps items in the tab order. tabIndex={0} is required because
    // <span> is not natively focusable. This enables keyboard users to discover the
    // "coming soon" tooltip — satisfying WCAG 4.1.2 Name, Role, Value.
    const disabledRadios = container.querySelectorAll('[role="radio"][aria-disabled="true"]');
    for (const radio of disabledRadios) {
      const tabIndex = radio.getAttribute('tabindex');
      expect(tabIndex).not.toBeNull();
      expect(parseInt(tabIndex!, 10)).toBeGreaterThanOrEqual(0);
      // Must NOT have HTML disabled attribute (which would remove from tab order)
      expect(radio.hasAttribute('disabled')).toBe(false);
    }
  });

  it('coming-soon radio items have an accessible label describing their state', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // Manual is the only remaining disabled mode — carries aria-label="Manual — coming soon"
    const manualRadio = container.querySelector('[role="radio"][aria-label="Manual — coming soon"]');
    expect(manualRadio).not.toBeNull();

    // Auto-chain (#299) is now interactive — its aria-label describes the mode,
    // not "coming soon". Confirm it is a <button> with an auto-chain label that
    // does NOT include "coming soon".
    const autoChainRadio = container.querySelector('button[role="radio"]');
    const autoChainLabels = Array.from(
      container.querySelectorAll('button[role="radio"]')
    ).map((el) => el.getAttribute('aria-label') ?? '');
    const autoChainLabel = autoChainLabels.find((l) => /auto-chain/i.test(l));
    expect(autoChainLabel).toBeDefined();
    expect(autoChainLabel).not.toMatch(/coming soon/i);
    // The disabled coming-soon span must NOT be auto-chain
    expect(
      container.querySelector('[role="radio"][aria-disabled="true"][aria-label*="Auto-chain"]')
    ).toBeNull();
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

  it('radiogroup has no aria-owns — all DOM children are valid radio members (#199)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // With role="radio" on all children, aria-owns is no longer needed.
    // Its absence confirms the fix uses proper semantics rather than a workaround.
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();
    expect(radiogroup?.hasAttribute('aria-owns')).toBe(false);
  });

  it('Parallel radio button is accessible and operable', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    expect(parallelRadio).toBeTruthy();
    expect(parallelRadio.getAttribute('aria-checked')).toBe('true');
    expect(parallelRadio.tagName.toLowerCase()).toBe('button');
    // Parallel is NOT aria-disabled — it is the one selectable mode
    expect(parallelRadio.hasAttribute('aria-disabled')).toBe(false);
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
    expect(note?.textContent).toMatch(/coming soon/i);
  });

  it('has no axe violations with role="radio" + aria-disabled ownership model in place', async () => {
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
