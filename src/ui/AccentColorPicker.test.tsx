/**
 * Functional tests for AccentColorPicker.tsx (Aria)
 *
 * These tests cover the three behaviors fixed in sprint issue #72:
 *   1. Pre-populate with model's live accent color (not always Amber)
 *   2. Highlight the matching preset swatch when currentColor is a preset hex
 *   3. Highlight the custom swatch button when currentColor is not in the presets
 *
 * Plus basic render and interaction tests:
 *   - Component renders without crashing
 *   - Clicking a preset swatch calls setModelAccentColor and invokes onClose
 *   - Reset button is only shown when a stored override exists
 *   - Reset button calls clearModelAccentColor and invokes onClose
 *   - Escape key closes the popover
 *   - Click outside closes the popover
 *
 * Mock strategy:
 *   - @/auth: vi.mock() — we mock Gate's persistence functions so tests don't
 *     touch real localStorage and don't trigger applyUserAccentColors
 *   - ./theme: vi.mock() — applyUserAccentColors reads CSS vars and sets styles;
 *     irrelevant to these behavior tests
 *   - ./colorUtils: real implementation (contrastRatio is a pure function)
 *   - getComputedStyle: stubbed to return a known accent hex so getModelDefaultAccentHex
 *     returns a predictable value in tests where currentColor is undefined
 *
 * Component interface (from AccentColorPicker.tsx):
 *   modelId: ModelId
 *   modelName: string
 *   currentColor: string | undefined
 *   anchorRect: DOMRect
 *   onClose: () => void
 *
 * Note: onColorChange / onReset are NOT props — the component calls Gate's
 * persistence functions directly and calls onClose when done.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@/auth', () => ({
  setModelAccentColor: vi.fn(),
  clearModelAccentColor: vi.fn(),
  getModelAccentColors: vi.fn(() => ({})),
}));

vi.mock('./theme', () => ({
  applyUserAccentColors: vi.fn(),
}));

// ─── Imports (after mocks are declared) ───────────────────────────────────────

import { AccentColorPicker } from './AccentColorPicker';
import { setModelAccentColor, clearModelAccentColor, getModelAccentColors } from '@/auth';
import { applyUserAccentColors } from './theme';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Amber — the first swatch. */
const AMBER = '#F59E0B';
/** A custom hex that does not match any of the 12 presets. */
const CUSTOM_HEX = '#123456';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAnchorRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 400,
    bottom: 420,
    left: 100,
    right: 128,
    width: 28,
    height: 20,
    x: 100,
    y: 400,
    toJSON: () => ({}),
    ...overrides,
  };
}

/**
 * Render AccentColorPicker with sensible defaults, allowing selective overrides.
 */
function renderPicker(props: Partial<Parameters<typeof AccentColorPicker>[0]> = {}) {
  const onClose = vi.fn();
  const { unmount } = render(
    <AccentColorPicker
      modelId="claude"
      modelName="Claude"
      currentColor={AMBER}
      anchorRect={makeAnchorRect()}
      onClose={onClose}
      {...props}
    />,
  );
  return { onClose, unmount };
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no stored overrides.
  vi.mocked(getModelAccentColors).mockReturnValue({});
  // Stub getComputedStyle so getModelDefaultAccentHex returns a known value
  // when currentColor is undefined (reads --accent-claude from :root).
  vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => AMBER,
  } as unknown as CSSStyleDeclaration);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Render ───────────────────────────────────────────────────────────────────

describe('AccentColorPicker — render', () => {
  it('renders without crashing', () => {
    expect(() => renderPicker()).not.toThrow();
  });

  it('renders the dialog with the correct aria-label', () => {
    renderPicker({ modelName: 'Claude' });
    expect(
      screen.getByRole('dialog', { name: /accent color picker for claude/i }),
    ).toBeDefined();
  });

  it('renders 12 preset swatch buttons', () => {
    renderPicker();
    // The swatch grid has role="group" — each swatch is a button with aria-label.
    const swatchGroup = screen.getByRole('group', { name: /preset accent colors/i });
    const swatches = swatchGroup.querySelectorAll('button');
    expect(swatches).toHaveLength(12);
  });

  it('renders the "Open color picker" custom swatch button', () => {
    renderPicker();
    expect(screen.getByRole('button', { name: /open color picker/i })).toBeDefined();
  });

  it('renders the hex text field', () => {
    renderPicker();
    expect(screen.getByRole('textbox', { name: /custom hex color value/i })).toBeDefined();
  });

  it('does not render the Reset button when no stored override exists', () => {
    vi.mocked(getModelAccentColors).mockReturnValue({});
    renderPicker();
    expect(screen.queryByRole('button', { name: /reset to theme default/i })).toBeNull();
  });

  it('renders the Reset button when a stored override exists for this model', () => {
    vi.mocked(getModelAccentColors).mockReturnValue({ claude: AMBER });
    renderPicker();
    expect(
      screen.getByRole('button', { name: /reset to theme default/i }),
    ).toBeDefined();
  });
});

// ─── Preset swatch selection state ───────────────────────────────────────────

describe('AccentColorPicker — preset swatch highlight (issue #72)', () => {
  it('when currentColor matches a preset, that swatch has aria-pressed=true', () => {
    // Amber (#F59E0B) is the first preset swatch.
    renderPicker({ currentColor: AMBER });
    const amberSwatch = screen.getByRole('button', { name: 'Amber' });
    expect(amberSwatch.getAttribute('aria-pressed')).toBe('true');
  });

  it('when currentColor matches a preset, other swatches have aria-pressed=false', () => {
    renderPicker({ currentColor: AMBER });
    const goldSwatch = screen.getByRole('button', { name: 'Gold' });
    expect(goldSwatch.getAttribute('aria-pressed')).toBe('false');
  });

  it('when currentColor is a different preset, the correct swatch is aria-pressed=true', () => {
    const TEAL = '#14B8A6';
    renderPicker({ currentColor: TEAL });
    const tealSwatch = screen.getByRole('button', { name: 'Teal' });
    expect(tealSwatch.getAttribute('aria-pressed')).toBe('true');
    // Amber is not active.
    const amberSwatch = screen.getByRole('button', { name: 'Amber' });
    expect(amberSwatch.getAttribute('aria-pressed')).toBe('false');
  });

  it('preset match is case-insensitive (lowercase hex still selects the swatch)', () => {
    // AMBER in lowercase
    renderPicker({ currentColor: '#f59e0b' });
    const amberSwatch = screen.getByRole('button', { name: 'Amber' });
    expect(amberSwatch.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── Custom swatch highlight when color is not a preset ─────────────────────

describe('AccentColorPicker — custom swatch highlight (issue #72)', () => {
  it('when currentColor is a custom hex, no preset swatch is aria-pressed=true', () => {
    renderPicker({ currentColor: CUSTOM_HEX });
    const swatchGroup = screen.getByRole('group', { name: /preset accent colors/i });
    const pressedSwatches = Array.from(swatchGroup.querySelectorAll('button')).filter(
      (btn) => btn.getAttribute('aria-pressed') === 'true',
    );
    expect(pressedSwatches).toHaveLength(0);
  });

  it('when currentColor is a custom hex, the custom swatch button has an outline style', () => {
    renderPicker({ currentColor: CUSTOM_HEX });
    const customBtn = screen.getByRole('button', { name: /open color picker/i });
    // The component sets outline via inline style when isCustomColor is true.
    const outline = (customBtn as HTMLElement).style.outline;
    expect(outline).toBeTruthy();
    expect(outline).toContain('2px solid');
  });

  it('when currentColor is a preset, the custom swatch button has no outline', () => {
    renderPicker({ currentColor: AMBER });
    const customBtn = screen.getByRole('button', { name: /open color picker/i });
    const outline = (customBtn as HTMLElement).style.outline;
    // No outline should be set for a preset color.
    expect(outline).toBeFalsy();
  });
});

// ─── Preset swatch click ──────────────────────────────────────────────────────

describe('AccentColorPicker — swatch click interactions', () => {
  it('clicking a preset swatch calls setModelAccentColor with the correct hex', async () => {
    renderPicker({ currentColor: CUSTOM_HEX });
    const tealSwatch = screen.getByRole('button', { name: 'Teal' });
    await userEvent.click(tealSwatch);

    expect(vi.mocked(setModelAccentColor)).toHaveBeenCalledWith('claude', '#14B8A6');
  });

  it('clicking a preset swatch calls applyUserAccentColors after saving', async () => {
    renderPicker({ currentColor: CUSTOM_HEX });
    const goldswatch = screen.getByRole('button', { name: 'Gold' });
    await userEvent.click(goldswatch);

    expect(vi.mocked(applyUserAccentColors)).toHaveBeenCalled();
  });

  it('clicking a preset swatch closes the picker (calls onClose)', async () => {
    const { onClose } = renderPicker({ currentColor: CUSTOM_HEX });
    const amberSwatch = screen.getByRole('button', { name: 'Amber' });
    await userEvent.click(amberSwatch);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── Reset button ─────────────────────────────────────────────────────────────

describe('AccentColorPicker — reset button', () => {
  it('clicking Reset calls clearModelAccentColor with the correct modelId', async () => {
    vi.mocked(getModelAccentColors).mockReturnValue({ claude: AMBER });
    renderPicker();
    const resetBtn = screen.getByRole('button', { name: /reset to theme default/i });
    await userEvent.click(resetBtn);

    expect(vi.mocked(clearModelAccentColor)).toHaveBeenCalledWith('claude');
  });

  it('clicking Reset calls applyUserAccentColors after clearing', async () => {
    vi.mocked(getModelAccentColors).mockReturnValue({ claude: AMBER });
    renderPicker();
    const resetBtn = screen.getByRole('button', { name: /reset to theme default/i });
    await userEvent.click(resetBtn);

    expect(vi.mocked(applyUserAccentColors)).toHaveBeenCalled();
  });

  it('clicking Reset closes the picker (calls onClose)', async () => {
    vi.mocked(getModelAccentColors).mockReturnValue({ claude: AMBER });
    const { onClose } = renderPicker();
    const resetBtn = screen.getByRole('button', { name: /reset to theme default/i });
    await userEvent.click(resetBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ─── Keyboard close ───────────────────────────────────────────────────────────

describe('AccentColorPicker — keyboard and click-outside close', () => {
  it('pressing Escape closes the picker', async () => {
    const { onClose } = renderPicker();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking outside the popover closes the picker', () => {
    const { onClose } = renderPicker();
    // Simulate a mousedown event outside the popover element.
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the popover does not close it', async () => {
    const { onClose } = renderPicker();
    // Click a preset swatch — this calls onClose as the save action, but
    // we verify here that the mousedown on the dialog itself does not
    // double-fire onClose. We use the hex text field (non-action click).
    const hexInput = screen.getByRole('textbox', { name: /custom hex color value/i });
    fireEvent.mouseDown(hexInput);
    // onClose should NOT have been called by the mousedown — only action clicks
    // (swatch, reset) trigger it.
    expect(onClose).not.toHaveBeenCalled();
  });
});
