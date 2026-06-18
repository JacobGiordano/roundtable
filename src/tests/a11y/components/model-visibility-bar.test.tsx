/**
 * ModelVisibilityBar — Axe-core Accessibility Tests (#229)
 *
 * Audit scope:
 *   - aria-pressed toggle buttons are correctly announced
 *   - aria-disabled="true" on the last-visible button is axe-clean
 *     (no aria-allowed-attr or button-name violations)
 *   - Native <button> (no disabled attr) is in tab order regardless of
 *     isLastVisible state — keyboard reach is preserved
 *   - Click guard prevents toggle when isLastVisible (behavioral, not ARIA)
 *
 * WCAG criteria:
 *   - 1.3.1 Info and Relationships — pressed state communicated via aria-pressed
 *   - 2.1.1 Keyboard — all buttons reachable without disabled attr
 *   - 4.1.2 Name, Role, Value — aria-label, aria-pressed, aria-disabled present
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import type { ModelConfig, ModelId } from '@/types';

// ─── Minimal ModelVisibilityBar re-implementation for isolated testing ────────
//
// ModelVisibilityBar is a local function component inside MessageThread.tsx —
// it is not exported. We reproduce the exact markup here so the test stays
// self-contained and does not require full MessageThread rendering (which
// pulls in a large dependency tree including storage, auth, and streaming).
//
// If the implementation changes, this fixture must be updated to match.

interface ModelVisibilityBarProps {
  models: ModelConfig[];
  hiddenModelIds: Set<ModelId>;
  onToggleVisibility: (modelId: ModelId) => void;
}

function ModelVisibilityBarFixture({ models, hiddenModelIds, onToggleVisibility }: ModelVisibilityBarProps) {
  if (models.length < 2) return null;

  const visibleCount = models.length - hiddenModelIds.size;

  return (
    <div
      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-border"
      role="group"
      aria-label="Model visibility"
    >
      <span className="text-[11px] text-text-muted font-medium mr-1 flex-shrink-0">Show:</span>
      {models.map((model) => {
        const isVisible = !hiddenModelIds.has(model.modelId);
        const isLastVisible = isVisible && visibleCount === 1;

        return (
          <button
            key={model.modelId}
            type="button"
            aria-pressed={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} ${model.name}`}
            aria-disabled={isLastVisible ? true : undefined}
            onClick={() => { if (!isLastVisible) onToggleVisibility(model.modelId); }}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
              'border transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              isVisible
                ? 'bg-hover border-border text-text-primary'
                : 'border-transparent text-text-muted',
              isLastVisible
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
            ].join(' ')}
          >
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{ backgroundColor: 'var(--accent-other)' }}
              aria-hidden="true"
            />
            {model.name}
          </button>
        );
      })}
    </div>
  );
}

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

// ─── Test fixtures ────────────────────────────────────────────────────────────

const TWO_MODELS: ModelConfig[] = [
  { modelId: 'claude' as ModelId, name: 'Claude', color: 'accent-claude', isActive: true },
  { modelId: 'gpt-5.5' as ModelId, name: 'GPT', color: 'accent-gpt', isActive: true },
];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ModelVisibilityBar — accessibility (#229)', () => {
  it('has no axe violations when both models are visible', async () => {
    const { container } = render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set()}
        onToggleVisibility={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when the last-visible model has aria-disabled', async () => {
    // One model is hidden — the remaining visible one gets aria-disabled.
    // This verifies axe accepts aria-disabled on a native <button> without
    // flagging aria-allowed-attr or aria-prohibited-attr violations.
    const { container } = render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set(['gpt-5.5' as ModelId])}
        onToggleVisibility={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when one model is hidden (non-last visible)', async () => {
    // GPT is hidden; Claude is visible but NOT the last visible (well, it is in this
    // case — but the hidden button also has aria-pressed=false, no aria-disabled).
    // This test verifies the hidden-model button markup is axe-clean.
    const { container } = render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set(['claude' as ModelId])}
        onToggleVisibility={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  // ─── WCAG 2.1.1 — Keyboard reachability ────────────────────────────────────

  it('last-visible button is in tab order (no disabled attr — WCAG 2.1.1)', () => {
    // The critical change in #229: native disabled attr removed.
    // The button must not have a disabled attribute so it remains keyboard-reachable.
    render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set(['gpt-5.5' as ModelId])}
        onToggleVisibility={vi.fn()}
      />,
    );
    // GPT is hidden → Claude is the last visible, so Claude's button gets aria-disabled.
    const claudeButton = screen.getByRole('button', { name: /Hide Claude/i });
    expect(claudeButton.hasAttribute('disabled')).toBe(false);
    expect(claudeButton.getAttribute('aria-disabled')).toBe('true');
  });

  // ─── WCAG 4.1.2 — Name, Role, Value ─────────────────────────────────────────

  it('aria-pressed reflects visible state correctly (WCAG 4.1.2)', () => {
    render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set(['gpt-5.5' as ModelId])}
        onToggleVisibility={vi.fn()}
      />,
    );
    const claudeButton = screen.getByRole('button', { name: /Hide Claude/i });
    const gptButton = screen.getByRole('button', { name: /Show GPT/i });

    // Claude is visible → aria-pressed="true"
    expect(claudeButton.getAttribute('aria-pressed')).toBe('true');
    // GPT is hidden → aria-pressed="false"
    expect(gptButton.getAttribute('aria-pressed')).toBe('false');
  });

  // ─── Click guard (behavioral) ─────────────────────────────────────────────

  it('click on last-visible button does not call onToggleVisibility (click guard)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set(['gpt-5.5' as ModelId])}
        onToggleVisibility={onToggle}
      />,
    );

    const claudeButton = screen.getByRole('button', { name: /Hide Claude/i });
    await user.click(claudeButton);

    // The click guard prevents the callback from firing on the last-visible button.
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('click on non-last-visible button calls onToggleVisibility (normal path)', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <ModelVisibilityBarFixture
        models={TWO_MODELS}
        hiddenModelIds={new Set()}
        onToggleVisibility={onToggle}
      />,
    );

    const claudeButton = screen.getByRole('button', { name: /Hide Claude/i });
    await user.click(claudeButton);

    expect(onToggle).toHaveBeenCalledWith('claude');
  });
});
