/**
 * AddModelButton — axe-core + keyboard accessibility tests (#253)
 *
 * Covers the WAI-ARIA Menu Button keyboard contract added in issue #253:
 *   - Trigger button ARIA attributes (aria-haspopup, aria-expanded, aria-label)
 *   - Menu ARIA attributes (role="menu", aria-label)
 *   - Menuitem ARIA attributes (role="menuitem", tabIndex={-1})
 *   - ArrowDown / ArrowUp navigation with wrap-around
 *   - Home / End jump to first / last item
 *   - Escape closes menu and returns focus to trigger
 *   - Tab closes menu without trapping focus
 *   - First menuitem is focused on open (rAF stubbed synchronously)
 *
 * WCAG 2.1 Level AA criteria:
 *   1.3.1 Info and Relationships — roles and labels programmatically determined
 *   2.1.1 Keyboard — all functionality operable via keyboard alone
 *   2.4.3 Focus Order — focus moves to correct target on open/close
 *   2.4.7 Focus Visible — trigger carries focus-visible ring classes
 *   4.1.2 Name, Role, Value — buttons have accessible names and correct roles
 *
 * Testing method: axe-core (automated) + RTL fireEvent (manual keyboard simulation)
 *
 * Note on createPortal: jsdom does not implement createPortal but React Testing
 * Library renders portal content into document.body. Menu items are queried from
 * document.body (not container) when the dropdown is open.
 *
 * Note on rAF: The open-focus useEffect uses requestAnimationFrame. Tests that
 * assert focus after open must stub rAF synchronously so the callback fires
 * within act(). See stubRafSync() below.
 */

import { render, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

import { AddModelButton } from '@/ui/components/model-selector/AddModelButton';
import type { ModelConfig } from '@/types';

// ─── Mock MODEL_REGISTRY ──────────────────────────────────────────────────────
// AddModelButton imports MODEL_REGISTRY from @/models to build a provider-name
// lookup map. Mock to an empty array — tests do not need real provider names.

vi.mock('@/models', () => ({ MODEL_REGISTRY: [] }));

// ─── jsdom environment setup ──────────────────────────────────────────────────

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

// ─── rAF stub utility ─────────────────────────────────────────────────────────
// Stubs requestAnimationFrame with a synchronous implementation so the callback
// fires immediately inside act(). Required for focus assertions after open, since
// the useEffect([isOpen]) schedules focus via rAF.

function stubRafSync(): () => void {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(performance.now());
    return 0;
  };
  return () => {
    window.requestAnimationFrame = original;
  };
}

// ─── Axe assertion helper ─────────────────────────────────────────────────────

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
// Three inactive models so wrap-around (index 2 → 0 and 0 → 2) can be tested.

const MODEL_A: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: false,
};

const MODEL_B: ModelConfig = {
  modelId: 'gpt-5.5',
  name: 'GPT-5.5',
  color: 'accent-gpt',
  isActive: false,
};

const MODEL_C: ModelConfig = {
  modelId: 'gemini',
  name: 'Gemini',
  color: 'accent-gemini',
  isActive: false,
};

const THREE_MODELS = [MODEL_A, MODEL_B, MODEL_C];

// ─── Helper: open the dropdown ────────────────────────────────────────────────

function openDropdown(container: HTMLElement): HTMLButtonElement {
  const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
  fireEvent.click(trigger);
  return trigger;
}

// ─── Helper: get menuitem elements from the portal ────────────────────────────
// Items are rendered into document.body via createPortal — not in container.

function getMenuItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

// ─── Helper: get the menu div ────────────────────────────────────────────────

function getMenu(): HTMLElement | null {
  return document.querySelector('[role="menu"]');
}

// ─── Clean up body portal content after each test ────────────────────────────

afterEach(() => {
  // React unmounts portal content when the component unmounts. RTL's cleanup()
  // handles unmounting. This guard is a safety net for any leaked portal nodes.
  document.querySelectorAll('[role="menu"]').forEach((el) => el.remove());
});

// ─── axe-core: no violations when closed ─────────────────────────────────────

describe('AddModelButton — axe violations (WCAG general)', () => {
  it('has no axe violations when closed', async () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when open (menu node only)', async () => {
    // The dropdown is portalled into document.body via createPortal. Scanning
    // document.body with axe triggers a false-positive "region" violation because
    // the jsdom test document has no <main> or other landmark wrapper — axe sees
    // the portal node as "orphaned" content outside any landmark region. This is
    // not a real violation: the component renders inside a fully structured page
    // in production. To test the menu's own ARIA attributes without the
    // false-positive, we scan only the menu node itself.
    //
    // WCAG criterion: 1.3.1 Info and Relationships (role, aria-label correctness).
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu() as HTMLElement;
    expect(menu).not.toBeNull();
    const results = await axe(menu);
    assertNoViolations(results);
  });
});

// ─── ARIA semantics — trigger button (WCAG 4.1.2, 1.3.1) ────────────────────

describe('AddModelButton — trigger ARIA semantics (WCAG 4.1.2)', () => {
  it('trigger has aria-haspopup="menu"', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = container.querySelector('button') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('trigger has aria-label="Add model to conversation"', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = container.querySelector('button') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Add model to conversation');
  });

  it('trigger has aria-expanded="false" when closed', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = container.querySelector('button') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('trigger has aria-expanded="true" when open', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = openDropdown(container);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('trigger aria-expanded returns to "false" after closing', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = openDropdown(container);
    // Click again to close
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('trigger carries focus-visible ring classes (WCAG 2.4.7)', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = container.querySelector('button') as HTMLButtonElement;
    expect(trigger.className).toContain('focus-visible:outline-none');
    expect(trigger.className).toContain('focus-visible:ring-2');
    expect(trigger.className).toContain('focus-visible:ring-focus');
  });
});

// ─── ARIA semantics — menu and menuitems (WCAG 4.1.2, 1.3.1) ────────────────

describe('AddModelButton — menu/menuitem ARIA semantics (WCAG 4.1.2)', () => {
  it('menu div has role="menu"', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu();
    expect(menu).not.toBeNull();
    expect(menu?.getAttribute('role')).toBe('menu');
  });

  it('menu div has aria-label="Available models"', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu();
    expect(menu?.getAttribute('aria-label')).toBe('Available models');
  });

  it('all items have role="menuitem"', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const items = getMenuItems();
    expect(items).toHaveLength(3);
    for (const item of items) {
      expect(item.getAttribute('role')).toBe('menuitem');
    }
  });

  it('all menuitems have tabIndex={-1} (programmatic focus only)', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const items = getMenuItems();
    for (const item of items) {
      expect(item.tabIndex).toBe(-1);
    }
  });

  it('no menu is rendered when closed', () => {
    render(<AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />);
    expect(getMenu()).toBeNull();
  });
});

// ─── Focus management on open (WCAG 2.4.3) ───────────────────────────────────

describe('AddModelButton — focus on open (WCAG 2.4.3)', () => {
  it('first menuitem receives focus when menu opens (rAF stubbed sync)', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => {
        openDropdown(container);
      });
      const items = getMenuItems();
      expect(items.length).toBeGreaterThan(0);
      expect(document.activeElement).toBe(items[0]);
    } finally {
      restoreRaf();
    }
  });
});

// ─── Keyboard navigation — ArrowDown (WCAG 2.1.1) ────────────────────────────
//
// Arrow-key navigation relies on activeFocusIndexRef, which is set by:
//   1. The open-focus rAF (sets index to 0)
//   2. Each subsequent ArrowDown / ArrowUp / Home / End key press
//
// Calling items[n].focus() directly bypasses the ref and produces wrong results.
// Tests below use the rAF stub to establish the starting ref value at 0 on open,
// then advance via arrow keys — matching real keyboard usage precisely.

describe('AddModelButton — ArrowDown keyboard navigation (WCAG 2.1.1)', () => {
  it('ArrowDown from first item moves focus to second item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // After open with rAF stub: focus is on items[0], ref=0
      expect(document.activeElement).toBe(items[0]);

      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[1]);
    } finally {
      restoreRaf();
    }
  });

  it('ArrowDown from middle item moves to next item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // Start at item[0], advance to item[1], then item[2]
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // → items[1]
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // → items[2]
      expect(document.activeElement).toBe(items[2]);
    } finally {
      restoreRaf();
    }
  });

  it('ArrowDown from last item wraps to first item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // Advance to last item: items[0] → items[1] → items[2]
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[2]);

      // One more ArrowDown from last wraps to first
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
      expect(document.activeElement).toBe(items[0]);
    } finally {
      restoreRaf();
    }
  });
});

// ─── Keyboard navigation — ArrowUp (WCAG 2.1.1) ──────────────────────────────

describe('AddModelButton — ArrowUp keyboard navigation (WCAG 2.1.1)', () => {
  it('ArrowUp from first item wraps to last item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // After open: ref=0, focus at items[0]. ArrowUp from first wraps to last.
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      expect(document.activeElement).toBe(items[2]);
    } finally {
      restoreRaf();
    }
  });

  it('ArrowUp from last item moves to second item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // Navigate to last item via End key, then ArrowUp
      fireEvent.keyDown(menu, { key: 'End' }); // → items[2]
      expect(document.activeElement).toBe(items[2]);
      fireEvent.keyDown(menu, { key: 'ArrowUp' }); // → items[1]
      expect(document.activeElement).toBe(items[1]);
    } finally {
      restoreRaf();
    }
  });

  it('ArrowUp from second item moves focus to first item', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // Navigate to item[1] via ArrowDown, then ArrowUp back to item[0]
      fireEvent.keyDown(menu, { key: 'ArrowDown' }); // → items[1]
      expect(document.activeElement).toBe(items[1]);
      fireEvent.keyDown(menu, { key: 'ArrowUp' }); // → items[0]
      expect(document.activeElement).toBe(items[0]);
    } finally {
      restoreRaf();
    }
  });
});

// ─── Keyboard navigation — Home / End (WCAG 2.1.1) ───────────────────────────
//
// Home and End jump the ref to 0 / items.length-1 and call focus directly.
// They do not depend on the current ref value for the destination, so they
// work correctly from any starting position — but the ref must be initialized
// (via rAF stub on open) to a valid index before keyboard events fire.

describe('AddModelButton — Home/End keyboard navigation (WCAG 2.1.1)', () => {
  it('End key moves focus to last item from first position', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // After open: focus at items[0]. End should jump to items[2].
      expect(document.activeElement).toBe(items[0]);
      fireEvent.keyDown(menu, { key: 'End' });
      expect(document.activeElement).toBe(items[2]);
    } finally {
      restoreRaf();
    }
  });

  it('Home key moves focus to first item from last position', () => {
    const restoreRaf = stubRafSync();
    try {
      const { container } = render(
        <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
      );
      act(() => { openDropdown(container); });
      const menu = getMenu() as HTMLElement;
      const items = getMenuItems();
      // Navigate to last via End, then Home should return to first.
      fireEvent.keyDown(menu, { key: 'End' }); // → items[2]
      expect(document.activeElement).toBe(items[2]);
      fireEvent.keyDown(menu, { key: 'Home' }); // → items[0]
      expect(document.activeElement).toBe(items[0]);
    } finally {
      restoreRaf();
    }
  });
});

// ─── Keyboard navigation — Escape (WCAG 2.1.1, 2.4.3) ───────────────────────

describe('AddModelButton — Escape closes menu and returns focus (WCAG 2.1.1, 2.4.3)', () => {
  it('Escape closes the menu', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu() as HTMLElement;

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(getMenu()).toBeNull();
  });

  it('Escape returns focus to the trigger button (WCAG 2.4.3)', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = openDropdown(container);
    const menu = getMenu() as HTMLElement;

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(document.activeElement).toBe(trigger);
  });

  it('trigger aria-expanded is "false" after Escape', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    const trigger = openDropdown(container);
    const menu = getMenu() as HTMLElement;

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});

// ─── Keyboard navigation — Tab (no focus trap) (WCAG 2.1.2) ─────────────────

describe('AddModelButton — Tab closes menu without trapping focus (WCAG 2.1.2)', () => {
  it('Tab closes the menu', () => {
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu() as HTMLElement;

    fireEvent.keyDown(menu, { key: 'Tab' });

    expect(getMenu()).toBeNull();
  });

  it('Tab does not call e.preventDefault (natural Tab flow is preserved)', () => {
    // We verify that the Tab handler does not call e.preventDefault(), which
    // would trap focus. fireEvent.keyDown creates a synthetic React event with
    // a defaultPrevented property we can inspect by wrapping it.
    // Strategy: fire Tab, then check the menu is gone (handler ran) and rely on
    // the source inspection in the component: Tab branch calls closeDropdown()
    // without e.preventDefault(). jsdom does not move focus on Tab natively.
    const { container } = render(
      <AddModelButton availableModels={THREE_MODELS} onAdd={vi.fn()} />,
    );
    openDropdown(container);
    const menu = getMenu() as HTMLElement;

    // Fire via native DOM so we can inspect defaultPrevented
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    // Wrap in act because React state updates happen synchronously in test mode
    act(() => { menu.dispatchEvent(event); });

    // defaultPrevented would be true only if e.preventDefault() was called
    expect(event.defaultPrevented).toBe(false);
    // Menu should still be closed (closeDropdown was called by React handler)
    // Note: native DOM events do reach React synthetic handlers in jsdom
  });
});

// ─── Renders nothing when all models active ───────────────────────────────────

describe('AddModelButton — renders null when no inactive models', () => {
  it('returns null when availableModels is empty', () => {
    const { container } = render(
      <AddModelButton availableModels={[]} onAdd={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
