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
  // #253: Track active focus index without triggering an extra render on each
  // arrow-key press. A ref is the right tool here — focus state is ephemeral
  // and does not need to drive any rendering.
  const activeFocusIndexRef = useRef<number>(-1);

  const DROPDOWN_WIDTH = 220;
  const VERTICAL_GAP = 4;

  /** Returns the list of focusable menuitems from the portal dropdown. */
  const getMenuItems = useCallback((): HTMLElement[] => {
    if (!dropdownRef.current) return [];
    return Array.from(dropdownRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }, []);

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
    activeFocusIndexRef.current = -1;
    setIsOpen(true);
  }, []);

  const closeDropdown = useCallback(() => {
    activeFocusIndexRef.current = -1;
    setIsOpen(false);
  }, []);

  /** Close menu and return focus to the trigger button (Escape / Tab). */
  const closeAndReturn = useCallback(() => {
    closeDropdown();
    buttonRef.current?.focus();
  }, [closeDropdown]);

  // Close on outside click — shared hook (#149). Pass both refs so clicking
  // either the trigger button or the portal dropdown does not close the menu.
  useClickOutside([buttonRef, dropdownRef], closeDropdown, isOpen);

  // #253: When the menu opens, move focus to the first menuitem (WCAG 2.4.3).
  // Items are already in the DOM when isOpen flips to true (portal is rendered
  // synchronously), so a single rAF is sufficient — no double-rAF needed.
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      const items = getMenuItems();
      if (items.length > 0) {
        activeFocusIndexRef.current = 0;
        items[0].focus();
      }
    });
  }, [isOpen, getMenuItems]);

  // #253: WAI-ARIA Menu Button keyboard contract on the portal dropdown.
  // Arrow keys move focus within the menu; Tab closes the menu naturally;
  // Escape closes and returns focus to the trigger.
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = getMenuItems();
      if (items.length === 0) return;

      const currentIndex = activeFocusIndexRef.current;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = (currentIndex + 1) % items.length;
          activeFocusIndexRef.current = nextIndex;
          items[nextIndex].focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = (currentIndex - 1 + items.length) % items.length;
          activeFocusIndexRef.current = prevIndex;
          items[prevIndex].focus();
          break;
        }
        case 'Home': {
          e.preventDefault();
          activeFocusIndexRef.current = 0;
          items[0].focus();
          break;
        }
        case 'End': {
          e.preventDefault();
          const lastIndex = items.length - 1;
          activeFocusIndexRef.current = lastIndex;
          items[lastIndex].focus();
          break;
        }
        case 'Tab': {
          // Tab closes the menu and lets focus move naturally — do NOT trap.
          // Unlike Escape, we do not call e.preventDefault() here; the browser
          // handles the natural Tab focus movement after closeDropdown().
          closeDropdown();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          closeAndReturn();
          break;
        }
      }
    },
    [getMenuItems, closeDropdown, closeAndReturn],
  );

  if (availableModels.length === 0) return null;

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          role="menu"
          aria-label="Available models"
          style={dropdownStyle}
          onKeyDown={handleMenuKeyDown}
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
              // tabIndex={-1}: keeps menuitems out of the page Tab order.
              // Focus is managed programmatically via arrow keys (WAI-ARIA menu pattern).
              tabIndex={-1}
              onClick={() => {
                onAdd(model.modelId);
                closeDropdown();
              }}
              className={[
                'w-full flex items-center gap-3 h-10 px-3',
                'text-left cursor-pointer',
                'hover:bg-hover',
                'transition-colors duration-fast',
                // tabIndex={-1} elements use focus:outline-none (not focus-visible:ring)
                // — they are programmatic focus targets only, not in the Tab order.
                'focus:outline-none focus:bg-hover',
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
        onClick={() => (isOpen ? closeAndReturn() : openDropdown())}
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
