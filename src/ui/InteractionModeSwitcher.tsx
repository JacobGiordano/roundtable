import { useState, useRef, useCallback } from 'react';
import type { InteractionMode, InteractionModeConfig } from '@/types';

// ─── Mode registry ────────────────────────────────────────────────────────────

/**
 * Typed registry of all supported interaction modes.
 * Drives the switcher UI and tooltip copy.
 *
 * `comingSoon: true` marks modes that are not yet implemented. These modes are
 * rendered as non-interactive — visually present, never selectable. A "coming
 * soon" tooltip communicates why. This prevents users from reaching a state
 * where their selected mode is silently ignored by App.tsx:handleSend, which
 * always broadcasts in parallel.
 *
 * Issue #131: Auto-chain and Manual are disabled (Option 2). Do not enable
 * them until the respective dispatch logic lands in Atlas (handleSend must
 * actually respect the selected mode before the UI unlocks).
 */
interface InteractionModeEntry extends InteractionModeConfig {
  comingSoon?: boolean;
}

const INTERACTION_MODES: InteractionModeEntry[] = [
  {
    mode: 'parallel',
    label: 'Parallel',
    description: 'All active models respond simultaneously to every message.',
  },
  {
    mode: 'manual',
    label: 'Manual',
    description: 'You choose which model to send each message to.',
    comingSoon: true,
  },
  {
    mode: 'auto-chain',
    label: 'Auto-chain',
    description: 'Models respond in sequence, each building on the previous reply.',
    comingSoon: true,
  },
];

// ─── ModeButton ───────────────────────────────────────────────────────────────

/**
 * Tooltip anchor direction.
 * - 'left'   → tooltip left-aligns with the button (safe for leftmost item)
 * - 'center' → tooltip centers on the button
 * - 'right'  → tooltip right-aligns with the button (safe for rightmost item, prevents viewport clip)
 */
type TooltipAlign = 'left' | 'center' | 'right';

interface ModeButtonProps {
  config: InteractionModeEntry;
  isSelected: boolean;
  onSelect: (mode: InteractionMode) => void;
  /** Controls which edge the tooltip anchors to avoid viewport clipping. */
  tooltipAlign?: TooltipAlign;
}

function ModeButton({ config, isSelected, onSelect, tooltipAlign = 'center' }: ModeButtonProps) {
  // Tooltip horizontal positioning classes — chosen to prevent right-edge clipping
  const tooltipPositionClass =
    tooltipAlign === 'right'
      ? 'right-0'
      : tooltipAlign === 'left'
        ? 'left-0'
        : 'left-1/2 -translate-x-1/2';

  // Caret horizontal positioning — kept in sync with tooltip anchor
  const caretPositionClass =
    tooltipAlign === 'right'
      ? 'right-3'
      : tooltipAlign === 'left'
        ? 'left-3'
        : 'left-1/2 -translate-x-1/2';

  const isDisabled = config.comingSoon === true;
  const tooltipId = `interaction-mode-tooltip-${config.mode}`;

  // Tooltip copy: "coming soon" modes show a different description
  const tooltipContent = isDisabled
    ? 'Coming soon — not yet available'
    : config.description;

  // ── Tooltip show/hide state with 600ms hover delay (#211) ────────────────
  // Per tooltip.md §1: hover shows after 600ms (intentionality filter).
  // Focus shows immediately (0ms delay). Both hide immediately on leave/blur.
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => {
      setIsTooltipVisible(true);
    }, 600);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsTooltipVisible(false);
  }, []);

  const handleFocus = useCallback(() => {
    // Cancel any pending hover timer — focus wins with immediate show.
    if (hoverTimerRef.current !== null) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsTooltipVisible(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsTooltipVisible(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTooltipVisible(false);
      }
    },
    [],
  );

  if (isDisabled) {
    // Render as role="radio" + aria-disabled="true" so every ARIA-owned child of
    // the radiogroup has role="radio", satisfying aria-required-children without
    // an aria-owns workaround (#199). aria-disabled (not HTML disabled) keeps the
    // element in the tab order — keyboard users can Tab to it and hear the "coming
    // soon" tooltip, satisfying WCAG 4.1.2. tabIndex={0} is required because
    // <span> is not natively focusable.
    return (
      <div
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span
          role="radio"
          aria-checked={false}
          aria-disabled="true"
          aria-label={`${config.label} — coming soon`}
          aria-describedby={tooltipId}
          tabIndex={0}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className={[
            'relative h-7 px-3 rounded-full',
            'text-[12px] font-medium whitespace-nowrap',
            'border border-transparent',
            // Muted appearance makes non-interactivity visually clear
            'text-text-muted opacity-50',
            'cursor-not-allowed select-none',
            'inline-flex items-center',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          ].join(' ')}
        >
          {config.label}
        </span>

        {/* Tooltip — shown after 600ms hover delay (tooltip.md §1) */}
        <div
          id={tooltipId}
          role="tooltip"
          className={[
            `absolute bottom-full ${tooltipPositionClass} mb-2`,
            'w-max max-w-[200px]',
            'bg-sidebar border border-border rounded-sm shadow-md',
            'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
            'pointer-events-none',
            // Opacity controlled by JS state (not CSS group-hover) to allow
            // the 600ms intentionality delay. Exit is instant per spec.
            'transition-opacity duration-fast',
            'z-20',
            isTooltipVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
        >
          {tooltipContent}
          {/* Caret — anchored to match tooltip alignment */}
          <span
            className={`absolute top-full ${caretPositionClass} -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border`}
            aria-hidden="true"
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={`${config.label} — ${config.description}`}
        aria-describedby={tooltipId}
        onClick={() => onSelect(config.mode)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={[
          'relative h-7 px-3 rounded-full',
          'text-[12px] font-medium whitespace-nowrap',
          'border',
          'transition-[background-color,border-color,color] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none',
          isSelected
            ? 'bg-hover border-border text-text-primary'
            : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:border-border-subtle',
        ].join(' ')}
      >
        {config.label}
      </button>

      {/* Tooltip — shown after 600ms hover delay or immediately on focus (tooltip.md §1) */}
      <div
        id={tooltipId}
        role="tooltip"
        className={[
          `absolute bottom-full ${tooltipPositionClass} mb-2`,
          'w-max max-w-[200px]',
          'bg-sidebar border border-border rounded-sm shadow-md',
          'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
          'pointer-events-none',
          // Opacity controlled by JS state (not CSS group-hover) to allow
          // the 600ms intentionality delay. Exit is instant per spec.
          'transition-opacity duration-fast',
          'z-20',
          isTooltipVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      >
        {config.description}
        {/* Caret — anchored to match tooltip alignment */}
        <span
          className={`absolute top-full ${caretPositionClass} -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border`}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// ─── InteractionModeSwitcher ──────────────────────────────────────────────────

export interface InteractionModeSwitcherProps {
  /** Currently active interaction mode for the conversation. */
  activeMode: InteractionMode;
  /** Called when the user selects a different mode. Parent persists the change. */
  onModeChange: (mode: InteractionMode) => void;
}

/**
 * Segmented radio group for switching between Parallel / Manual / Auto-chain.
 * Reads from the `INTERACTION_MODES` registry for labels and tooltip descriptions.
 * Place above the InputBar in AppLayout (e.g. in the bottom controls strip).
 *
 * Layout: the radiogroup is `inline-flex` so it renders at natural content width.
 * Buttons use `whitespace-nowrap` to stay fully readable at all sizes.
 * The parent wrapper in AppLayout carries `flex-shrink-0` so the switcher is
 * never compressed — the ModelSelectorPanel side yields space instead.
 * Tooltips are edge-anchored: first item left-aligns, last item right-aligns,
 * middle item centers — preventing right-edge clipping for Auto-chain.
 *
 * Non-interactive modes: Manual and Auto-chain are rendered as `role="radio"`
 * + `aria-disabled="true"` elements with a "coming soon" tooltip. They cannot
 * be selected but are Tab-reachable so keyboard users can discover the tooltip.
 * Every child of the radiogroup has role="radio", satisfying aria-required-children
 * without an aria-owns workaround (#199). Only Parallel is selectable, reflecting
 * that App.tsx:handleSend always broadcasts in parallel. (#131)
 *
 * Tooltip delay: all tooltips in this component use the 600ms hover
 * intentionality filter per tooltip.md §1 (#211).
 */
export function InteractionModeSwitcher({
  activeMode,
  onModeChange,
}: InteractionModeSwitcherProps) {
  const lastIndex = INTERACTION_MODES.length - 1;

  // #221: sr-only span is a sibling of the radiogroup (not inside it) to prevent
  // double-read on older AT (JAWS ≤ 2022, some NVDA browse modes). The
  // aria-describedby reference on the radiogroup remains valid regardless of
  // DOM position — ids are document-scoped.
  return (
    <>
      <div
        role="radiogroup"
        aria-label="Interaction mode"
        aria-describedby="interaction-mode-coming-soon-note"
        className="inline-flex items-center gap-[2px] p-[3px] rounded-full bg-sidebar border border-border-subtle"
      >
        {INTERACTION_MODES.map((config, index) => {
          const tooltipAlign: TooltipAlign =
            index === 0 ? 'left' : index === lastIndex ? 'right' : 'center';
          return (
            <ModeButton
              key={config.mode}
              config={config}
              isSelected={activeMode === config.mode}
              onSelect={onModeChange}
              tooltipAlign={tooltipAlign}
            />
          );
        })}
      </div>
      {/* Visually-hidden note describing unavailable modes — #220/#221.
          Screen readers announce this when entering the radiogroup (via aria-describedby).
          Sits outside the radiogroup so AT does not read it twice in browse mode. */}
      <span
        id="interaction-mode-coming-soon-note"
        className="sr-only"
      >
        Manual and Auto-chain modes are coming soon and are not yet available.
      </span>
    </>
  );
}
