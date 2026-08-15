/**
 * FontScaleStepper / ReadingSection — Accessibility Tests (#600)
 *
 * Covers the Reading section added to ProviderSettingsPanel in issue #600:
 *   - FontScaleStepper: spinbutton role, ARIA attributes, keyboard semantics,
 *     disabled-state signaling via aria-disabled, and focus-ring classes
 *   - ReadingSection: two FontScaleSteppers + Reset to defaults button
 *
 * Standards: WCAG 2.1 Level AA + WCAG 2.2 §2.5.8 Target Size (Minimum)
 *
 * Testing method:
 *   - axe-core (automated): catches role/ARIA/labeling violations
 *   - Structural assertions (manual-equivalent): verifies spinbutton ARIA
 *     attributes, keyboard handler correctness, and aria-disabled semantics
 *     that axe-core alone does not cover
 *
 * Components under test:
 *   - src/ui/ProviderSettingsPanel.tsx (FontScaleStepper, ReadingSection)
 *
 * Mock strategy: the @/auth module is mocked with stable defaults so tests
 * run without localStorage. getFontScalePreferences returns {ui:1.0,content:1.0}.
 * saveFontScalePreferences is a no-op. document.documentElement.style.setProperty
 * is available in jsdom and does not need mocking.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderSettingsPanel } from '@/ui/ProviderSettingsPanel';

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

// ─── Mock @/auth ──────────────────────────────────────────────────────────────
// ProviderSettingsPanel (and ReadingSection inside it) calls getFontScalePreferences
// and saveFontScalePreferences. We mock them to avoid localStorage in jsdom.

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    getProviderRoster: vi.fn(() => []),
    addBuiltInProvider: vi.fn(),
    addCustomProvider: vi.fn(),
    removeProvider: vi.fn(),
    hasCredential: vi.fn(() => false),
    saveCredentials: vi.fn(),
    clearCredentials: vi.fn(),
    getModelAccentColors: vi.fn(() => ({})),
    getPricingUrl: vi.fn(() => ''),
    savePricingUrl: vi.fn(),
    refreshPricing: vi.fn(() => Promise.resolve()),
    getPricingMetadata: vi.fn(() => ({ lastFetched: null, source: 'fallback' as const })),
    // #600: Font scale mocks — stable defaults so tests are deterministic.
    getFontScalePreferences: vi.fn(() => ({ ui: 1.0, content: 1.0 })),
    saveFontScalePreferences: vi.fn(),
  };
});

// ─── Shared fixture ───────────────────────────────────────────────────────────

const triggerRef = { current: null } as React.RefObject<HTMLButtonElement>;
const noop = vi.fn();

beforeEach(async () => {
  // resetAllMocks clears both call history and mock return values, preventing
  // test-to-test contamination when individual tests override mockReturnValue.
  vi.resetAllMocks();
  // Re-establish the default return values that the top-level vi.mock factory
  // set up, since resetAllMocks wipes them.
  const auth = await import('@/auth');
  vi.mocked(auth.getProviderRoster).mockReturnValue([]);
  vi.mocked(auth.hasCredential).mockReturnValue(false);
  vi.mocked(auth.getModelAccentColors).mockReturnValue({});
  vi.mocked(auth.getPricingUrl).mockReturnValue('');
  vi.mocked(auth.refreshPricing).mockResolvedValue(undefined);
  vi.mocked(auth.getPricingMetadata).mockReturnValue({ lastFetched: null, source: 'fallback' as const });
  vi.mocked(auth.getFontScalePreferences).mockReturnValue({ ui: 1.0, content: 1.0 });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Return the spinbutton for "Interface size" (first stepper). */
function getUiSpinbutton(): HTMLElement {
  return screen.getByRole('spinbutton', { name: 'Interface size' });
}

/** Return the spinbutton for "Message text size" (second stepper). */
function getContentSpinbutton(): HTMLElement {
  return screen.getByRole('spinbutton', { name: 'Message text size' });
}

// ─── Axe: full ReadingSection (WCAG 4.1.2) ───────────────────────────────────

describe('ReadingSection (#600) — axe (WCAG 4.1.2)', () => {
  it('has no axe violations in default state (both scales at 1.0)', async () => {
    const { container } = render(
      <ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Spinbutton role and ARIA attributes (WCAG 4.1.2) ────────────────────────

describe('FontScaleStepper — spinbutton ARIA attributes (#600, WCAG 4.1.2)', () => {
  it('Interface size spinbutton has role="spinbutton"', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('role')).toBe('spinbutton');
  });

  it('Interface size spinbutton has aria-valuenow=100 at default scale', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('aria-valuenow')).toBe('100');
  });

  it('Interface size spinbutton has aria-valuemin=88 (Math.round(0.875*100)=88)', () => {
    // Math.round(87.5) = 88 in JavaScript — the implementation converts the float
    // min (0.875) to an integer percentage via Math.round(). The ARIA integer
    // representation is 88, not 87. Screen readers announce "88" for the minimum.
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('aria-valuemin')).toBe('88');
  });

  it('Interface size spinbutton has aria-valuemax=125 (125% = 1.25)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('aria-valuemax')).toBe('125');
  });

  it('Interface size spinbutton has aria-valuetext="100 percent, default" at 1.0', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('aria-valuetext')).toBe('100 percent, default');
  });

  it('Interface size spinbutton has aria-label="Interface size"', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('aria-label')).toBe('Interface size');
  });

  it('Interface size spinbutton has tabIndex={0} (keyboard reachable)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.getAttribute('tabindex')).toBe('0');
  });

  it('Message text size spinbutton has aria-valuemax=200 (200% = 2.0)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getContentSpinbutton();
    expect(spinbutton.getAttribute('aria-valuemax')).toBe('200');
  });

  it('Message text size spinbutton has aria-label="Message text size"', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getContentSpinbutton();
    expect(spinbutton.getAttribute('aria-label')).toBe('Message text size');
  });
});

// ─── Spinbutton keyboard semantics (WCAG 2.1.1) ──────────────────────────────

describe('FontScaleStepper — spinbutton keyboard semantics (#600, WCAG 2.1.1)', () => {
  it('ArrowUp increments the Interface size spinbutton value', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowUp' });

    // saveFontScalePreferences called with ui > 1.0
    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeGreaterThan(1.0);
  });

  it('ArrowDown decrements the Interface size spinbutton value', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowDown' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeLessThan(1.0);
  });

  it('ArrowRight increments the Interface size spinbutton value', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowRight' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeGreaterThan(1.0);
  });

  it('ArrowLeft decrements the Interface size spinbutton value', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowLeft' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeLessThan(1.0);
  });

  it('Home key sets Interface size to minimum (0.875 → 87%)', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'Home' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    // 0.875 is the min; allow floating-point tolerance
    expect(call.ui).toBeCloseTo(0.875, 5);
  });

  it('End key sets Interface size to maximum (1.25 → 125%)', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'End' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeCloseTo(1.25, 5);
  });

  it('End key sets Message text size to maximum (2.0 → 200%)', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getContentSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'End' });

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.content).toBeCloseTo(2.0, 5);
  });

  it('ArrowUp at max does not call saveFontScalePreferences (clamped)', async () => {
    // Override mock to return max ui value so atMax=true
    const { getFontScalePreferences, saveFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 1.25, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowUp' });

    // increment() is a no-op at max; save must not be called
    expect(saveFontScalePreferences).not.toHaveBeenCalled();
  });

  it('ArrowDown at min does not call saveFontScalePreferences (clamped)', async () => {
    const { getFontScalePreferences, saveFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 0.875, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();

    fireEvent.keyDown(spinbutton, { key: 'ArrowDown' });

    expect(saveFontScalePreferences).not.toHaveBeenCalled();
  });
});

// ─── Stepper buttons — ARIA and disabled semantics (WCAG 4.1.2 / 2.1.1) ──────

describe('FontScaleStepper — stepper buttons (#600, WCAG 4.1.2 / 2.1.1)', () => {
  it('Decrease interface size button has correct aria-label', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.type).toBe('button');
  });

  it('Increase interface size button has correct aria-label', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.type).toBe('button');
  });

  it('Decrease message text size button has correct aria-label', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Decrease message text size"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
  });

  it('Increase message text size button has correct aria-label', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Increase message text size"]',
    ) as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
  });

  it('decrement button uses aria-disabled (not disabled attr) when at min', async () => {
    const { getFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 0.875, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);

    const decrementBtn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(decrementBtn).not.toBeNull();

    // Must use aria-disabled, NOT the HTML disabled attribute — to stay in tab order
    expect(decrementBtn?.getAttribute('aria-disabled')).toBe('true');
    expect(decrementBtn?.hasAttribute('disabled')).toBe(false);
  });

  it('increment button uses aria-disabled (not disabled attr) when at max', async () => {
    const { getFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 1.25, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);

    const incrementBtn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(incrementBtn).not.toBeNull();

    expect(incrementBtn?.getAttribute('aria-disabled')).toBe('true');
    expect(incrementBtn?.hasAttribute('disabled')).toBe(false);
  });

  it('decrement button is not aria-disabled at default scale (not at min)', () => {
    // Default: ui=1.0, which is between min and max
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const decrementBtn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(decrementBtn?.getAttribute('aria-disabled')).toBe('false');
  });

  it('increment button is not aria-disabled at default scale (not at max)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const incrementBtn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(incrementBtn?.getAttribute('aria-disabled')).toBe('false');
  });

  it('decrement button click does not call saveFontScalePreferences when at min', async () => {
    const { getFontScalePreferences, saveFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 0.875, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const decrementBtn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(decrementBtn).not.toBeNull();
    fireEvent.click(decrementBtn!);

    // onClick is undefined when atMin — no save
    expect(saveFontScalePreferences).not.toHaveBeenCalled();
  });

  it('increment button click does not call saveFontScalePreferences when at max', async () => {
    const { getFontScalePreferences, saveFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 1.25, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const incrementBtn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(incrementBtn).not.toBeNull();
    fireEvent.click(incrementBtn!);

    expect(saveFontScalePreferences).not.toHaveBeenCalled();
  });

  it('decrement button click calls saveFontScalePreferences when not at min', async () => {
    const { saveFontScalePreferences } = await import('@/auth');
    // Default mock: ui=1.0, not at min

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const decrementBtn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    fireEvent.click(decrementBtn!);

    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeLessThan(1.0);
  });
});

// ─── Reset button — ARIA and disabled semantics (WCAG 4.1.2 / 2.1.1) ─────────

describe('ReadingSection — Reset button (#600, WCAG 4.1.2 / 2.1.1)', () => {
  it('Reset button has aria-label="Reset interface size and message text size to defaults"', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    expect(resetBtn).not.toBeNull();
    expect(resetBtn?.type).toBe('button');
  });

  it('Reset button is aria-disabled when both scales are at default', () => {
    // Default mock: ui=1.0, content=1.0 → bothAtDefault=true
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    expect(resetBtn).not.toBeNull();
    expect(resetBtn?.getAttribute('aria-disabled')).toBe('true');
    // Must NOT use HTML disabled attribute — must stay in tab order
    expect(resetBtn?.hasAttribute('disabled')).toBe(false);
  });

  it('Reset button is not aria-disabled when ui scale differs from default', async () => {
    const { getFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 1.125, content: 1.0 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    expect(resetBtn?.getAttribute('aria-disabled')).toBe('false');
  });

  it('Reset button click does not call saveFontScalePreferences when both at default', async () => {
    const { saveFontScalePreferences } = await import('@/auth');

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    fireEvent.click(resetBtn!);

    expect(saveFontScalePreferences).not.toHaveBeenCalled();
  });

  it('Reset button click calls saveFontScalePreferences with {ui:1.0,content:1.0} when not at default', async () => {
    const { getFontScalePreferences, saveFontScalePreferences } = await import('@/auth');
    vi.mocked(getFontScalePreferences).mockReturnValue({ ui: 1.125, content: 1.25 });

    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    fireEvent.click(resetBtn!);

    // saveFontScalePreferences is called with both ui and content set to 1.0
    expect(saveFontScalePreferences).toHaveBeenCalledTimes(1);
    const call = vi.mocked(saveFontScalePreferences).mock.calls[0][0];
    expect(call.ui).toBeCloseTo(1.0, 5);
    expect(call.content).toBeCloseTo(1.0, 5);
  });
});

// ─── WCAG 2.2 §2.5.8 — Touch Target Size ─────────────────────────────────────
//
// WCAG 2.2 — 2.5.8 Target Size (Minimum): +/– buttons rendered at w-7 h-7 (28×28px).
// 28px exceeds the 24×24px minimum on both axes — no exception needed.
// Reset button has min-h-[24px] — meets the 24px floor.
// Spinbutton div has min-w-[44px] — width exceeds minimum; height is flex-determined
// by the 28px button row (well above the 24px floor).
//
// These structural assertions confirm the Tailwind class assignments are present
// in the DOM (they don't verify computed px — a visual DevTools check confirms this).

describe('ReadingSection (#600) — WCAG 2.2 §2.5.8 Target Size (structural)', () => {
  it('Decrease interface size button carries w-7 and h-7 Tailwind classes (28×28px)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn?.className).toContain('w-7');
    expect(btn?.className).toContain('h-7');
  });

  it('Increase interface size button carries w-7 and h-7 Tailwind classes (28×28px)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn?.className).toContain('w-7');
    expect(btn?.className).toContain('h-7');
  });

  it('Reset button carries min-h-[24px] (meets WCAG 2.5.8 minimum height)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    expect(resetBtn?.className).toContain('min-h-[24px]');
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────
//
// All interactive elements in FontScaleStepper must use focus-visible:ring-* classes
// (not bare focus:ring-*). Bare focus:ring-* shows focus rings on mouse click,
// which is extraneous and inconsistent with the rest of the panel.

describe('FontScaleStepper (#600) — focus-visible classes (WCAG 2.4.7)', () => {
  it('Decrease interface size button uses focus-visible:ring-2 (not bare focus:ring)', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Decrease interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn?.className).toContain('focus-visible:ring-2');
    // No bare focus:ring-2 (focus: without -visible:)
    expect(btn?.className).not.toMatch(/(?<![a-z])focus:ring-2/);
  });

  it('Increase interface size button uses focus-visible:ring-2', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const btn = document.querySelector(
      'button[aria-label="Increase interface size"]',
    ) as HTMLButtonElement | null;
    expect(btn?.className).toContain('focus-visible:ring-2');
    expect(btn?.className).not.toMatch(/(?<![a-z])focus:ring-2/);
  });

  it('Interface size spinbutton uses focus-visible:ring-2', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const spinbutton = getUiSpinbutton();
    expect(spinbutton.className).toContain('focus-visible:ring-2');
    expect(spinbutton.className).not.toMatch(/(?<![a-z])focus:ring-2/);
  });

  it('Reset button uses focus-visible:ring-2', () => {
    render(<ProviderSettingsPanel isOpen={true} onClose={noop} triggerRef={triggerRef} />);
    const resetBtn = document.querySelector(
      'button[aria-label="Reset interface size and message text size to defaults"]',
    ) as HTMLButtonElement | null;
    expect(resetBtn?.className).toContain('focus-visible:ring-2');
    expect(resetBtn?.className).not.toMatch(/(?<![a-z])focus:ring-2/);
  });
});
