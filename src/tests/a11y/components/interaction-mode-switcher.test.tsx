/**
 * InteractionModeSwitcher — Axe-core Accessibility Tests (#131, #199, #440)
 *
 * Issue #131 changed Manual and Auto-chain modes to "coming soon" disabled radio
 * items. Issue #299 wired Auto-chain into handleSend — Auto-chain became fully
 * interactive. Issue #440 removed the Manual mode entry entirely because the
 * feature does not exist; rendering a permanently-greyed placeholder created noise.
 *
 * Current state (#440): two fully enabled modes — Parallel and Auto-chain.
 * No disabled/coming-soon entries. The `comingSoon` rendering path in ModeButton
 * is retained for future use but is currently unused.
 *
 * Audit targets:
 *   1. No axe violations — radiogroup with two fully enabled members
 *   2. Both modes have role="radio" — ARIA ownership satisfied
 *   3. Neither mode carries aria-disabled (all modes are enabled)
 *   4. Radiogroup has an accessible label ("Interaction mode")
 *   5. Radiogroup has no aria-owns and no aria-describedby pointing at a removed note
 *   6. Both buttons are operable via click — onModeChange fires
 *   7. Tooltip role="tooltip" exists for each mode button
 *   8. Arrow-key navigation moves focus between radios (WAI-ARIA radio group contract)
 *   9. All enabled radio buttons use focus-visible ring (not bare focus:ring)
 *
 * WCAG criteria:
 *   - 4.1.2 Name, Role, Value — all radiogroup members have correct roles/names
 *   - 2.1.1 Keyboard — arrow-key navigation, no keyboard traps
 *   - 1.3.1 Info and Relationships — role="radiogroup" with label
 *   - 1.4.13 Content on Hover or Focus — tooltip dismissible via Escape
 *
 * axe-core assertion pattern:
 *   assertNoViolations() helper — equivalent to toHaveNoViolations().
 *   Violation descriptions are included in failure output via the summary helper.
 */

import { render, screen, fireEvent } from '@testing-library/react';
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

describe('InteractionModeSwitcher — #440: two-mode all-enabled radiogroup (WCAG 4.1.2, 2.1.1)', () => {
  it('has no axe violations in default state (parallel selected)', async () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when auto-chain is selected', async () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="auto-chain" onModeChange={() => {}} />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('exactly two modes have role="radio" — #440: Manual removed, two remaining', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radios = screen.queryAllByRole('radio');
    // #440: only Parallel and Auto-chain remain. Manual was removed.
    expect(radios).toHaveLength(2);
    const labels = radios.map((r) => r.getAttribute('aria-label') ?? '');
    expect(labels.some((l) => /parallel/i.test(l))).toBe(true);
    expect(labels.some((l) => /auto-chain/i.test(l))).toBe(true);
    // Manual must not be present in any form
    expect(labels.some((l) => /manual/i.test(l))).toBe(false);
  });

  it('no radio items carry aria-disabled — all modes are fully enabled (#440)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // #440: Manual (the only coming-soon mode) was removed. No disabled radios remain.
    const disabledRadios = container.querySelectorAll('[role="radio"][aria-disabled="true"]');
    expect(disabledRadios.length).toBe(0);
  });

  it('the radiogroup has an accessible label "Interaction mode"', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Interaction mode');
  });

  it('radiogroup has no aria-owns — all DOM children are valid radio members', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();
    expect(radiogroup?.hasAttribute('aria-owns')).toBe(false);
  });

  it('radiogroup has no aria-describedby pointing at a removed sr-only note (#440)', () => {
    // #440 removed the sr-only coming-soon note (id="interaction-mode-coming-soon-note").
    // The radiogroup must not reference it via aria-describedby — stale aria-describedby
    // pointing at a non-existent element is an ARIA 1.2 violation.
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radiogroup = container.querySelector('[role="radiogroup"]');
    expect(radiogroup).not.toBeNull();
    expect(radiogroup?.hasAttribute('aria-describedby')).toBe(false);
    // The note element itself must also be absent from the DOM
    const note = container.querySelector('#interaction-mode-coming-soon-note');
    expect(note).toBeNull();
  });

  it('Parallel radio has aria-checked="true" when selected and is a <button>', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    expect(parallelRadio.getAttribute('aria-checked')).toBe('true');
    // #440: fully enabled mode uses a <button> element, not a <span>
    expect(parallelRadio.tagName.toLowerCase()).toBe('button');
    expect(parallelRadio.hasAttribute('aria-disabled')).toBe(false);
  });

  it('Auto-chain radio has aria-checked="true" when selected and is a <button>', () => {
    render(
      <InteractionModeSwitcher activeMode="auto-chain" onModeChange={vi.fn()} />
    );
    const autoChainRadio = screen.getByRole('radio', { name: /auto-chain/i });
    expect(autoChainRadio.getAttribute('aria-checked')).toBe('true');
    expect(autoChainRadio.tagName.toLowerCase()).toBe('button');
    expect(autoChainRadio.hasAttribute('aria-disabled')).toBe(false);
  });

  it('clicking a radio calls onModeChange with the correct mode', () => {
    const onModeChange = vi.fn();
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={onModeChange} />
    );
    const autoChainRadio = screen.getByRole('radio', { name: /auto-chain/i });
    fireEvent.click(autoChainRadio);
    expect(onModeChange).toHaveBeenCalledWith('auto-chain');
  });

  it('each mode button has a tooltip with role="tooltip"', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const tooltips = container.querySelectorAll('[role="tooltip"]');
    // Two mode buttons = two tooltips (Parallel + Auto-chain)
    expect(tooltips.length).toBe(2);
    // No tooltip should contain "Coming soon" since all modes are enabled
    const tooltipTexts = Array.from(tooltips).map((t) => t.textContent ?? '');
    expect(tooltipTexts.every((t) => !t.includes('Coming soon'))).toBe(true);
  });

  it('all enabled radio buttons use focus-visible ring (not bare focus:ring)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    const radios = container.querySelectorAll('[role="radio"]');
    expect(radios.length).toBeGreaterThan(0);
    for (const radio of radios) {
      expect(radio.className).toContain('focus-visible:ring-2');
      expect(radio.className).not.toMatch(/(?<!\w)focus:ring/);
    }
  });

  it('ArrowRight key moves focus from Parallel to Auto-chain (WAI-ARIA radio keyboard contract)', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const radiogroup = screen.getByRole('radiogroup');
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    const autoChainRadio = screen.getByRole('radio', { name: /auto-chain/i });

    parallelRadio.focus();
    expect(document.activeElement).toBe(parallelRadio);

    fireEvent.keyDown(radiogroup, { key: 'ArrowRight', bubbles: true });
    expect(document.activeElement).toBe(autoChainRadio);
  });

  it('ArrowLeft key wraps from Parallel back to Auto-chain (last item)', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const radiogroup = screen.getByRole('radiogroup');
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    const autoChainRadio = screen.getByRole('radio', { name: /auto-chain/i });

    parallelRadio.focus();
    fireEvent.keyDown(radiogroup, { key: 'ArrowLeft', bubbles: true });
    // Wraps around — from Parallel (first) to Auto-chain (last)
    expect(document.activeElement).toBe(autoChainRadio);
  });

  it('ArrowDown key moves focus from Parallel to Auto-chain (synonym for ArrowRight)', () => {
    render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={vi.fn()} />
    );
    const radiogroup = screen.getByRole('radiogroup');
    const parallelRadio = screen.getByRole('radio', { name: /parallel/i });
    const autoChainRadio = screen.getByRole('radio', { name: /auto-chain/i });

    parallelRadio.focus();
    fireEvent.keyDown(radiogroup, { key: 'ArrowDown', bubbles: true });
    expect(document.activeElement).toBe(autoChainRadio);
  });

  it('WCAG 2.2 2.5.8: both radio buttons meet 24×24px minimum target size via h-7 (28px)', () => {
    const { container } = render(
      <InteractionModeSwitcher activeMode="parallel" onModeChange={() => {}} />
    );
    // ModeButton renders h-7 (28px height) which satisfies WCAG 2.2 §2.5.8 minimum (24px).
    // Width is determined by px-3 + content — "Parallel" and "Auto-chain" are both
    // wide enough to exceed 24px at any reasonable font size.
    const radios = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(radios.length).toBe(2);
    for (const radio of radios) {
      // h-7 = 28px. Verify the class is applied so the minimum is declared.
      expect(radio.className).toContain('h-7');
    }
  });
});
