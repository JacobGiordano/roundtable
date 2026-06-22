/**
 * ModelSelectorPanel — closed-state inert attribute (#261)
 *
 * WCAG 2.4.3 Focus Order (AA) — when the panel is fully closed (isOpen=false
 * AND isClosing=false), the panel div gains inert="". This removes all
 * descendants from the tab order and the AT tree, preventing keyboard focus
 * from reaching elements that are visually off-screen.
 *
 * The inert attribute must be absent while the panel is open OR mid-close
 * animation (isClosing=true), because the panel is still visible during the
 * animation and the focus trap must continue to operate.
 *
 * These tests verify the inert/aria-hidden synchronization contract:
 *   - Closed (not animating): inert="" + aria-hidden="true"
 *   - Open: no inert + aria-hidden="false" (i.e. attribute absent or "false")
 *   - Closing animation in progress: no inert + aria-hidden="true"
 *     (isClosing branch: aria-hidden fires immediately on close, inert waits)
 *
 * Issue: #261
 */

import { render, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { ModelSelectorPanel } from '@/ui/ModelSelectorPanel';
import type { ModelConfig } from '@/types';

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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CLAUDE_MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

const GPT_MODEL: ModelConfig = {
  modelId: 'gpt-5.5',
  name: 'GPT-5.5',
  color: 'accent-gpt',
  isActive: true,
};

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPanel(container: HTMLElement): HTMLElement {
  const panel = container.querySelector('#model-selector-panel') as HTMLElement | null;
  expect(panel).not.toBeNull();
  return panel!;
}

function getTriggerChip(container: HTMLElement): HTMLButtonElement {
  const chip = container.querySelector(
    'button[aria-expanded][aria-controls="model-selector-panel"]',
  ) as HTMLButtonElement | null;
  expect(chip).not.toBeNull();
  return chip!;
}

function openPanel(container: HTMLElement): void {
  act(() => {
    fireEvent.click(getTriggerChip(container));
  });
}

function closePanel(container: HTMLElement): void {
  act(() => {
    fireEvent.click(getTriggerChip(container));
  });
}

// ─── WCAG 2.4.3 — panel inert when fully closed (#261) ───────────────────────

describe('ModelSelectorPanel — inert when fully closed (WCAG 2.4.3, #261)', () => {
  it('panel has inert="" on initial render (closed, not animating)', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const panel = getPanel(container);
    // Panel starts closed (isOpen=false, isClosing=false) — inert must be applied.
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.getAttribute('inert')).toBe('');
  });

  it('panel does NOT have inert while open', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    const panel = getPanel(container);
    // While open (isOpen=true), inert must be absent.
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('panel inert is removed when opened from closed state', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const panel = getPanel(container);

    // Starts inert (closed)
    expect(panel.hasAttribute('inert')).toBe(true);

    openPanel(container);

    // After opening, inert must be gone
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('aria-hidden and inert are both absent (or false) when panel is open', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    const panel = getPanel(container);
    // Both attributes must be absent when open — two attributes must stay in sync.
    expect(panel.hasAttribute('inert')).toBe(false);
    // aria-hidden is set to false (attribute present with value "false") or absent.
    // The component sets aria-hidden={!isOpen && !isClosing}, which resolves to false
    // when open — React renders aria-hidden="false" in this case.
    const ariaHidden = panel.getAttribute('aria-hidden');
    expect(ariaHidden === null || ariaHidden === 'false').toBe(true);
  });

  it('aria-hidden="true" and inert="" are both present when panel is fully closed', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    const panel = getPanel(container);
    // Initial state: closed (isOpen=false, isClosing=false).
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.getAttribute('inert')).toBe('');
  });
});

// ─── WCAG 2.4.3 — isClosing animation window (#261) ─────────────────────────
//
// During the closing animation (isClosing=true, isOpen=false), aria-hidden fires
// immediately but inert must NOT be applied — the panel is still visible and
// focus trap must still operate. inert is only applied after transitionend fires
// and isClosing resets to false.
//
// jsdom does not fire transitionend events automatically. We verify the
// intermediate state directly: after clicking close, before transitionend fires,
// inert must still be absent.

describe('ModelSelectorPanel — inert absent during closing animation (WCAG 2.4.3, #261)', () => {
  it('panel does NOT have inert immediately after close click (isClosing=true window)', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    // Confirm open
    expect(getPanel(container).hasAttribute('inert')).toBe(false);

    // Click close — this sets isClosing=true, isOpen=false.
    // In jsdom transitionend is never fired automatically, so isClosing stays true.
    closePanel(container);

    const panel = getPanel(container);
    // isClosing=true → condition (!isOpen && !isClosing) is false → inert must be absent.
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('panel has aria-hidden="false" and no inert during closing animation', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    closePanel(container);

    const panel = getPanel(container);
    // aria-hidden={!isOpen && !isClosing}: when isClosing=true, isOpen=false →
    // !false && !true = false → aria-hidden="false". The panel is still visible
    // during animation, so aria-hidden must NOT be "true" here.
    const ariaHidden = panel.getAttribute('aria-hidden');
    expect(ariaHidden === null || ariaHidden === 'false').toBe(true);
    // inert condition is also !isOpen && !isClosing → false → inert must be absent.
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('panel gains inert after transitionend clears isClosing', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    closePanel(container);

    const panel = getPanel(container);
    // Still mid-animation: no inert
    expect(panel.hasAttribute('inert')).toBe(false);

    // Simulate transitionend — this fires handleTransitionEnd which sets isClosing=false.
    act(() => {
      fireEvent.transitionEnd(panel);
    });

    // After transitionend: isOpen=false, isClosing=false → inert must be applied.
    expect(panel.hasAttribute('inert')).toBe(true);
    expect(panel.getAttribute('inert')).toBe('');
  });
});

// ─── WCAG 2.4.3 — trigger chip aria-expanded sync (#261) ─────────────────────

describe('ModelSelectorPanel — trigger chip aria-expanded stays in sync (#261)', () => {
  it('aria-expanded=false on initial render', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    expect(getTriggerChip(container).getAttribute('aria-expanded')).toBe('false');
  });

  it('aria-expanded=true when panel is open', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    expect(getTriggerChip(container).getAttribute('aria-expanded')).toBe('true');
  });

  it('aria-expanded=false after close click (before transitionend)', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);
    closePanel(container);
    // aria-expanded tracks isOpen, which flips to false on close click.
    expect(getTriggerChip(container).getAttribute('aria-expanded')).toBe('false');
  });
});

// ─── Regression: focus trap unaffected by inert change (#261) ────────────────
//
// The inert attribute is spread on the panel div only when fully closed.
// When open, the focus trap useEffect must still be active. This test confirms
// the focus trap is not disrupted by the inert logic.

describe('ModelSelectorPanel — focus trap unaffected by inert change (WCAG 2.1.2, #261)', () => {
  it('panel contains focusable elements when open (trap can operate)', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    const panel = getPanel(container);
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('[aria-hidden="true"]'));

    expect(focusables.length).toBeGreaterThan(0);
  });

  it('Escape key closes panel and aria-expanded returns to false', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    expect(getTriggerChip(container).getAttribute('aria-expanded')).toBe('true');

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(getTriggerChip(container).getAttribute('aria-expanded')).toBe('false');
  });
});
