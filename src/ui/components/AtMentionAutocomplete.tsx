/**
 * AtMentionAutocomplete — popover that appears when the user types "@" in the
 * InputBar textarea. Lists active models and supports keyboard navigation.
 *
 * Accessibility pattern: ARIA 1.2 §3.8 combobox with listbox popup.
 *
 * ARIA structure:
 *   - A wrapper <div role="combobox"> carries aria-expanded, aria-controls,
 *     aria-haspopup, and aria-activedescendant. This is the ARIA 1.2 §3.8 pattern.
 *   - The <textarea> inside keeps its implicit "textbox" role and only carries
 *     aria-autocomplete="list" (valid on textbox). It does NOT get role="combobox"
 *     (axe-core aria-allowed-role violation) or aria-activedescendant (axe-core
 *     aria-allowed-attr violation on textbox-role elements).
 *   - The popover is role="listbox" with a matching id.
 *   - Each option is role="option" with aria-selected on the highlighted item.
 *   - Focus stays in the textarea; options are navigated via aria-activedescendant
 *     on the combobox wrapper, NOT by moving DOM focus into the list.
 *
 * Why comboboxRef instead of textareaRef for ARIA?
 *   axe-core's aria-allowed-attr rule prohibits aria-activedescendant on elements
 *   with role="textbox". It IS allowed on role="combobox". Since role="combobox"
 *   is also not valid on <textarea> (aria-allowed-role), the correct solution is
 *   a wrapper <div role="combobox"> that the textarea lives inside.
 *
 * Issue #382.
 */

import { useEffect, useRef } from 'react';
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
   *   1. Exclude from click-away dismissal (pointerdown handler).
   *   2. Set aria-autocomplete="list" — the only ARIA attribute valid on textbox.
   */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  /**
   * The div[role="combobox"] wrapper that contains the textarea. This element
   * receives the combobox ARIA state: aria-expanded, aria-controls, aria-haspopup,
   * aria-activedescendant. These attributes are NOT placed on the textarea because:
   *   - role="combobox" on <textarea> → axe aria-allowed-role violation
   *   - aria-activedescendant on textbox-role element → axe aria-allowed-attr violation
   */
  comboboxRef: React.RefObject<HTMLDivElement | null>;
  /** Stable DOM id to use for the listbox element. */
  listboxId: string;
}

/**
 * ID for a specific option element.
 * Consumed by aria-activedescendant on the combobox wrapper div.
 * Exported for use in InputBar.tsx (keyboard nav) and tests.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function getOptionId(listboxId: string, index: number): string {
  return `${listboxId}-option-${index}`;
}

/**
 * Filters and sorts models by display name prefix match then substring match.
 * Returns at most 5 results (per spec: "Maximum 5 items visible without scroll").
 * Exported for use in InputBar.tsx (mention candidate computation) and tests.
 */
// eslint-disable-next-line react-refresh/only-export-components
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
  comboboxRef,
  listboxId,
}: AtMentionAutocompleteProps) {
  const listboxRef = useRef<HTMLDivElement>(null);
  const filtered = filterModels(models, query);

  // Set ARIA attributes on the div[role="combobox"] wrapper while the popover is open.
  //
  // ARIA 1.2 §3.8: the combobox wrapper div carries all combobox state attributes.
  // The textarea inside only receives aria-autocomplete="list" (valid on textbox-role).
  //
  // aria-activedescendant on the combobox wrapper points to the virtually "focused"
  // option element. AT announces the option name without DOM focus leaving the textarea.
  useEffect(() => {
    const combobox = comboboxRef.current;
    const textarea = textareaRef.current;
    if (!combobox) return;

    combobox.setAttribute('aria-expanded', 'true');
    combobox.setAttribute('aria-controls', listboxId);
    combobox.setAttribute('aria-haspopup', 'listbox');

    if (activeIndex >= 0 && activeIndex < filtered.length) {
      combobox.setAttribute('aria-activedescendant', getOptionId(listboxId, activeIndex));
    } else {
      combobox.removeAttribute('aria-activedescendant');
    }

    // aria-autocomplete="list" is valid on role="textbox" — set it on the textarea.
    if (textarea) {
      textarea.setAttribute('aria-autocomplete', 'list');
    }

    return () => {
      // Restore the closed-state ARIA attributes when the popover unmounts.
      // aria-expanded is set to "false" (not removed) because role="combobox"
      // requires aria-expanded to be present — removing it would trigger an
      // axe aria-required-attr violation. The div always has role="combobox"
      // with aria-expanded="false" when closed.
      combobox.setAttribute('aria-expanded', 'false');
      combobox.removeAttribute('aria-controls');
      combobox.removeAttribute('aria-haspopup');
      combobox.removeAttribute('aria-activedescendant');
      if (textarea) {
        textarea.removeAttribute('aria-autocomplete');
      }
    };
  }, [comboboxRef, textareaRef, listboxId, activeIndex, filtered.length]);

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
