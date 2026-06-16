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

  if (isDisabled) {
    // Render as a non-interactive span so it cannot be focused or activated.
    // aria-disabled is not used on a span (it only applies to interactive roles).
    // Screen readers will read the label from the tooltip via aria-describedby
    // is not needed here — the span is non-interactive and carries no role.
    // The "coming soon" text is conveyed visually via the tooltip on hover.
    return (
      <div className="relative group">
        <span
          aria-hidden="false"
          aria-label={`${config.label} — coming soon`}
          aria-describedby={tooltipId}
          className={[
            'relative h-7 px-3 rounded-full',
            'text-[12px] font-medium whitespace-nowrap',
            'border border-transparent',
            // Muted appearance makes non-interactivity visually clear
            'text-text-muted opacity-50',
            'cursor-not-allowed select-none',
            'inline-flex items-center',
          ].join(' ')}
        >
          {config.label}
        </span>

        {/* Tooltip — shown on hover via group */}
        <div
          id={tooltipId}
          role="tooltip"
          className={[
            `absolute bottom-full ${tooltipPositionClass} mb-2`,
            'w-max max-w-[200px]',
            'bg-sidebar border border-border rounded-sm shadow-md',
            'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
            'pointer-events-none',
            'opacity-0 group-hover:opacity-100',
            // Respect prefers-reduced-motion — see global CSS
            'transition-opacity duration-fast',
            'z-20',
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
    <div className="relative group">
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={`${config.label} — ${config.description}`}
        aria-describedby={tooltipId}
        onClick={() => onSelect(config.mode)}
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

      {/* Tooltip — shown on hover via group */}
      <div
        id={tooltipId}
        role="tooltip"
        className={[
          `absolute bottom-full ${tooltipPositionClass} mb-2`,
          'w-max max-w-[200px]',
          'bg-sidebar border border-border rounded-sm shadow-md',
          'px-3 py-2 text-[11px] leading-[1.4] text-text-primary',
          'pointer-events-none',
          'opacity-0 group-hover:opacity-100',
          // Respect prefers-reduced-motion — see global CSS
          'transition-opacity duration-fast',
          'z-20',
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
 * Non-interactive modes: Manual and Auto-chain are rendered as non-interactive
 * spans with a "coming soon" tooltip. They cannot be selected. Only Parallel
 * is selectable. This reflects that App.tsx:handleSend always broadcasts in
 * parallel — the UI must not imply otherwise. (#131)
 */
export function InteractionModeSwitcher({
  activeMode,
  onModeChange,
}: InteractionModeSwitcherProps) {
  const lastIndex = INTERACTION_MODES.length - 1;

  return (
    <div
      role="radiogroup"
      aria-label="Interaction mode"
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
  );
}
