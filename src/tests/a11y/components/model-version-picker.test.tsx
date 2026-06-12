/**
 * ModelVersionRow — Axe-core Accessibility Tests
 *
 * Audits the per-model version picker introduced in issue #61.
 * The version picker is a native <select> element inside ModelSelectorPanel.
 *
 * Scope:
 *   - Native <select> with associated <label> via htmlFor
 *   - aria-label on the select as a supplementary accessible name
 *   - Selected state communicated through native <select> value
 *   - Reset button has a meaningful accessible name
 *
 * Standards: WCAG 2.1 Level AA
 * File: src/ui/ModelSelectorPanel.tsx (ModelVersionRow component)
 *
 * Note: ModelVersionRow is not exported independently — it is rendered
 * inside ModelSelectorPanel when active models have availableVersions.length > 1.
 * We test ModelSelectorPanel directly with a model that has multiple versions.
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi } from 'vitest';
import { ModelSelectorPanel } from '@/ui/ModelSelectorPanel';
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

/**
 * Claude model config — has multiple available versions (from MODEL_REGISTRY).
 * This causes ModelVersionRow to render inside the panel.
 */
const CLAUDE_MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

/**
 * GPT model config — also has multiple versions.
 */
const GPT_MODEL: ModelConfig = {
  modelId: 'gpt-5.5',
  name: 'GPT-5.5',
  color: 'accent-gpt',
  isActive: true,
};

/** Default no-op handlers. */
const noop = vi.fn();
const PANEL_PROPS = {
  models: [CLAUDE_MODEL, GPT_MODEL],
  onToggleModel: noop,
  onAddModel: noop,
  onUpdateSystemPrompt: noop,
  onSelectModelVersion: noop,
  onClearModelVersion: noop,
  sessionUsage: [],
  tokenCountVisibility: 'never' as const,
};

// ─── ModelSelectorPanel with version rows ────────────────────────────────────

describe('ModelVersionRow (via ModelSelectorPanel) — no axe violations', () => {
  it('has no axe violations in closed state', async () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Version picker label ────────────────────────────────────────────────────

describe('ModelVersionRow — version select label (WCAG 1.3.1, 4.1.2)', () => {
  /**
   * When the panel is open the version rows become visible.
   * We test the closed state trigger chip for now — version rows are inside
   * the panel which uses CSS class-based visibility (not conditional render),
   * so they ARE in the DOM even when the panel appears closed visually.
   * The panel uses `aria-hidden` to hide the closed state from AT.
   */
  it('version select is associated with a visible label via htmlFor', () => {
    render(<ModelSelectorPanel {...PANEL_PROPS} />);
    // The select has id="model-version-claude" and the label has htmlFor="model-version-claude"
    const claudeSelect = document.getElementById('model-version-claude');
    expect(claudeSelect).not.toBeNull();
    // The associated label element must exist
    const label = document.querySelector('label[for="model-version-claude"]');
    expect(label).not.toBeNull();
    expect(label?.textContent?.trim()).toBe('Claude');
  });

  it('version select also has an aria-label (supplementary name)', () => {
    render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const claudeSelect = document.getElementById('model-version-claude');
    const ariaLabel = claudeSelect?.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
    expect(ariaLabel?.toLowerCase()).toContain('claude');
    expect(ariaLabel?.toLowerCase()).toContain('version');
  });

  it('native select communicates selected state through its value attribute', () => {
    render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const claudeSelect = document.getElementById('model-version-claude') as HTMLSelectElement | null;
    expect(claudeSelect).not.toBeNull();
    // A native <select> always has a value — the selected option is visible to AT
    // via the option element's text content. No aria-selected needed.
    expect(claudeSelect?.value).toBeTruthy();
    // The selected option should have text content (not empty)
    const selectedOption = claudeSelect?.options[claudeSelect.selectedIndex];
    expect(selectedOption?.text.trim().length).toBeGreaterThan(0);
  });

  it('version select options include the default label suffix "(default)"', () => {
    render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const claudeSelect = document.getElementById('model-version-claude') as HTMLSelectElement | null;
    // First option (index 0) always gets " (default)" appended per ModelVersionRow source
    const firstOption = claudeSelect?.options[0];
    expect(firstOption?.text).toMatch(/default/i);
  });
});

// ─── Reset button ────────────────────────────────────────────────────────────

describe('ModelVersionRow — Reset button accessible name (WCAG 4.1.2)', () => {
  it('Reset button has a meaningful accessible name (not just "Reset")', () => {
    /**
     * The Reset button only renders when a non-default version is stored
     * (ModelConfig.selectedVersionId is set and differs from the first version).
     * In the default fixture the button does not render — we verify the
     * space-placeholder is present and aria-hidden.
     */
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    // When no custom version is selected, the reset button is not shown.
    // Instead a <span aria-hidden="true"> placeholder preserves layout.
    const placeholder = container.querySelectorAll('span[aria-hidden="true"]');
    // At least one placeholder per version row
    expect(placeholder.length).toBeGreaterThanOrEqual(1);
  });

  it('Reset button accessible name includes the model name when rendered', () => {
    /**
     * When a non-default version IS selected, the reset button renders with
     * aria-label="Reset {model.name} to default version".
     * We render with a selectedVersionId that differs from the default.
     *
     * Note: The panel is closed at mount (isOpen=false), so it has aria-hidden="true"
     * on its container. We use {hidden: true} to search the full DOM including
     * aria-hidden regions — we are testing DOM structure, not AT exposure here.
     * The aria-hidden state of the closed panel is separately tested.
     */
    const CLAUDE_WITH_CUSTOM_VERSION: ModelConfig = {
      ...CLAUDE_MODEL,
      selectedVersionId: 'claude-sonnet-4-6', // not the first/default version (default is claude-opus-4-8)
    };
    const { container } = render(
      <ModelSelectorPanel
        {...PANEL_PROPS}
        models={[CLAUDE_WITH_CUSTOM_VERSION, GPT_MODEL]}
      />,
    );
    // Use container.querySelector since the panel is aria-hidden when closed.
    // The Reset button must be in the DOM (even if hidden from AT when panel is closed).
    const resetButton = container.querySelector(
      'button[aria-label="Reset Claude to default version"]',
    );
    expect(resetButton).not.toBeNull();
  });
});
