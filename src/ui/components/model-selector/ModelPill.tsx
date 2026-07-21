/**
 * ModelPill — toggleable pill representing one model in the selector panel.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
 *
 * Active: filled background + full-opacity dot.
 * Inactive: transparent background + 40%-opacity dot + muted label.
 * Last-active: clicking triggers a brief shake instead of deactivating.
 *
 * When onOpenColorPicker is provided (Model Selector Panel context only):
 * - Pill wrapper gains position:relative and class "group".
 * - A palette icon button is absolutely positioned inside the pill at right:8px.
 * - Icon is opacity-0 normally, opacity-100 on group-hover (CSS-only).
 * - If isOverrideActive, icon is always visible with the model's accent color.
 *
 * #528: Dismiss affordance — active pills show a ×-dismiss button as a sibling
 * to the right of the pill. Clicking it deactivates the model. Suppressed on
 * the last active model (shake instead).
 * The dismiss button is tabIndex={-1}/aria-hidden (deactivation is keyboard-
 * accessible via the pill's own role="switch" / Space key).
 *
 * #531: × button enlarged to w-6 h-6 (24×24px, WCAG 2.5.8). Opacity control
 * moved from JS state (isPillHovered) to CSS-only: rests at 0.35 on pointer
 * devices, 0.55 on touch (@media hover:none), 100% on group hover or direct
 * hover. Palette icon also converted to CSS group-hover — isPillHovered removed.
 */

import { useState, useRef, useCallback } from 'react';
import type { ModelConfig, ModelId } from '@/types';
// #147: shared icon system — PaletteIcon replaces the local copy.
import { PaletteIcon } from '@/ui/icons';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

export interface ModelPillProps {
  model: ModelConfig;
  isLastActive: boolean;
  onToggle: (modelId: ModelId) => void;
  /**
   * When provided the pill renders in "Model Selector Panel context" —
   * it shows a palette icon affordance for accent color customization.
   * When undefined the pill renders without the palette icon (other contexts).
   */
  onOpenColorPicker?: (modelId: ModelId, anchorRect: DOMRect) => void;
  /**
   * Whether a custom accent color is currently stored for this model.
   * When true, the palette icon is always visible (not just on hover)
   * and its color reflects the active custom accent.
   */
  isOverrideActive?: boolean;
}

export function ModelPill({
  model,
  isLastActive,
  onToggle,
  onOpenColorPicker,
  isOverrideActive = false,
}: ModelPillProps) {
  const [isShaking, setIsShaking] = useState(false);
  const paletteButtonRef = useRef<HTMLButtonElement>(null);

  const handleClick = useCallback(() => {
    if (model.isActive && isLastActive) {
      // Can't deactivate the last model — shake feedback
      setIsShaking(true);
      return;
    }
    onToggle(model.modelId);
  }, [model.isActive, model.modelId, isLastActive, onToggle]);

  const handleAnimationEnd = useCallback(() => {
    setIsShaking(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  const handlePaletteClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation(); // don't toggle the pill
      if (!onOpenColorPicker || !paletteButtonRef.current) return;
      const rect = paletteButtonRef.current.getBoundingClientRect();
      onOpenColorPicker(model.modelId, rect);
    },
    [model.modelId, onOpenColorPicker],
  );

  const handlePaletteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!onOpenColorPicker || !paletteButtonRef.current) return;
        const rect = paletteButtonRef.current.getBoundingClientRect();
        onOpenColorPicker(model.modelId, rect);
      }
    },
    [model.modelId, onOpenColorPicker],
  );

  const isActive = model.isActive;
  const showPaletteIcon = Boolean(onOpenColorPicker);
  // #528: Show dismiss × on active pills in selector context, unless it's the last.
  const showDismiss = isActive && showPaletteIcon && !isLastActive;

  // #531: Palette icon opacity now handled by CSS group-hover instead of JS state.
  // When isOverrideActive, icon is always visible. Otherwise: opacity-0 at rest,
  // group-hover:opacity-100 on pill hover. Explicit inline opacity only for the
  // override-active case (JS-driven value that CSS cannot express without data-attrs).
  const paletteIconStyle: React.CSSProperties = isOverrideActive
    ? { color: `var(--${model.color ?? 'accent-other'})` }
    : {};

  return (
    // Outer wrapper: positioned so the palette icon's absolute coords are relative to this div.
    // "group" class enables CSS group-hover for palette icon and dismiss × visibility.
    <div
      className={[
        'relative inline-flex items-center flex-shrink-0',
        showPaletteIcon ? 'group' : '',
      ].join(' ')}
    >
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        aria-label={`${model.name} — ${isActive ? 'active, click to deactivate' : 'inactive, click to activate'}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onAnimationEnd={handleAnimationEnd}
        className={[
          'inline-flex items-center gap-2 h-8 rounded-full',
          // Right padding: 28px in selector context (palette icon + gap), 12px otherwise.
          showPaletteIcon ? 'pl-3 pr-7' : 'px-3',
          'text-[13px] font-medium',
          'border',
          'transition-[background-color,border-color,opacity] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
          isActive
            ? 'bg-hover border-border text-text-primary'
            : 'bg-transparent border-border-subtle text-text-muted',
          isShaking ? 'pill-shake' : '',
        ].join(' ')}
      >
        {/* Color dot */}
        <span
          className="w-[7px] h-[7px] rounded-full flex-shrink-0 transition-opacity duration-fast"
          style={{
            ...getModelDotStyle(model.modelId),
            opacity: isActive ? 1 : 0.4,
          }}
          aria-hidden="true"
        />
        {/* Label */}
        {model.name}
      </button>

      {/* Palette icon — only in Model Selector Panel context.
          #531: opacity now CSS-only via group-hover. When isOverrideActive the icon
          is always visible (opacity-100); otherwise rests at opacity-0 and reveals
          on group hover or keyboard focus (focus-visible). */}
      {showPaletteIcon && (
        <button
          ref={paletteButtonRef}
          type="button"
          aria-label={`Customize accent color for ${model.name}`}
          onClick={handlePaletteClick}
          onKeyDown={handlePaletteKeyDown}
          className={[
            'absolute top-1/2 -translate-y-1/2',
            showDismiss ? 'right-[22px]' : 'right-2',
            'w-6 h-6 flex items-center justify-center',
            'rounded',
            'text-text-muted hover:text-text-secondary',
            'transition-[opacity,color] duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            'cursor-pointer',
            // Override-active: always visible. Otherwise: hidden at rest, shown on group hover or focus.
            isOverrideActive
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          ].join(' ')}
          style={paletteIconStyle}
        >
          <PaletteIcon />
        </button>
      )}

      {/* #528/#531: Dismiss × button — sibling to the right of the pill.
          tabIndex={-1}: keyboard users deactivate via the pill's role="switch" (Space/Enter).
          aria-hidden: the dismiss × is a pointer/touch shortcut duplicate of the switch affordance.
          #531: Enlarged to w-6 h-6 (24×24px, WCAG 2.5.8). Opacity is CSS-only:
          - pointer resting: opacity-[0.35]
          - touch resting: [@media(hover:none)]:opacity-[0.55]
          - pill group hover: group-hover:opacity-100
          - direct × hover: hover:opacity-100
          - prefers-reduced-motion: motion-reduce:transition-none
          Only rendered for active non-last pills in selector context. */}
      {showDismiss && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className={[
            'ml-1',
            'w-6 h-6 flex-shrink-0 flex items-center justify-center',
            'rounded-full',
            'text-[11px] leading-none font-medium',
            'text-text-muted hover:text-text-secondary hover:bg-hover',
            'transition-[opacity,color,background-color] duration-fast',
            'motion-reduce:transition-none',
            'cursor-pointer',
            'focus:outline-none',
            'opacity-[0.35]',
            'group-hover:opacity-100',
            'hover:opacity-100',
            '[@media(hover:none)]:opacity-[0.55]',
          ].join(' ')}
        >
          ×
        </button>
      )}
    </div>
  );
}
