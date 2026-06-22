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
 * - Pill has position:relative and right padding of 28px.
 * - A palette icon button is absolutely positioned at right:8px.
 * - Icon is opacity-0 normally, opacity-100 on pill hover/focus.
 * - If isOverrideActive, icon is always visible with the model's accent color.
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
  const [isPillHovered, setIsPillHovered] = useState(false);
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

  // Icon visibility: always-on if override is active, otherwise hover/focus only.
  const paletteIconOpacity = isOverrideActive || isPillHovered ? 1 : 0;

  // Icon color: when override is active, use the model's current accent CSS var.
  // Per spec: "its color is var(--accent-{modelId})".
  // The CSS custom property name for the model is: --accent-{baseId}
  // e.g. "accent-claude", "accent-gpt", "accent-gemini", etc.
  // ModelConfig.color already holds the CSS var name (e.g. "accent-claude").
  const paletteIconStyle: React.CSSProperties = isOverrideActive
    ? { color: `var(--${model.color ?? 'accent-other'})` }
    : {};

  return (
    <div
      className={[
        // flex-shrink-0 prevents pill from compressing when inside the
        // horizontally-scrollable pills row on narrow screens.
        'relative inline-flex flex-shrink-0',
        showPaletteIcon ? 'group' : '',
      ].join(' ')}
      onMouseEnter={() => showPaletteIcon && setIsPillHovered(true)}
      onMouseLeave={() => showPaletteIcon && setIsPillHovered(false)}
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
          // Right padding: 28px in selector context (icon + gap), 12px otherwise.
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

      {/* Palette icon — only in Model Selector Panel context */}
      {showPaletteIcon && (
        <button
          ref={paletteButtonRef}
          type="button"
          aria-label={`Customize accent color for ${model.name}`}
          onClick={handlePaletteClick}
          onKeyDown={handlePaletteKeyDown}
          className={[
            'absolute top-1/2 -translate-y-1/2',
            'right-2',
            'w-[18px] h-[18px] flex items-center justify-center',
            'rounded',
            'text-text-muted hover:text-text-secondary',
            'transition-[opacity,color] duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            'cursor-pointer',
          ].join(' ')}
          style={{ opacity: paletteIconOpacity, ...paletteIconStyle }}
        >
          <PaletteIcon />
        </button>
      )}
    </div>
  );
}
