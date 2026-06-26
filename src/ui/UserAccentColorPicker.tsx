/**
 * UserAccentColorPicker — color picker popover for the user message accent color.
 *
 * Mirrors the model AccentColorPicker pattern (same 12-swatch grid, same keyboard
 * contract, same contrast warning) with these differences per Luma's spec (#279):
 *   - Header label: "Your accent" (not "Model accent")
 *   - No modelId routing — clicking a swatch calls setUserAccentColor(hex) directly
 *   - "Reset to theme default" calls applyTheme(currentTheme), then clearUserAccentColor(),
 *     then applyUserMessageColor(null) (now a no-op — the theme default was already restored)
 *   - Reset shown only when getUserAccentColor() !== null
 */

import { useState, useLayoutEffect, useRef, useCallback, useEffect } from 'react';
import { useClickOutside } from './hooks/useClickOutside';
// Gate cross-agent exception: user accent color persistence API from @/auth.
// These three functions are the Gate-owned storage layer for the user's custom
// accent color. Aria validates hex before calling setUserAccentColor (it throws
// on invalid input per Gate's contract).
import type { ThemeId } from '@/types';
import { getUserAccentColor, setUserAccentColor, clearUserAccentColor } from '@/auth';
import { applyUserMessageColor, applyTheme, THEME_MAP } from './theme';
import { contrastRatio } from './colorUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 12 curated swatches — identical order to the model AccentColorPicker. */
const SWATCHES: Array<{ name: string; hex: string }> = [
  { name: 'Amber',   hex: '#F59E0B' },
  { name: 'Gold',    hex: '#EAB308' },
  { name: 'Coral',   hex: '#F97316' },
  { name: 'Rose',    hex: '#E0568A' },
  { name: 'Crimson', hex: '#EF4444' },
  { name: 'Violet',  hex: '#8B5CF6' },
  { name: 'Cobalt',  hex: '#4468D0' },
  { name: 'Sky',     hex: '#38B2D8' },
  { name: 'Teal',    hex: '#14B8A6' },
  { name: 'Lime',    hex: '#84CC16' },
  { name: 'Sage',    hex: '#22C55E' },
  { name: 'Snow',    hex: '#E8EAF0' },
];

const HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value);
}

/**
 * Reads the current effective user accent color from the live CSS custom property
 * on :root. Returns the theme default (Pass 1) or user override (Pass 2) —
 * whichever applyTheme + applyUserMessageColor last set.
 *
 * Used as the initial selectedHex when no stored override exists, so the picker
 * opens pre-populated with the visible color rather than a hard-coded fallback.
 */
function getUserDefaultAccentHex(): string {
  if (typeof document === 'undefined') return '#A5B4FC';
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-user')
    .trim();
  return isValidHex(value) ? value : '#A5B4FC';
}

/**
 * Reads the active theme's background color from the :root CSS custom property.
 */
function getThemeBackgroundHex(): string {
  if (typeof document === 'undefined') return '#1C2333';
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-bg')
    .trim();
  return isValidHex(value) ? value : '#1C2333';
}

/**
 * Reads the active theme name from the data-theme attribute on :root.
 */
function getThemeName(): string {
  if (typeof document === 'undefined') return 'Slate';
  const name = document.documentElement.getAttribute('data-theme') ?? 'slate';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UserAccentColorPickerProps {
  /** The currently stored user accent hex, or null if none. */
  currentColor: string | null;
  /**
   * Anchor rect of the swatch button — used to position the popover.
   * Provided by the parent (Sidebar) via getBoundingClientRect().
   */
  anchorRect: DOMRect;
  onClose: () => void;
}

// ─── UserAccentColorPicker ────────────────────────────────────────────────────

export function UserAccentColorPicker({
  currentColor,
  anchorRect,
  onClose,
}: UserAccentColorPickerProps) {
  // The color currently "selected" in the UI (not yet saved until the user confirms).
  // Starts from the stored override or the live theme default from --accent-user.
  const [selectedHex, setSelectedHex] = useState<string>(
    currentColor ?? getUserDefaultAccentHex(),
  );

  // Hex field value — kept in sync with selectedHex but may diverge temporarily.
  const [hexFieldValue, setHexFieldValue] = useState<string>(
    currentColor ?? getUserDefaultAccentHex(),
  );

  // Validation error state for the hex text field.
  const [hexFieldError, setHexFieldError] = useState(false);

  // Contrast check — computed live against the active theme background.
  const bgHex = getThemeBackgroundHex();
  const themeName = getThemeName();
  const ratio = isValidHex(selectedHex) ? contrastRatio(selectedHex, bgHex) : Infinity;
  const showContrastWarning = ratio < 4.5;

  // Popover positioning: above by default, below if close to the top of the viewport.
  const POPOVER_WIDTH = 220;
  const VERTICAL_GAP = 8;
  const flipBelow = anchorRect.top < 200;

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: POPOVER_WIDTH,
    zIndex: 60,
    left: Math.max(0, anchorRect.right - POPOVER_WIDTH),
  };

  if (flipBelow) {
    popoverStyle.top = anchorRect.bottom + VERTICAL_GAP;
  } else {
    popoverStyle.bottom = `${window.innerHeight - anchorRect.top + VERTICAL_GAP}px`;
  }

  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  // Ref to the swatch that should receive initial focus.
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  // Ref to the custom color swatch button (receives focus when color is not in preset list).
  const customSwatchRef = useRef<HTMLButtonElement>(null);

  const initialFocusIndex = SWATCHES.findIndex(
    (s) => s.hex.toUpperCase() === selectedHex.toUpperCase(),
  );
  const isCustomColor = initialFocusIndex === -1;

  // WCAG 2.1 SC 2.4.3: move focus into the dialog when it opens.
  useLayoutEffect(() => {
    if (isCustomColor) {
      customSwatchRef.current?.focus();
    } else {
      initialFocusRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on click outside.
  useClickOutside([popoverRef], onClose);

  // Focus trap + Escape — capture-phase document listener (same pattern as AccentColorPicker).
  // Capture phase fires before any bubble-phase listener (including parent panel traps),
  // so Tab/Shift+Tab always cycle within this dialog while it is open.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const popover = popoverRef.current;
      if (!popover) return;
      if (!popover.contains(document.activeElement)) return;

      const focusable = Array.from(
        popover.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;

      e.stopPropagation();
      e.preventDefault();

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);

      if (e.shiftKey) {
        if (currentIndex <= 0) {
          last.focus();
        } else {
          focusable[currentIndex - 1].focus();
        }
      } else {
        if (currentIndex === -1 || currentIndex >= focusable.length - 1) {
          first.focus();
        } else {
          focusable[currentIndex + 1].focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onClose]);

  // ── Save helpers ──────────────────────────────────────────────────────────

  const saveColor = useCallback((hex: string) => {
    if (!isValidHex(hex)) return;
    setUserAccentColor(hex);
    applyUserMessageColor(hex);
  }, []);

  // ── Swatch click — save immediately + close ───────────────────────────────

  const handleSwatchClick = useCallback(
    (hex: string) => {
      setSelectedHex(hex);
      setHexFieldValue(hex);
      saveColor(hex);
      onClose();
    },
    [saveColor, onClose],
  );

  // ── Native color picker — sync on change, save on picker close ────────────

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value.toUpperCase();
      setSelectedHex(hex);
      setHexFieldValue(hex);
    },
    [],
  );

  const handleColorPickerClose = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value.toUpperCase();
      setSelectedHex(hex);
      setHexFieldValue(hex);
      saveColor(hex);
    },
    [saveColor],
  );

  // ── Hex text field ────────────────────────────────────────────────────────

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      if (value && !value.startsWith('#')) value = '#' + value;
      setHexFieldValue(value.toUpperCase());
      setHexFieldError(false);
    },
    [],
  );

  const commitHexField = useCallback(
    (shouldClose: boolean) => {
      const cleaned = hexFieldValue.trim().toUpperCase();
      if (isValidHex(cleaned)) {
        setSelectedHex(cleaned);
        setHexFieldError(false);
        saveColor(cleaned);
        if (shouldClose) onClose();
      } else {
        setHexFieldError(true);
        setTimeout(() => {
          setHexFieldError(false);
          setHexFieldValue(selectedHex);
        }, 350);
      }
    },
    [hexFieldValue, selectedHex, saveColor, onClose],
  );

  const handleHexKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitHexField(true);
      }
    },
    [commitHexField],
  );

  const handleHexBlur = useCallback(() => {
    commitHexField(false);
  }, [commitHexField]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    // Re-apply the current theme first so applyTheme() re-sets --accent-user from the
    // theme JSON (Pass 1). Without this, applyUserMessageColor(null) is a no-op and
    // the previously-set inline override remains, blocking the theme default from showing.
    const themeId = (document.documentElement.getAttribute('data-theme') ?? 'slate') as ThemeId;
    applyTheme(THEME_MAP[themeId]);
    clearUserAccentColor();
    applyUserMessageColor(null); // no-op — theme default already restored by applyTheme
    onClose();
  }, [onClose]);

  // Determine whether to show the reset button.
  const hasStoredOverride = getUserAccentColor() !== null;

  // ── Color swatch button → trigger native picker ───────────────────────────

  const handleColorSwatchButtonClick = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="User message accent color picker"
      aria-modal="true"
      style={popoverStyle}
      className="bg-card border border-border rounded-[12px] shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center h-8 px-3 border-b border-border-subtle">
        <span
          className="text-[12px] font-semibold text-text-muted uppercase"
          style={{ letterSpacing: '0.06em' }}
        >
          Your accent
        </span>
      </div>

      {/* Swatch grid — 4×3 */}
      <div className="p-3">
        <div
          role="group"
          aria-label="Preset accent colors"
          className="grid gap-[6px]"
          style={{ gridTemplateColumns: 'repeat(4, 28px)' }}
        >
          {SWATCHES.map((swatch, index) => {
            const isActive =
              selectedHex.toUpperCase() === swatch.hex.toUpperCase();
            return (
              <button
                key={swatch.hex}
                ref={index === initialFocusIndex ? initialFocusRef : undefined}
                type="button"
                aria-label={swatch.name}
                aria-pressed={isActive}
                onClick={() => handleSwatchClick(swatch.hex)}
                className={[
                  'w-7 h-7 rounded-sm',
                  'transition-transform duration-fast',
                  'hover:scale-110',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
                style={{
                  backgroundColor: swatch.hex,
                  outline: isActive ? '2px solid var(--text-primary)' : undefined,
                  outlineOffset: isActive ? '2px' : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Contrast warning banner */}
      {showContrastWarning && (
        <div
          role="alert"
          className="mx-3 mb-3 px-3 py-2"
          style={{
            borderLeft: '3px solid var(--semantic-warning)',
            backgroundColor: 'var(--surface-card)',
            color: 'var(--semantic-warning)',
          }}
        >
          <span className="text-[11px] font-normal">
            Low contrast on {themeName}
          </span>
        </div>
      )}

      {/* Custom color input row */}
      <div className="px-3 pb-3 border-t border-border-subtle pt-3">
        <span className="block text-[11px] font-medium text-text-muted mb-[6px]">
          Custom
        </span>
        <div className="flex items-center gap-2">
          {/* Wrapper keeps button and hidden native input as siblings.
              The input must NOT be inside the button (WCAG 4.1.1 — nested interactive). */}
          <div className="relative flex-shrink-0 w-9 h-9">
            <button
              ref={customSwatchRef}
              type="button"
              aria-label="Open color picker"
              onClick={handleColorSwatchButtonClick}
              className={[
                'w-9 h-9 rounded-sm',
                'border border-border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
              style={{
                backgroundColor: isValidHex(selectedHex) ? selectedHex : '#888888',
                outline: isCustomColor ? '2px solid var(--text-primary)' : undefined,
                outlineOffset: isCustomColor ? '2px' : undefined,
              }}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={isValidHex(selectedHex) ? selectedHex.toLowerCase() : '#888888'}
              onChange={handleColorPickerChange}
              onBlur={handleColorPickerClose}
              className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          {/* Hex text field */}
          <input
            type="text"
            value={hexFieldValue}
            onChange={handleHexChange}
            onKeyDown={handleHexKeyDown}
            onBlur={handleHexBlur}
            maxLength={7}
            placeholder="#000000"
            aria-label="Custom hex color value"
            className={[
              'h-9 w-24 px-2 rounded-sm text-[12px] text-text-primary',
              'bg-input border',
              'placeholder:text-text-muted',
              'focus:outline-none focus:border-border-strong',
              'transition-[border-color] duration-fast',
              hexFieldError ? 'border-semantic-error' : 'border-border',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Reset affordance — only shown when a user override is stored */}
      {hasStoredOverride && (
        <div className="px-3 pb-[10px] flex justify-end">
          <button
            type="button"
            onClick={handleReset}
            className={[
              'text-[11px] text-text-muted',
              'hover:text-text-secondary hover:underline',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
              'transition-colors duration-fast',
            ].join(' ')}
          >
            Reset to theme default
          </button>
        </div>
      )}
    </div>
  );
}
