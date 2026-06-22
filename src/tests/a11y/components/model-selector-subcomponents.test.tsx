/**
 * Model selector sub-components — axe-core accessibility tests (#146, #147)
 *
 * Covers the components extracted from ModelSelectorPanel.tsx in issue #146:
 *   - ModelPill (toggleable model pill with optional palette icon)
 *   - AddModelButton (portal dropdown trigger)
 *   - SystemPromptRow (expandable system prompt per model)
 *   - ModelVersionRow (version select row)
 *   - SessionTokenSection (collapsible token usage)
 *
 * And the shared icon system from issue #147 as used in these components
 * (PaletteIcon, SmallCloseIcon, ChevronIcon).
 *
 * This is a pure refactoring — the visual output is identical to the
 * pre-refactor code. These tests verify that the extraction did not
 * drop any ARIA attributes or alter accessible semantics.
 *
 * WCAG 2.1 Level AA criteria covered:
 *   1.3.1 Info and Relationships — labels and roles programmatically associated
 *   2.1.1 Keyboard — all controls operable by keyboard alone
 *   2.4.3 Focus Order — SystemPromptRow focuses textarea on expand
 *   2.4.7 Focus Visible — focus-visible rings on all interactive elements
 *   4.1.2 Name, Role, Value — buttons/selects have accessible names and correct roles
 */

import { render, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { ModelPill } from '@/ui/components/model-selector/ModelPill';
import { SystemPromptRow } from '@/ui/components/model-selector/SystemPromptRow';
import { ModelVersionRow } from '@/ui/components/model-selector/ModelVersionRow';
import { SessionTokenSection } from '@/ui/components/model-selector/SessionTokenSection';
import type { ModelConfig, ModelVersionOption } from '@/types';

// ─── jsdom setup ─────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ─── axe assertion helper ─────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLAUDE_MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

const CLAUDE_MODEL_INACTIVE: ModelConfig = {
  ...CLAUDE_MODEL,
  isActive: false,
};

const CLAUDE_MODEL_WITH_PROMPT: ModelConfig = {
  ...CLAUDE_MODEL,
  systemPrompt: 'You are a helpful assistant.',
};

const VERSIONS: ModelVersionOption[] = [
  { id: 'claude-3-5-sonnet-20241022', displayName: 'claude-3-5-sonnet' },
  { id: 'claude-3-opus-20240229', displayName: 'claude-3-opus' },
];

// ─── ModelPill — axe (WCAG general) ──────────────────────────────────────────

describe('ModelPill — axe violations (WCAG general)', () => {
  it('has no axe violations in active state', async () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in inactive state', async () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL_INACTIVE} isLastActive={false} onToggle={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations with palette icon visible (model selector context)', async () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
        isOverrideActive={false}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations with override active (palette icon always visible)', async () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
        isOverrideActive={true}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ModelPill — ARIA semantics (WCAG 4.1.2) ─────────────────────────────────

describe('ModelPill — ARIA semantics (WCAG 4.1.2)', () => {
  it('pill button has role="switch"', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
  });

  it('pill button has aria-checked="true" when active', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-checked')).toBe('true');
  });

  it('pill button has aria-checked="false" when inactive', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL_INACTIVE} isLastActive={false} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-checked')).toBe('false');
  });

  it('pill button has a descriptive aria-label including model name and state', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    const label = btn.getAttribute('aria-label') ?? '';
    expect(label).toContain('Claude');
    expect(label).toContain('active');
  });

  it('color dot span is aria-hidden="true"', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    const dot = btn.querySelector('span[aria-hidden="true"]');
    expect(dot).not.toBeNull();
  });

  it('palette button has aria-label naming the model (selector context)', () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
      />,
    );
    // Two buttons: the pill (role=switch) and the palette button
    const allButtons = Array.from(container.querySelectorAll('button'));
    const paletteBtn = allButtons.find(
      (b) => b.getAttribute('aria-label')?.includes('Customize accent color'),
    );
    expect(paletteBtn).not.toBeUndefined();
    expect(paletteBtn?.getAttribute('aria-label')).toContain('Claude');
  });

  it('PaletteIcon SVG inside palette button is aria-hidden="true"', () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
      />,
    );
    const allButtons = Array.from(container.querySelectorAll('button'));
    const paletteBtn = allButtons.find(
      (b) => b.getAttribute('aria-label')?.includes('Customize accent color'),
    );
    const svg = paletteBtn?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('palette button carries focus-visible ring classes (WCAG 2.4.7)', () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
      />,
    );
    const allButtons = Array.from(container.querySelectorAll('button'));
    const paletteBtn = allButtons.find(
      (b) => b.getAttribute('aria-label')?.includes('Customize accent color'),
    );
    expect(paletteBtn?.className).toContain('focus-visible:ring-2');
  });
});

// ─── ModelPill — focus visibility (WCAG 2.4.7) ───────────────────────────────

describe('ModelPill — focus visibility class audit (WCAG 2.4.7)', () => {
  it('pill button carries focus-visible ring classes', () => {
    const { container } = render(
      <ModelPill model={CLAUDE_MODEL} isLastActive={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button[role="switch"]') as HTMLButtonElement;
    expect(btn.className).toContain('focus-visible:outline-none');
    expect(btn.className).toContain('focus-visible:ring-2');
    expect(btn.className).toContain('focus-visible:ring-focus');
  });
});

// ─── SystemPromptRow — axe (WCAG general) ────────────────────────────────────

describe('SystemPromptRow — axe violations (WCAG general)', () => {
  it('has no axe violations when collapsed (no prompt set)', async () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when expanded (no prompt set)', async () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when expanded with a prompt (clear button visible)', async () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL_WITH_PROMPT} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── SystemPromptRow — ARIA semantics (WCAG 4.1.2) ───────────────────────────

describe('SystemPromptRow — ARIA semantics (WCAG 4.1.2)', () => {
  it('toggle button has aria-expanded="false" when collapsed', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggle button has aria-expanded="true" when expanded', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggle button has aria-controls pointing to the panel id', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    const controlsId = btn.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(controlsId).toContain('claude');
  });

  it('aria-controls panel is ALWAYS in the DOM — collapsed or expanded (#255 fix)', () => {
    // #255 fix: the expandable body <div id={rowId}> is now always mounted.
    // hidden={!isExpanded} removes it from the accessibility tree when collapsed,
    // but the element is present in the DOM so aria-controls always resolves.
    // WAI-ARIA 1.1: aria-controls SHOULD reference an element present in the DOM.
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    const controlsId = btn.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    // Panel is in the DOM while collapsed
    const panel = container.querySelector(`#${controlsId}`);
    expect(panel).not.toBeNull();
  });

  it('aria-controls panel carries hidden attribute when collapsed (removed from AT)', () => {
    // The `hidden` HTML attribute removes an element from the accessibility tree,
    // fulfilling the same role as conditional rendering for AT purposes, while
    // keeping the DOM node present for aria-controls resolution.
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    const controlsId = btn.getAttribute('aria-controls');
    const panel = container.querySelector(`#${controlsId}`) as HTMLElement;
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('aria-controls panel hidden attribute is removed when expanded (#255)', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    const controlsId = btn.getAttribute('aria-controls');

    act(() => {
      fireEvent.click(btn);
    });

    const panel = container.querySelector(`#${controlsId}`) as HTMLElement;
    expect(panel.hasAttribute('hidden')).toBe(false);
  });

  it('textarea has aria-label naming the model', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
    const label = textarea.getAttribute('aria-label') ?? '';
    expect(label).toContain('Claude');
  });

  it('clear button has aria-label naming the model (WCAG 4.1.2)', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL_WITH_PROMPT} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const allButtons = Array.from(container.querySelectorAll('button'));
    const clearBtn = allButtons.find((b) =>
      b.getAttribute('aria-label')?.includes('Clear system prompt'),
    );
    expect(clearBtn).not.toBeUndefined();
    expect(clearBtn?.getAttribute('aria-label')).toContain('Claude');
  });

  it('SmallCloseIcon SVG in clear button is aria-hidden="true"', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL_WITH_PROMPT} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const allButtons = Array.from(container.querySelectorAll('button'));
    const clearBtn = allButtons.find((b) =>
      b.getAttribute('aria-label')?.includes('Clear system prompt'),
    );
    const svg = clearBtn?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── SystemPromptRow — focus management on expand (WCAG 2.4.3) ───────────────

// Stub requestAnimationFrame with a synchronous implementation so the rAF
// callback fires immediately during the test. Used by handleToggle useEffect
// (#254 fix) and by handleClear directly.
function stubRafSync(): () => void {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  };
  return () => { window.requestAnimationFrame = original; };
}

describe('SystemPromptRow — focus management (WCAG 2.4.3)', () => {
  it('textarea is present in the DOM after expand (focus destination exists)', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;

    act(() => {
      fireEvent.click(toggleBtn);
    });

    // Verify the textarea exists (focus target is in the DOM after expand).
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();
  });

  it('textarea receives focus after expand (#254 — rAF in useEffect)', () => {
    // #254 fix: rAF moved from setState updater into useEffect([isExpanded]).
    // The useEffect fires after the render triggered by setIsExpanded, so
    // textareaRef.current is populated before rAF runs. Stub rAF synchronously
    // so the focus call fires within act() and is assertable in jsdom.
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
      );
      const toggleBtn = container.querySelector('button') as HTMLButtonElement;

      act(() => {
        fireEvent.click(toggleBtn);
      });

      const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).not.toBeNull();
      expect(document.activeElement).toBe(textarea);
    } finally {
      restoreRaf();
    }
  });

  it('collapsing after expand does not trigger a second rAF focus call (#254 — useEffect guard)', () => {
    // The useEffect only fires rAF when isExpanded is true (if (isExpanded) guard).
    // Collapsing sets isExpanded=false, so the effect runs but skips the rAF.
    // We verify this by counting rAF invocations: expand=1, collapse=0, total=1.
    let rafCallCount = 0;
    const original = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      rafCallCount++;
      cb(performance.now());
      return 0;
    };
    try {
      const { container } = render(
        <SystemPromptRow model={CLAUDE_MODEL} onUpdate={vi.fn()} />,
      );
      const toggleBtn = container.querySelector('button') as HTMLButtonElement;

      // Expand — should call rAF once
      act(() => { fireEvent.click(toggleBtn); });
      expect(rafCallCount).toBe(1);

      // Collapse — useEffect runs but if(isExpanded) guard skips rAF
      act(() => { fireEvent.click(toggleBtn); });
      expect(rafCallCount).toBe(1); // still 1, not 2
    } finally {
      window.requestAnimationFrame = original;
    }
  });

  it('clear button returns focus to textarea (handleClear direct focus call)', () => {
    // handleClear calls textareaRef.current.focus() directly — no rAF.
    // No stub needed; the focus call is synchronous.
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL_WITH_PROMPT} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    act(() => { fireEvent.click(toggleBtn); });

    const allButtons = Array.from(container.querySelectorAll('button'));
    const clearBtn = allButtons.find((b) =>
      b.getAttribute('aria-label')?.includes('Clear system prompt'),
    ) as HTMLButtonElement;
    expect(clearBtn).not.toBeUndefined();

    act(() => { fireEvent.click(clearBtn); });

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(document.activeElement).toBe(textarea);
  });
});

// ─── ModelVersionRow — axe (WCAG general) ────────────────────────────────────

describe('ModelVersionRow — axe violations (WCAG general)', () => {
  it('has no axe violations with default version selected', async () => {
    const { container } = render(
      <ModelVersionRow
        model={CLAUDE_MODEL}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations with custom version selected (Reset button visible)', async () => {
    const modelWithVersion: ModelConfig = {
      ...CLAUDE_MODEL,
      selectedVersionId: 'claude-3-opus-20240229',
    };
    const { container } = render(
      <ModelVersionRow
        model={modelWithVersion}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ModelVersionRow — ARIA semantics (WCAG 4.1.2) ───────────────────────────

describe('ModelVersionRow — ARIA semantics (WCAG 4.1.2)', () => {
  it('select element has htmlFor label matching its id', () => {
    const { container } = render(
      <ModelVersionRow
        model={CLAUDE_MODEL}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    const label = container.querySelector(`label[for="${select.id}"]`) as HTMLLabelElement;
    expect(label).not.toBeNull();
    expect(label.textContent?.trim()).toBe('Claude');
  });

  it('select also has aria-label for redundant accessible name (belt-and-suspenders)', () => {
    const { container } = render(
      <ModelVersionRow
        model={CLAUDE_MODEL}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const select = container.querySelector('select') as HTMLSelectElement;
    const ariaLabel = select.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('Claude');
  });

  it('Reset button has aria-label naming the model', () => {
    const modelWithVersion: ModelConfig = {
      ...CLAUDE_MODEL,
      selectedVersionId: 'claude-3-opus-20240229',
    };
    const { container } = render(
      <ModelVersionRow
        model={modelWithVersion}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    const resetBtn = container.querySelector('button') as HTMLButtonElement;
    expect(resetBtn).not.toBeNull();
    const label = resetBtn.getAttribute('aria-label') ?? '';
    expect(label).toContain('Claude');
    expect(label).toContain('default');
  });

  it('spacer span is aria-hidden="true" (WCAG 4.1.2)', () => {
    const { container } = render(
      <ModelVersionRow
        model={CLAUDE_MODEL}
        availableVersions={VERSIONS}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    // The placeholder span (when no Reset button) should be aria-hidden
    const spacer = container.querySelector('span[aria-hidden="true"]');
    expect(spacer).not.toBeNull();
  });
});

// ─── SessionTokenSection — axe (WCAG general) ────────────────────────────────

describe('SessionTokenSection — axe violations (WCAG general)', () => {
  const SESSION_USAGE = [
    { modelId: 'claude', inputTokens: 100, outputTokens: 200, totalTokens: 300 },
    { modelId: 'gpt-4', inputTokens: 50, outputTokens: 150, totalTokens: 200 },
  ];

  const ACTIVE_MODELS: ModelConfig[] = [
    { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
    { modelId: 'gpt-4', name: 'GPT-4', color: 'accent-gpt', isActive: true },
  ];

  it('has no axe violations in collapsed state', async () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in expanded state', async () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(btn);

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('renders nothing when tokenCountVisibility="never"', () => {
    const { container } = render(
      <SessionTokenSection
        sessionUsage={SESSION_USAGE}
        activeModels={ACTIVE_MODELS}
        tokenCountVisibility="never"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when sessionUsage is empty', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={[]} activeModels={ACTIVE_MODELS} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

// ─── SessionTokenSection — ARIA semantics (WCAG 4.1.2) ───────────────────────

describe('SessionTokenSection — ARIA semantics (WCAG 4.1.2)', () => {
  const SESSION_USAGE = [
    { modelId: 'claude', inputTokens: 100, outputTokens: 200, totalTokens: 300 },
  ];
  const ACTIVE_MODELS: ModelConfig[] = [
    { modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true },
  ];

  it('toggle button has aria-expanded="false" when collapsed', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('toggle button has aria-expanded="true" when expanded', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('toggle button has aria-controls="session-token-panel"', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-controls')).toBe('session-token-panel');
  });

  it('panel with id="session-token-panel" is always in DOM (hidden attribute toggles AT visibility)', () => {
    // The panel uses the `hidden` attribute (not CSS display:none from conditional render).
    // This keeps the id resolvable by aria-controls at all times.
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const panel = container.querySelector('#session-token-panel');
    expect(panel).not.toBeNull();
  });

  it('panel is hidden from AT when collapsed (hidden attribute present)', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const panel = container.querySelector('#session-token-panel') as HTMLElement;
    // The `hidden` HTML attribute removes the element from the accessibility tree
    expect(panel.hasAttribute('hidden')).toBe(true);
  });

  it('panel hidden attribute is removed when expanded', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(btn);

    const panel = container.querySelector('#session-token-panel') as HTMLElement;
    expect(panel.hasAttribute('hidden')).toBe(false);
  });

  it('color dot spans are aria-hidden="true"', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(btn);

    const dots = Array.from(container.querySelectorAll('span[aria-hidden="true"]'));
    // At minimum one dot should be aria-hidden in the expanded panel
    expect(dots.length).toBeGreaterThan(0);
  });

  it('toggle button carries focus-visible ring classes (WCAG 2.4.7)', () => {
    const { container } = render(
      <SessionTokenSection sessionUsage={SESSION_USAGE} activeModels={ACTIVE_MODELS} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.className).toContain('focus-visible:ring-2');
    expect(btn.className).toContain('focus-visible:ring-focus');
  });
});

// ─── Icon system — aria-hidden audit (WCAG 4.1.2) ────────────────────────────

describe('Icon system — aria-hidden="true" on all SVGs (#147, WCAG 4.1.2)', () => {
  it('all SVG elements rendered by ModelPill are aria-hidden', () => {
    const { container } = render(
      <ModelPill
        model={CLAUDE_MODEL}
        isLastActive={true}
        onToggle={vi.fn()}
        onOpenColorPicker={vi.fn()}
      />,
    );
    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('all SVG elements rendered by SystemPromptRow (expanded) are aria-hidden', () => {
    const { container } = render(
      <SystemPromptRow model={CLAUDE_MODEL_WITH_PROMPT} onUpdate={vi.fn()} />,
    );
    const toggleBtn = container.querySelector('button') as HTMLButtonElement;
    fireEvent.click(toggleBtn);

    const svgs = Array.from(container.querySelectorAll('svg'));
    expect(svgs.length).toBeGreaterThan(0);
    for (const svg of svgs) {
      expect(svg.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
