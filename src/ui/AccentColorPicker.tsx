/**
 * AccentColorPicker — color picker popover for model accent color customization.
 *
 * Anchored above (or below) the palette icon on a Model Identity Pill.
 * Exposes 12 curated swatches, a native color picker, and a hex text field.
 * Calls Gate's setModelAccentColor / clearModelAccentColor functions and
 * re-runs applyUserAccentColors after every save/clear.
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { ModelId, ModelAccentColors } from '@/types';
// Gate cross-agent exception: setModelAccentColor and clearModelAccentColor are
// the persistence functions from @/auth. Aria must validate before calling
// setModelAccentColor (it throws on invalid hex per Gate's contract).
// getModelAccentColors is called after every mutation so applyUserAccentColors
// receives a fresh record that reflects the latest stored state.
import {
  setModelAccentColor,
  clearModelAccentColor,
  getModelAccentColors,
} from '@/auth';
import { applyUserAccentColors } from './theme';
import { contrastRatio } from './colorUtils';

// ─── Constants ────────────────────────────────────────────────────────────────

/** 12 curated swatches — order matches the 4×3 grid in Luma's spec. */
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
 * Maps each ModelId to its CSS custom property name on :root.
 * Mirrors the mapping in theme.ts applyUserAccentColors — kept in sync manually.
 * GPT's CSS var is --accent-gpt (not --accent-gpt-5.5), hence the explicit map.
 */
const MODEL_ACCENT_CSS_VARS: Record<ModelId, string> = {
  'claude':    '--accent-claude',
  'gpt-5.5':  '--accent-gpt',
  'gemini':   '--accent-gemini',
  'grok':     '--accent-grok',
  'deepseek': '--accent-deepseek',
  'mistral':  '--accent-mistral',
};

/**
 * Reads the model's current effective accent color directly from the live
 * CSS custom property on :root. This reflects the theme default (Pass 1) or a
 * user override (Pass 2) — whichever applyTheme + applyUserAccentColors last set.
 *
 * Used as the initial selectedHex when no stored override exists, so the picker
 * opens pre-populated with the model's actual visible color rather than Amber.
 */
function getModelDefaultAccentHex(modelId: ModelId): string {
  if (typeof document === 'undefined') return SWATCHES[0].hex;
  const cssVar = MODEL_ACCENT_CSS_VARS[modelId];
  if (!cssVar) return SWATCHES[0].hex;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(cssVar)
    .trim();
  return isValidHex(value) ? value : SWATCHES[0].hex;
}

/**
 * Read the active theme's background color from the :root CSS custom property.
 * Returns the hex string if available, or a fallback dark color.
 */
function getThemeBackgroundHex(): string {
  if (typeof document === 'undefined') return '#1C2333';
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--surface-bg')
    .trim();
  return isValidHex(value) ? value : '#1C2333';
}

/**
 * Read the active theme's name from the data-theme attribute on :root.
 */
function getThemeName(): string {
  if (typeof document === 'undefined') return 'Slate';
  const name = document.documentElement.getAttribute('data-theme') ?? 'slate';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AccentColorPickerProps {
  modelId: ModelId;
  modelName: string;
  /** The currently stored custom color for this model, or undefined if none. */
  currentColor: string | undefined;
  /**
   * Anchor rect of the palette icon button — used to position the popover.
   * Provided by the parent (ModelPill) via getBoundingClientRect().
   */
  anchorRect: DOMRect;
  onClose: () => void;
}

// ─── AccentColorPicker ────────────────────────────────────────────────────────

export function AccentColorPicker({
  modelId,
  modelName,
  currentColor,
  anchorRect,
  onClose,
}: AccentColorPickerProps) {
  // The color currently "selected" in the UI (not yet saved until the user
  // confirms). Starts from the stored override (if any) or the model's live
  // theme accent color read from the CSS custom property on :root.
  const [selectedHex, setSelectedHex] = useState<string>(
    currentColor ?? getModelDefaultAccentHex(modelId),
  );

  // Hex field value — kept in sync with selectedHex but may temporarily
  // diverge while the user types (before validation on blur/Enter).
  const [hexFieldValue, setHexFieldValue] = useState<string>(
    currentColor ?? getModelDefaultAccentHex(modelId),
  );

  // Whether the hex text field has a validation error (invalid value on blur).
  const [hexFieldError, setHexFieldError] = useState(false);

  // Contrast check — computed live against the active theme background.
  const bgHex = getThemeBackgroundHex();
  const themeName = getThemeName();
  const ratio = isValidHex(selectedHex) ? contrastRatio(selectedHex, bgHex) : Infinity;
  const showContrastWarning = ratio < 4.5;

  // Determine popover position — above by default, below if within 200px of top.
  const POPOVER_WIDTH = 220;
  const VERTICAL_GAP = 8;
  const flipBelow = anchorRect.top < 200;

  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    width: POPOVER_WIDTH,
    zIndex: 60,
    // Horizontal: right-edge-aligned with the anchor icon.
    left: Math.max(0, anchorRect.right - POPOVER_WIDTH),
  };

  if (flipBelow) {
    popoverStyle.top = anchorRect.bottom + VERTICAL_GAP;
  } else {
    // Anchored above — we don't know the height until render, so use bottom.
    popoverStyle.bottom = `${window.innerHeight - anchorRect.top + VERTICAL_GAP}px`;
  }

  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  // Ref on the swatch that should receive focus when the picker opens.
  // Points to whichever swatch matches selectedHex (case-insensitive);
  // falls back to index 0 if the current color is a custom hex not in the list.
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  // Index of the swatch that should receive initial focus.
  const initialFocusIndex = (() => {
    const match = SWATCHES.findIndex(
      (s) => s.hex.toUpperCase() === selectedHex.toUpperCase(),
    );
    return match === -1 ? 0 : match;
  })();

  // WCAG 2.1 SC 2.4.3: move focus into the dialog when it opens.
  // useLayoutEffect fires synchronously after DOM paint, before the browser
  // yields to the user, ensuring focus lands here before any Tab keypress
  // can escape to the page behind the popover.
  useLayoutEffect(() => {
    initialFocusRef.current?.focus();
  }, []);

  // Close on click outside.
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  // Close on Escape.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Save helpers ─────────────────────────────────────────────────────────

  const saveColor = useCallback(
    (hex: string) => {
      if (!isValidHex(hex)) return;
      setModelAccentColor(modelId, hex);
      applyUserAccentColors(getModelAccentColors());
    },
    [modelId],
  );

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

  // ── Native color picker — save on close (not input, to avoid write storms) ─

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Browser fires "input" during drag and "change" when the picker closes.
      // We sync the display (selectedHex, hexFieldValue) on every input event,
      // but we only persist on the "change" event (i.e. picker close).
      const hex = e.target.value.toUpperCase();
      setSelectedHex(hex);
      setHexFieldValue(hex);
    },
    [],
  );

  // The native <input type="color"> fires "change" when the picker dialog closes.
  const handleColorPickerClose = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value.toUpperCase();
      setSelectedHex(hex);
      setHexFieldValue(hex);
      saveColor(hex);
      // Stays open per spec "Native color picker close → saves + stays open".
    },
    [saveColor],
  );

  // ── Hex text field ────────────────────────────────────────────────────────

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Keep the raw field value in sync — validation happens on blur/Enter.
      let value = e.target.value;
      // Prepend # if user started typing without it.
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
        // Invalid value: show error, revert field after 350ms.
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
        commitHexField(true); // Enter in hex field → saves + closes
      }
    },
    [commitHexField],
  );

  const handleHexBlur = useCallback(() => {
    commitHexField(false); // Blur hex field (valid) → saves + stays open
  }, [commitHexField]);

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    clearModelAccentColor(modelId);
    applyUserAccentColors(getModelAccentColors());
    onClose();
  }, [modelId, onClose]);

  // ── Check whether a custom color is stored for this model ─────────────────

  // We check getModelAccentColors() at render time to know if Reset should show.
  // After save/clear, the component re-renders because the parent reads from
  // getModelAccentColors() on ModelPill's isOverrideActive flag.
  // We read directly here to avoid prop-drilling a live snapshot.
  const storedColors: ModelAccentColors = getModelAccentColors();
  const hasStoredOverride = modelId in storedColors;

  // ── Color swatch button click → trigger native picker ────────────────────

  const handleColorSwatchButtonClick = useCallback(() => {
    colorInputRef.current?.click();
  }, []);

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label={`Accent color picker for ${modelName}`}
      aria-modal="true"
      style={popoverStyle}
      className="bg-card border border-border rounded-[12px] shadow-lg overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center h-8 px-3 border-b border-border-subtle"
      >
        <span
          className="text-[12px] font-semibold text-text-muted uppercase"
          style={{ letterSpacing: '0.06em' }}
        >
          Model accent
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
                  outline: isActive
                    ? '2px solid var(--text-primary)'
                    : undefined,
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
        <span
          className="block text-[11px] font-medium text-text-muted mb-[6px]"
        >
          Custom
        </span>
        <div className="flex items-center gap-2">
          {/* Color swatch button — triggers hidden native picker */}
          <button
            type="button"
            aria-label="Open color picker"
            onClick={handleColorSwatchButtonClick}
            className={[
              'w-9 h-9 rounded-sm flex-shrink-0 relative',
              'border border-border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
            style={{ backgroundColor: isValidHex(selectedHex) ? selectedHex : '#888888' }}
          >
            {/* Hidden native color input — overlaid and invisible */}
            <input
              ref={colorInputRef}
              type="color"
              value={
                isValidHex(selectedHex)
                  ? selectedHex.toLowerCase()
                  : '#888888'
              }
              onChange={handleColorPickerChange}
              onBlur={handleColorPickerClose}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              aria-hidden="true"
              tabIndex={-1}
            />
          </button>

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
              hexFieldError
                ? 'border-semantic-error'
                : 'border-border',
            ].join(' ')}
          />
        </div>
      </div>

      {/* Reset affordance — only shown when an override is stored */}
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
