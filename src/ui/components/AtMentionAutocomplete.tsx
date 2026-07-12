/**
 * AtMentionAutocomplete — popover that appears when the user types "@" in the
 * InputBar textarea. Lists active models and supports keyboard navigation.
 *
 * Accessibility pattern: combobox/listbox (ARIA 1.2 §3.8).
 *   - The textarea gets role="combobox", aria-expanded, aria-controls, aria-activedescendant.
 *   - The popover is role="listbox" with a matching id.
 *   - Each option is role="option" with aria-selected on the highlighted item.
 *   - Focus stays in the textarea; options are navigated via aria-activedescendant,
 *     NOT by moving DOM focus into the list.
 *
 * Issue #382.
 */

import { useEffect, useRef, useId } from 'react';
import type { ModelConfig } from '@/types';
import { resolveAccentCssColor } from '../utils/modelColor';

export interface AtMentionAutocompleteProps {
  /** Models to show in the list. Should already be filtered to active models. */
  models: ModelConfig[];
  /** The search string after "@" — used to filter the model list. */
  query: string;
  /** 0-based index of the currently highlighted option. -1 = none highlighted. */
  activeIndex: number;
  /** Called when the user selects a model (click or Enter). */
  onSelect: (model: ModelConfig) => void;
  /** Called when the popover should close without a selection (Escape / click-away). */
  onDismiss: () => void;
  /**
   * The textarea element that triggered the autocomplete. Used to:
   *   1. Return DOM focus on dismiss (focus never leaves the textarea).
   *   2. Exclude from click-away dismissal.
   */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /**
   * The div[role="combobox"] wrapper that owns the textarea. The ARIA combobox
   * attributes (aria-expanded, aria-controls, aria-autocomplete, aria-haspopup,
   * aria-activedescendant) are set on THIS element, not the textarea.
   *
   * Per ARIA 1.2 §3.8 and axe-core's aria-allowed-attr rule:
   *   - aria-activedescendant is NOT allowed on elements with role="textbox"
   *   - It IS allowed on elements with role="combobox"
   * The combobox wrapper is a <div> that the textarea lives inside; this keeps
   * axe-core's aria-allowed-role and aria-allowed-attr rules clean.
   */
  comboboxRef: React.RefObject<HTMLDivElement | null>;
  /** Stable DOM id to use for the listbox element. */
  listboxId: string;
}

/**
 * ID for a specific option element.
 * Consumed by aria-activedescendant on the textarea.
 */
export function getOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * Filters and sorts models by display name prefix match then substring match.
 * Returns at most 5 results (per spec: "Maximum 5 items visible without scroll").
 */
export function filterModels(models: ModelConfig[], query: string): ModelConfig[] {
  const q = query.toLowerCase();
  if (!q) return models.slice(0, 5);

  const prefix: ModelConfig[] = [];
  const substring: ModelConfig[] = [];

  for (const m of models) {
    const name = m.name.toLowerCase();
    if (name.startsWith(q)) {
      prefix.push(m);
    } else if (name.includes(q)) {
      substring.push(m);
    }
  }

  return [...prefix, ...substring].slice(0, 5);
}

export function AtMentionAutocomplete({
  models,
  query,
  activeIndex,
  onSelect,
  onDismiss,
  textareaRef,
  listboxId,
}: AtMentionAutocompleteProps) {
  const listboxRef = useRef<HTMLDivElement>(null);
  const filtered = filterModels(models, query);

  // Set ARIA attributes on the textarea while the popover is open.
  //
  // ARIA pattern: the <textarea> keeps its implicit "textbox" role.
  // We do NOT add role="combobox" — axe and ARIA 1.2 flag that as invalid
  // for <textarea> elements. Instead, we apply the combobox affordance via
  // aria-expanded, aria-controls, aria-autocomplete, aria-haspopup, and
  // aria-activedescendant directly on the textarea. This is the correct
  // pattern for a textarea-based autocomplete (per WAI-ARIA APG).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.setAttribute('aria-expanded', 'true');
    textarea.setAttribute('aria-controls', listboxId);
    textarea.setAttribute('aria-autocomplete', 'list');
    textarea.setAttribute('aria-haspopup', 'listbox');

    if (activeIndex >= 0 && activeIndex < filtered.length) {
      textarea.setAttribute('aria-activedescendant', getOptionId(listboxId, activeIndex));
    } else {
      textarea.removeAttribute('aria-activedescendant');
    }

    return () => {
      // Clean up ARIA attributes when the popover unmounts.
      textarea.removeAttribute('aria-expanded');
      textarea.removeAttribute('aria-controls');
      textarea.removeAttribute('aria-autocomplete');
      textarea.removeAttribute('aria-haspopup');
      textarea.removeAttribute('aria-activedescendant');
    };
  }, [textareaRef, listboxId, activeIndex, filtered.length]);

  // Scroll the active option into view within the listbox when it changes.
  // Guard against jsdom environments that do not implement scrollIntoView.
  useEffect(() => {
    if (activeIndex < 0 || !listboxRef.current) return;
    const option = listboxRef.current.querySelector<HTMLElement>(
      `[id="${getOptionId(listboxId, activeIndex)}"]`,
    );
    if (option && typeof option.scrollIntoView === 'function') {
      option.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, listboxId]);

  // Click-away dismissal — attach to document, exclude the listbox and textarea.
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        listboxRef.current &&
        !listboxRef.current.contains(e.target as Node) &&
        textareaRef.current !== e.target
      ) {
        onDismiss();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onDismiss, textareaRef]);

  if (filtered.length === 0) return null;

  return (
    /* Popover positions ABOVE the input bar. The parent container (InputBar's
       relative wrapper) provides the positioning context. The popover uses
       bottom-full so it sits immediately above the textarea container.
       Width matches the input bar width via left-0 right-0.
       z-50 to clear any other fixed UI elements. */
    <div
      ref={listboxRef}
      id={listboxId}
      role="listbox"
      aria-label="Mention a model"
      className={[
        'absolute bottom-full left-0 right-0 z-50',
        'mb-1',
        'bg-card border border-border rounded-lg shadow-lg',
        'overflow-y-auto',
        // Max height: 5 items × 44px each = 220px. Items beyond 5 scroll.
        'max-h-[220px]',
      ].join(' ')}
    >
      {filtered.map((model, index) => {
        const isActive = index === activeIndex;
        const accentCss = resolveAccentCssColor(model.color, model.modelId);
        const optionId = getOptionId(listboxId, index);

        return (
          <div
            key={model.modelId}
            id={optionId}
            role="option"
            aria-selected={isActive}
            // Use mousedown (not click) so the textarea does not blur before the
            // selection registers. preventDefault() keeps focus in the textarea.
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent textarea blur
              onSelect(model);
            }}
            className={[
              'flex items-center gap-3 px-4 py-2.5 cursor-pointer',
              'text-[14px] font-medium',
              'transition-colors duration-fast',
              isActive
                ? 'bg-active text-text-primary'
                : 'text-text-primary hover:bg-hover',
            ].join(' ')}
          >
            {/* Model identity dot — 7px, matches nameplate dot spec. */}
            <span
              className="w-[7px] h-[7px] rounded-full flex-shrink-0"
              aria-hidden="true"
              style={{ backgroundColor: accentCss }}
            />
            {/* Model display name */}
            <span>{model.name}</span>
          </div>
        );
      })}
    </div>
  );
}
