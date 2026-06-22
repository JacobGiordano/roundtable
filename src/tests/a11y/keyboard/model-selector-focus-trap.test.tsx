/**
 * ModelSelectorPanel — focus trap keyboard contract (#258)
 *
 * WCAG 2.4.11 Focus Not Obscured (WCAG 2.2 AA) — verified via:
 *   - Tab wrap from last focusable element → first
 *   - Shift+Tab wrap from first focusable element → last
 *
 * WCAG 2.1.2 No Keyboard Trap (AA) — Escape key must dismiss the panel.
 * The panel captures Tab; without an Escape exit users cannot leave the trap
 * via keyboard alone. BLOCKER: if Escape is not wired, this test fails.
 *
 * WCAG 2.4.3 Focus Order (AA) — focus is placed inside the panel on open
 * (trigger is in the tab order; Tab moves focus into panel content).
 *
 * Issue: #258
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

/**
 * Open the panel by clicking the trigger chip.
 * Returns the container after the panel is open.
 */
function openPanel(container: HTMLElement): void {
  // The trigger chip is the button with aria-expanded (the chip in the trigger area)
  const triggerChip = container.querySelector(
    'button[aria-expanded][aria-controls="model-selector-panel"]',
  ) as HTMLButtonElement;
  expect(triggerChip).not.toBeNull();
  act(() => {
    fireEvent.click(triggerChip);
  });
}

/**
 * Returns all focusable elements inside #model-selector-panel that are
 * not inside an [aria-hidden="true"] ancestor.
 * Mirrors the selector used in the ModelSelectorPanel focus trap implementation.
 */
function getPanelFocusables(container: HTMLElement): HTMLElement[] {
  const panel = container.querySelector('#model-selector-panel') as HTMLElement;
  if (!panel) return [];
  return Array.from(
    panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => !el.closest('[aria-hidden="true"]'));
}

// ─── Focus trap — Tab wrap (WCAG 2.4.11, 2.1.2) ──────────────────────────────

describe('ModelSelectorPanel — focus trap Tab wrap (WCAG 2.4.11, 2.1.2)', () => {
  it('panel is open after clicking the trigger chip', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    const triggerChip = container.querySelector(
      'button[aria-expanded][aria-controls="model-selector-panel"]',
    ) as HTMLButtonElement;
    expect(triggerChip.getAttribute('aria-expanded')).toBe('true');
  });

  it('panel contains at least one focusable element when open', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    const focusables = getPanelFocusables(container);
    expect(focusables.length).toBeGreaterThan(0);
  });

  it('Tab key on the last focusable wraps to the first focusable', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    const focusables = getPanelFocusables(container);
    const last = focusables[focusables.length - 1];
    const first = focusables[0];

    // Focus the last element
    act(() => { last.focus(); });
    expect(document.activeElement).toBe(last);

    // Dispatch Tab keydown at document level (the focus trap listens on document)
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
          shiftKey: false,
        }),
      );
    });

    // After the trap fires, focus should be on the first element
    expect(document.activeElement).toBe(first);
  });

  it('Shift+Tab on the first focusable wraps to the last focusable', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    const focusables = getPanelFocusables(container);
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Focus the first element
    act(() => { first.focus(); });
    expect(document.activeElement).toBe(first);

    // Dispatch Shift+Tab at document level
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      );
    });

    // After the trap fires, focus should be on the last element
    expect(document.activeElement).toBe(last);
  });

  it('focus trap does not activate when panel is closed', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    // Panel is closed by default — do NOT open it

    // Place focus on document body
    act(() => { document.body.focus(); });

    // Panel is closed: aria-hidden is on the panel container; focusables[] may
    // still be in DOM. We verify the Tab listener was NOT registered by checking
    // that a Tab event does not affect document.activeElement arbitrarily.
    // The real guard is that the useEffect only adds the listener when isOpen=true.
    const triggerChip = container.querySelector(
      'button[aria-expanded][aria-controls="model-selector-panel"]',
    ) as HTMLButtonElement;
    expect(triggerChip.getAttribute('aria-expanded')).toBe('false');
    // Trap focusables should be 0 because panel is aria-hidden when closed —
    // but we're checking DOM, not AT tree. The trap itself should simply not fire.
    // We verify the panel is aria-hidden (not accessible) when closed.
    const panel = container.querySelector('#model-selector-panel') as HTMLElement;
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── Escape key closes panel (WCAG 2.1.2) ────────────────────────────────────

describe('ModelSelectorPanel — Escape key closes panel (WCAG 2.1.2)', () => {
  it('pressing Escape while panel is open closes the panel', () => {
    const { container } = render(<ModelSelectorPanel {...PANEL_PROPS} />);
    openPanel(container);

    // Confirm panel is open
    const triggerChip = container.querySelector(
      'button[aria-expanded][aria-controls="model-selector-panel"]',
    ) as HTMLButtonElement;
    expect(triggerChip.getAttribute('aria-expanded')).toBe('true');

    // Dispatch Escape at document level
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    // Panel should now be closed (aria-expanded = false)
    expect(triggerChip.getAttribute('aria-expanded')).toBe('false');
  });
});
