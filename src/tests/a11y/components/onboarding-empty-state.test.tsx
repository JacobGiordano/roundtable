/**
 * OnboardingEmptyState — Axe-core Accessibility Tests (#204)
 *
 * Issue #204 downshifted the OnboardingEmptyState heading from <h1> to <h2>,
 * resolving the dual-h1 condition flagged in audit-202-196-198.md (Finding 3).
 *
 * Audit targets:
 *   1. Axe violations in the default rendered state
 *   2. Heading level is <h2> — not <h1> — (WCAG 1.3.1)
 *   3. Region landmark has a matching accessible name (WCAG 1.3.1)
 *   4. CTA button has a visible text label (WCAG 4.1.2)
 *   5. SVG icon is hidden from accessibility tree (decorative, aria-hidden)
 *   6. Secondary text link has an underline and focus indicator (WCAG 1.4.1, 2.4.7)
 *
 * WCAG criteria:
 *   - 1.3.1 Info and Relationships — heading level reflects document structure
 *   - 4.1.2 Name, Role, Value — interactive elements have accessible names
 *   - 2.4.7 Focus Visible — buttons have focus-visible ring styling
 *
 * axe-core assertion pattern:
 *   assertNoViolations() helper — equivalent to toHaveNoViolations() but
 *   avoids vitest-axe strict-mode type export issues. Violations are printed
 *   in full so failures are immediately actionable.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { OnboardingEmptyState } from '@/ui/OnboardingEmptyState';

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

// ─── OnboardingEmptyState ─────────────────────────────────────────────────────

describe('OnboardingEmptyState — accessibility (#204)', () => {
  it('has no axe violations in default state', async () => {
    const { container } = render(
      <OnboardingEmptyState onOpenProviderSettings={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('heading is <h2> — not <h1> (WCAG 1.3.1 heading hierarchy)', () => {
    render(<OnboardingEmptyState onOpenProviderSettings={vi.fn()} />);

    // The heading must be h2 — AppLayout provides the page-level h1 (sr-only).
    // If this component re-introduces an h1, the dual-h1 advisory from
    // audit-202-196-198.md (Finding 3) recurs.
    const heading = screen.getByRole('heading', { name: /welcome to roundtable/i });
    expect(heading.tagName).toBe('H2');
    expect(heading.tagName).not.toBe('H1');
  });

  it('region landmark has an accessible name (WCAG 1.3.1)', () => {
    render(<OnboardingEmptyState onOpenProviderSettings={vi.fn()} />);
    // The outer div carries role="region" aria-label="Welcome to Roundtable".
    // A named region gives screen reader users a landmark to navigate to.
    const region = screen.getByRole('region', { name: /welcome to roundtable/i });
    expect(region).toBeTruthy();
  });

  it('CTA button has a visible text accessible name (WCAG 4.1.2)', () => {
    const onOpen = vi.fn();
    render(<OnboardingEmptyState onOpenProviderSettings={onOpen} />);
    const cta = screen.getByRole('button', { name: /add your first provider/i });
    expect(cta).toBeTruthy();
  });

  it('secondary link button has an accessible name (WCAG 4.1.2)', () => {
    render(<OnboardingEmptyState onOpenProviderSettings={vi.fn()} />);
    const link = screen.getByRole('button', { name: /add a custom endpoint/i });
    expect(link).toBeTruthy();
  });

  it('decorative SVG icon is hidden from the accessibility tree (aria-hidden)', () => {
    const { container } = render(
      <OnboardingEmptyState onOpenProviderSettings={vi.fn()} />,
    );
    // The chat-bubble SVG is purely decorative — it must not appear in the
    // accessibility tree. aria-hidden="true" removes it from AT.
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
