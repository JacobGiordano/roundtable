/**
 * Integration tests — AccentColorPicker hex field validation flow
 *
 * Issue #86: the blur/Enter commit flow with a 350ms error-then-revert sequence
 * was not covered by existing tests in /src/ui/AccentColorPicker.test.tsx (Aria's
 * file). That file covers the happy paths; this file covers the error paths.
 *
 * Missing coverage addressed here:
 *   1. Blur with invalid hex → error class appears → reverts to previous value after 350ms
 *   2. Enter with valid hex → saves and closes picker
 *   3. Enter with invalid hex → does not save, does not close
 *
 * Timer strategy: vi.useFakeTimers() controls the 350ms revert setTimeout.
 * All DOM interactions use fireEvent (synchronous) rather than userEvent's async
 * API, because userEvent v14 uses setTimeout internally even with delay:null,
 * which deadlocks against the fake-timer environment.
 *
 * Mock strategy (mirrors /src/ui/AccentColorPicker.test.tsx):
 *   - @/auth: vi.mock() — Gate's persistence functions; avoids real localStorage
 *   - @/ui/theme: vi.mock() — applyUserAccentColors reads CSS vars; irrelevant here
 *   - getComputedStyle: stubbed to return a predictable accent hex
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ─── Module mocks (must be declared before imports that consume them) ─────────

vi.mock('@/auth', () => ({
  setModelAccentColor: vi.fn(),
  clearModelAccentColor: vi.fn(),
  getModelAccentColors: vi.fn(() => ({})),
}));

vi.mock('@/ui/theme', () => ({
  applyUserAccentColors: vi.fn(),
}));

// ─── Imports (after mocks are hoisted) ────────────────────────────────────────

import { AccentColorPicker } from '@/ui/AccentColorPicker';
import { setModelAccentColor } from '@/auth';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Amber — first preset swatch; used as the "previous saved color". */
const AMBER = '#F59E0B';
/** A valid hex that is not in the 12 presets. */
const VALID_CUSTOM_HEX = '#123456';
/** Invalid strings that should trigger the error path. */
const INVALID_HEX_VALUES = [
  'notahex',
  '#ZZZZZZ',
  '#12345',   // too short (5 digits)
  'GGGGGG',   // invalid hex chars — component prepends '#' → '#GGGGGG', still invalid
];

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

function renderPicker(props: Partial<Parameters<typeof AccentColorPicker>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <AccentColorPicker
      modelId="claude"
      modelName="Claude"
      currentColor={AMBER}
      anchorRect={makeAnchorRect()}
      onClose={onClose}
      {...props}
    />,
  );
  const hexInput = screen.getByRole('textbox', { name: /custom hex color value/i });
  return { onClose, hexInput };
}

/** Returns true when the hex input has the error border class applied. */
function hasErrorClass(input: HTMLElement): boolean {
  return input.className.includes('border-semantic-error');
}

/**
 * Simulate typing into the hex text field using fireEvent.
 *
 * The component's handleHexChange handler reads e.target.value and updates
 * hexFieldValue state. fireEvent.change fires the React synthetic onChange,
 * which is what matters for state updates — not individual keystrokes.
 *
 * We fire a focus event first to match real browser behavior (field must be
 * focused before blur is meaningful).
 */
function typeIntoHexField(input: HTMLElement, value: string): void {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

/**
 * Type a value into the hex field then trigger blur.
 */
function typeAndBlur(input: HTMLElement, value: string): void {
  typeIntoHexField(input, value);
  fireEvent.blur(input);
}

/**
 * Type a value into the hex field then press Enter (via keyDown).
 */
function typeAndEnter(input: HTMLElement, value: string): void {
  typeIntoHexField(input, value);
  fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Stub getComputedStyle so getModelDefaultAccentHex returns a predictable value.
  vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => AMBER,
  } as unknown as CSSStyleDeclaration);
});

afterEach(() => {
  vi.runAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

// ─── Blur with invalid hex ────────────────────────────────────────────────────

describe('AccentColorPicker — blur with invalid hex (issue #86)', () => {
  it('shows error class immediately when blurred with an invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, 'notahex');

    expect(hasErrorClass(hexInput)).toBe(true);
  });

  it('reverts the field value to the previous selected color after 350ms', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, 'notahex');

    // Error should be visible before the timer fires.
    expect(hasErrorClass(hexInput)).toBe(true);

    // Advance past the 350ms revert timer.
    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Field should revert to the previous selectedHex (AMBER).
    expect((hexInput as HTMLInputElement).value).toBe(AMBER);
  });

  it('clears the error class after 350ms revert', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, 'ZZZZZZ');

    expect(hasErrorClass(hexInput)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(hasErrorClass(hexInput)).toBe(false);
  });

  it('does not call setModelAccentColor when blurred with invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, '#ZZZZZZ');

    expect(vi.mocked(setModelAccentColor)).not.toHaveBeenCalled();
  });

  it('does not call onClose when blurred with invalid hex', () => {
    const { hexInput, onClose } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, 'bad');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows error class when blurred with empty field', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    // Fire change with empty string (simulates user clearing the field entirely).
    // The component's onChange guard (if value && !value.startsWith('#')) skips
    // the '#' prepend when value is falsy, so empty stays empty.
    typeIntoHexField(hexInput, '');
    fireEvent.blur(hexInput);

    expect(hasErrorClass(hexInput)).toBe(true);
  });

  it.each(INVALID_HEX_VALUES)(
    'shows error class for invalid value "%s"',
    (invalidValue) => {
      const { hexInput } = renderPicker({ currentColor: AMBER });

      typeAndBlur(hexInput, invalidValue);

      expect(hasErrorClass(hexInput)).toBe(true);
    },
  );
});

// ─── Enter with valid hex ─────────────────────────────────────────────────────

describe('AccentColorPicker — Enter with valid hex (issue #86)', () => {
  it('calls setModelAccentColor with the typed valid hex on Enter', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, VALID_CUSTOM_HEX);

    expect(vi.mocked(setModelAccentColor)).toHaveBeenCalledWith('claude', VALID_CUSTOM_HEX);
  });

  it('closes the picker (calls onClose) on Enter with valid hex', () => {
    const { hexInput, onClose } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, VALID_CUSTOM_HEX);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show an error class on Enter with valid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, VALID_CUSTOM_HEX);

    expect(hasErrorClass(hexInput)).toBe(false);
  });

  it('normalises lowercase hex to uppercase when saving on Enter', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    // The component normalises to uppercase in handleHexChange; fireEvent.change
    // fires onChange which calls setHexFieldValue(value.toUpperCase()).
    typeAndEnter(hexInput, '#abcdef');

    expect(vi.mocked(setModelAccentColor)).toHaveBeenCalledWith('claude', '#ABCDEF');
  });
});

// ─── Enter with invalid hex ───────────────────────────────────────────────────

describe('AccentColorPicker — Enter with invalid hex (issue #86)', () => {
  it('does not call setModelAccentColor on Enter with invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, 'notahex');

    expect(vi.mocked(setModelAccentColor)).not.toHaveBeenCalled();
  });

  it('does not close the picker on Enter with invalid hex', () => {
    const { hexInput, onClose } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, '#12345');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows error class immediately on Enter with invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, 'notahex');

    expect(hasErrorClass(hexInput)).toBe(true);
  });

  it('reverts field value to previous color after 350ms on Enter with invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, 'notahex');

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect((hexInput as HTMLInputElement).value).toBe(AMBER);
  });

  it('clears error class after 350ms on Enter with invalid hex', () => {
    const { hexInput } = renderPicker({ currentColor: AMBER });

    typeAndEnter(hexInput, 'bad');

    expect(hasErrorClass(hexInput)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(hasErrorClass(hexInput)).toBe(false);
  });
});

// ─── Blur with valid hex ──────────────────────────────────────────────────────

describe('AccentColorPicker — blur with valid hex (confirmatory regression guard)', () => {
  /**
   * The issue asks for invalid-hex error paths. This group is a lightweight
   * regression guard confirming the valid-blur path (stay open + save) is
   * not broken by the fake-timer setup introduced above. It intentionally
   * avoids duplicating the full happy-path coverage in Aria's test file.
   */
  it('saves color on blur with valid hex but does not close picker', () => {
    const { hexInput, onClose } = renderPicker({ currentColor: AMBER });

    typeAndBlur(hexInput, VALID_CUSTOM_HEX);

    expect(vi.mocked(setModelAccentColor)).toHaveBeenCalledWith('claude', VALID_CUSTOM_HEX);
    expect(onClose).not.toHaveBeenCalled();
  });
});
