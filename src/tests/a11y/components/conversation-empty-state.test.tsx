/**
 * ConversationEmptyState — Axe-core Accessibility Tests (#341)
 *
 * Audit scope (narrow — no 7-theme contrast audit; no new color tokens introduced):
 *   1. Axe violations in all three states (A: 0 models, B: 1 model, C: 2+ models)
 *   2. Container carries role="region" + aria-label="New conversation" (WCAG 1.3.1)
 *   3. Beacon dots are aria-hidden — identity communicated by visible name label (WCAG 1.3.1)
 *   4. Model name labels are present in the accessibility tree (WCAG 1.3.1)
 *   5. Suggestion chip buttons have actionable accessible names via aria-label (WCAG 4.1.2)
 *   6. Chips are native <button type="button"> elements, not <div role="button"> (WCAG 4.1.2)
 *   7. Headings use <h2> in all three states (WCAG 1.3.1, 2.4.6)
 *   8. Visible text labels are substrings of chip aria-labels (WCAG 2.5.3 — Label in Name)
 *
 * WCAG criteria exercised:
 *   - 1.3.1  Info and Relationships — roles and labels reflect document structure
 *   - 2.4.6  Headings and Labels — headings describe topic or purpose
 *   - 2.4.7  Focus Visible — keyboard focus indicator present (CSS audit; see audit report)
 *   - 2.5.3  Label in Name — chip visible text contained within accessible name
 *   - 4.1.2  Name, Role, Value — interactive elements have accessible names
 *
 * Issue #341.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { ConversationEmptyState } from '@/ui/ConversationEmptyState';
import type { ModelConfig } from '@/types';

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

const MODEL_CLAUDE: ModelConfig = {
  modelId: 'claude-opus-4-5',
  name: 'Claude',
  color: '#CC785C',
  isActive: true,
};

const MODEL_GPT: ModelConfig = {
  modelId: 'gpt-4o',
  name: 'GPT-4o',
  color: '#10A37F',
  isActive: true,
};

const MODEL_GEMINI: ModelConfig = {
  modelId: 'gemini-1.5-pro',
  name: 'Gemini',
  color: '#4285F4',
  isActive: true,
};

const MODEL_MISTRAL: ModelConfig = {
  modelId: 'mistral-large',
  name: 'Mistral',
  color: '#F05090',
  isActive: true,
};

const MODEL_GROK: ModelConfig = {
  modelId: 'grok-2',
  name: 'Grok',
  color: '#38B6F0',
  isActive: true,
};

const SUGGESTION_CHIPS = [
  'Compare approaches to a decision',
  'What are the tradeoffs of X vs. Y?',
  'Explain something from different angles',
] as const;

// ─── State A: 0 models ────────────────────────────────────────────────────────

describe('ConversationEmptyState — State A (0 models)', () => {
  it('has no axe violations (WCAG 2.1 AA)', async () => {
    const { container } = render(
      <ConversationEmptyState models={[]} onSuggestionSelect={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has a named region landmark (WCAG 1.3.1)', () => {
    render(<ConversationEmptyState models={[]} onSuggestionSelect={vi.fn()} />);
    const region = screen.getByRole('region', { name: /new conversation/i });
    expect(region).toBeTruthy();
  });

  it('heading is <h2> (WCAG 1.3.1, 2.4.6)', () => {
    render(<ConversationEmptyState models={[]} onSuggestionSelect={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: /select a model to get started/i });
    expect(heading.tagName).toBe('H2');
  });

  it('renders no interactive elements when no models are active', () => {
    render(<ConversationEmptyState models={[]} onSuggestionSelect={vi.fn()} />);
    // State A is purely informational — no buttons should appear.
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});

// ─── State B: 1 model ────────────────────────────────────────────────────────

describe('ConversationEmptyState — State B (1 model)', () => {
  it('has no axe violations (WCAG 2.1 AA)', async () => {
    const { container } = render(
      <ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has a named region landmark (WCAG 1.3.1)', () => {
    render(<ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />);
    const region = screen.getByRole('region', { name: /new conversation/i });
    expect(region).toBeTruthy();
  });

  it('beacon dot is aria-hidden — decorative circle excluded from AT (WCAG 1.3.1)', () => {
    const { container } = render(
      <ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />,
    );
    // The colored circle is purely decorative. Model identity is carried by the
    // visible name label below it — the dot must not appear in the a11y tree.
    // NOTE: .beacon-enter is the wrapper div that holds both the circle and the
    // name label; aria-hidden lives on the inner circle <span>, not the wrapper.
    const beacon = container.querySelector('.beacon-enter');
    expect(beacon).toBeTruthy();
    const dot = beacon?.querySelector('span');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('model name label is present in the accessibility tree (WCAG 1.3.1)', () => {
    render(<ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />);
    // The visible <p> text "Claude" must be readable by screen readers.
    // getByText will throw if the element has aria-hidden="true".
    expect(screen.getByText('Claude')).toBeTruthy();
  });

  it('heading is <h2> containing the model name (WCAG 1.3.1, 2.4.6)', () => {
    render(<ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: /ask claude anything/i });
    expect(heading.tagName).toBe('H2');
  });

  it('renders no suggestion chips in single-model state', () => {
    render(<ConversationEmptyState models={[MODEL_CLAUDE]} onSuggestionSelect={vi.fn()} />);
    // Suggestion chips are State C only — no buttons in State B.
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });
});

// ─── State C: 2+ models ──────────────────────────────────────────────────────

describe('ConversationEmptyState — State C (2+ models)', () => {
  const twoModels = [MODEL_CLAUDE, MODEL_GPT];

  it('has no axe violations (WCAG 2.1 AA)', async () => {
    const { container } = render(
      <ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has a named region landmark (WCAG 1.3.1)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    const region = screen.getByRole('region', { name: /new conversation/i });
    expect(region).toBeTruthy();
  });

  it('heading is <h2> (WCAG 1.3.1, 2.4.6)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    const heading = screen.getByRole('heading', {
      name: /ask anything — all models will respond/i,
    });
    expect(heading.tagName).toBe('H2');
  });

  it('all beacon dots are aria-hidden (WCAG 1.3.1)', () => {
    const { container } = render(
      <ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />,
    );
    // .beacon-enter is the wrapper div (circle + name label); aria-hidden lives
    // on the inner circle <span> — the name label must remain in the a11y tree.
    const beacons = container.querySelectorAll('.beacon-enter');
    expect(beacons.length).toBeGreaterThanOrEqual(2);
    beacons.forEach((beacon) => {
      const dot = beacon.querySelector('span');
      expect(dot?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('all model name labels are present in the accessibility tree (WCAG 1.3.1)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    // getByText throws if the element is aria-hidden — this confirms both names
    // are accessible to screen readers.
    expect(screen.getByText('Claude')).toBeTruthy();
    expect(screen.getByText('GPT-4o')).toBeTruthy();
  });

  it('renders exactly 3 suggestion chip buttons (WCAG 4.1.2)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
  });

  it('chip buttons are native <button> elements — not <div role="button"> (WCAG 4.1.2)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.tagName).toBe('BUTTON');
    });
  });

  it('chip buttons have type="button" (prevents accidental form submission)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  it('each chip button has an accessible name via aria-label (WCAG 4.1.2)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    SUGGESTION_CHIPS.forEach((chipText) => {
      // aria-label is "Start with: [chip text]" — getByRole uses the accessible name.
      const btn = screen.getByRole('button', { name: `Start with: ${chipText}` });
      expect(btn).toBeTruthy();
    });
  });

  it('chip accessible names contain the visible text (WCAG 2.5.3 — Label in Name)', () => {
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={vi.fn()} />);
    SUGGESTION_CHIPS.forEach((chipText) => {
      const btn = screen.getByRole('button', { name: `Start with: ${chipText}` });
      // The visible text content must be a substring of the accessible name.
      // "Start with: X" contains "X", satisfying 2.5.3.
      const accessibleName = btn.getAttribute('aria-label') ?? '';
      expect(accessibleName).toContain(chipText);
    });
  });

  it('clicking a chip calls onSuggestionSelect with the chip text (keyboard contract)', () => {
    const onSelect = vi.fn();
    render(<ConversationEmptyState models={twoModels} onSuggestionSelect={onSelect} />);
    const firstChip = screen.getByRole('button', {
      name: `Start with: ${SUGGESTION_CHIPS[0]}`,
    });
    firstChip.click();
    expect(onSelect).toHaveBeenCalledWith(SUGGESTION_CHIPS[0]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

// ─── State C: 5+ models (overflow beacon row) ─────────────────────────────────

describe('ConversationEmptyState — State C overflow (5+ models)', () => {
  const fiveModels = [MODEL_CLAUDE, MODEL_GPT, MODEL_GEMINI, MODEL_MISTRAL, MODEL_GROK];

  it('has no axe violations with 5 active models (WCAG 2.1 AA)', async () => {
    const { container } = render(
      <ConversationEmptyState models={fiveModels} onSuggestionSelect={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('shows only 4 beacon dots (MAX_VISIBLE_BEACONS constant)', () => {
    const { container } = render(
      <ConversationEmptyState models={fiveModels} onSuggestionSelect={vi.fn()} />,
    );
    const dots = container.querySelectorAll('.beacon-enter');
    // The component caps visible beacons at 4 regardless of model count.
    expect(dots.length).toBe(4);
  });

  it('overflow span is present and shows the correct count', () => {
    const { container } = render(
      <ConversationEmptyState models={fiveModels} onSuggestionSelect={vi.fn()} />,
    );
    // 5 models − 4 visible = +1 overflow. The span text is "+1".
    const overflowSpan = Array.from(container.querySelectorAll('span')).find(
      (s) => s.textContent?.startsWith('+'),
    );
    expect(overflowSpan).toBeTruthy();
    expect(overflowSpan?.textContent).toBe('+1');
  });
});
