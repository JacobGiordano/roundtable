/**
 * InputBar — Axe-core Accessibility Tests (#226)
 *
 * Audit scope: skip-link target wiring.
 * The textareaId prop places id="skip-target" on the textarea when the roster
 * is populated (AppLayout: isRosterEmpty === false). When isRosterEmpty is true,
 * InputBar receives textareaId={undefined} and the id sits on OnboardingEmptyState's
 * CTA button instead — preventing any duplicate-id-active violation.
 *
 * WCAG criteria:
 *   - 2.4.1 Bypass Blocks — skip link must land focus on a usable interactive element
 *   - 4.1.1 Parsing — no duplicate id attributes in the DOM
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { InputBar } from '@/ui/InputBar';

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

// ─── InputBar ────────────────────────────────────────────────────────────────

describe('InputBar — accessibility (#226)', () => {
  it('has no axe violations in default state', async () => {
    const { container } = render(<InputBar onSend={vi.fn()} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('textarea receives id when textareaId prop is provided (WCAG 2.4.1 skip-link target)', () => {
    render(<InputBar onSend={vi.fn()} textareaId="skip-target" />);
    // The skip link in AppLayout targets #skip-target. When isRosterEmpty is false,
    // InputBar holds this id on its textarea so focus lands on a naturally focusable
    // element after the user activates the skip link.
    const textarea = screen.getByRole('textbox');
    expect(textarea.id).toBe('skip-target');
  });

  it('has no axe violations when textareaId is applied (WCAG 2.4.1)', async () => {
    const { container } = render(<InputBar onSend={vi.fn()} textareaId="skip-target" />);
    // Axe must not flag the id assignment itself (e.g. duplicate-id-active).
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('textarea id is absent when textareaId prop is omitted (no orphan id)', () => {
    render(<InputBar onSend={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    // Without textareaId, the textarea must not have an unexpected id.
    expect(textarea.id).toBe('');
  });
});
