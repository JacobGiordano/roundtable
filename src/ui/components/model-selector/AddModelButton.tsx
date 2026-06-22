/**
 * AddModelButton — dashed-border pill that opens a dropdown of inactive models to add back.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
 * Hidden when all models are already active.
 *
 * The dropdown is rendered via createPortal into document.body with
 * position:fixed coordinates derived from getBoundingClientRect(). This
 * escapes the panel's overflow-y:auto container, which would otherwise clip
 * the absolutely-positioned dropdown invisible. Follows the same pattern as
 * AccentColorPicker (also fixed-positioned via anchorRect).
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ModelConfig, ModelId } from '@/types';
// #149: shared click-outside hook replaces the inline document.addEventListener pattern.
import { useClickOutside } from '@/ui/hooks/useClickOutside';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

/**
 * Lookup map from modelId → providerName, built once from MODEL_REGISTRY.
 * Used by AddModelButton to render the correct provider label for any model
 * without hardcoding per-model ternaries.
 *
 * Imported lazily from @/models to avoid a circular dependency at module load time.
 * Cross-agent exception: MODEL_REGISTRY is a pure data export from @/models —
 * read-only registry of all model display metadata.
 */
import { MODEL_REGISTRY } from '@/models';

const PROVIDER_NAME_BY_MODEL_ID = new Map(
  MODEL_REGISTRY.map((entry) => [entry.modelId, entry.providerName]),
);

export interface AddModelButtonProps {
  availableModels: ModelConfig[];
  onAdd: (modelId: ModelId) => void;
}

export function AddModelButton({ availableModels, onAdd }: AddModelButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Viewport-relative position for the portal dropdown, captured on open.
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const DROPDOWN_WIDTH = 220;
  const VERTICAL_GAP = 4;

  const openDropdown = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Prefer rendering above the button; if not enough room above, render below.
    const spaceAbove = rect.top;
    const APPROX_DROPDOWN_HEIGHT = 200; // conservative estimate
    const flipBelow = spaceAbove < APPROX_DROPDOWN_HEIGHT + VERTICAL_GAP;

    const style: React.CSSProperties = {
      position: 'fixed',
      width: DROPDOWN_WIDTH,
      zIndex: 50,
      left: rect.left,
    };

    if (flipBelow) {
      style.top = rect.bottom + VERTICAL_GAP;
    } else {
      style.bottom = window.innerHeight - rect.top + VERTICAL_GAP;
    }

    setDropdownStyle(style);
    setIsOpen(true);
  }, []);

  const closeDropdown = useCallback(() => setIsOpen(false), []);

  // Close on outside click — shared hook (#149). Pass both refs so clicking
  // either the trigger button or the portal dropdown does not close the menu.
  useClickOutside([buttonRef, dropdownRef], closeDropdown, isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDropdown();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDropdown]);

  if (availableModels.length === 0) return null;

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Available models"
          style={dropdownStyle}
          className={[
            'max-h-[240px] overflow-y-auto',
            'bg-card border border-border rounded-md shadow-md',
            'py-1',
          ].join(' ')}
        >
          {availableModels.map((model) => (
            <button
              key={model.modelId}
              type="button"
              role="menuitem"
              onClick={() => {
                onAdd(model.modelId);
                closeDropdown();
              }}
              className={[
                'w-full flex items-center gap-3 h-10 px-3',
                'text-left cursor-pointer',
                'hover:bg-hover',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset focus-visible:bg-hover',
              ].join(' ')}
            >
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={getModelDotStyle(model.modelId)}
                aria-hidden="true"
              />
              <span className="text-[14px] text-text-primary flex-1 truncate">{model.name}</span>
              <span className="text-[12px] text-text-muted flex-shrink-0">
                {PROVIDER_NAME_BY_MODEL_ID.get(model.modelId) ?? 'Unknown'}
              </span>
            </button>
          ))}
        </div>,
        document.body,
      )
    : null;

  return (
    // flex-shrink-0: prevents the add button from compressing in the horizontal
    // scroll container on narrow screens (same as ModelPill outer wrapper).
    <div className="flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Add model to conversation"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className={[
          'inline-flex items-center gap-2 h-8 rounded-full',
          'px-3',
          'text-[13px] font-medium text-text-muted',
          'border border-dashed border-border',
          'transition-[border-color] duration-fast hover:border-border-strong',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
        ].join(' ')}
      >
        <span aria-hidden="true" className="text-[14px] leading-none">+</span>
        Add model
      </button>

      {dropdown}
    </div>
  );
}
