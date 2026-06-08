import type { InteractionMode, InteractionModeConfig } from '@/types';

// ─── Mode registry ────────────────────────────────────────────────────────────

/**
 * Typed registry of all supported interaction modes.
 * Drives the switcher UI and tooltip copy.
 */
const INTERACTION_MODES: InteractionModeConfig[] = [
  {
    mode: 'parallel',
    label: 'Parallel',
    description: 'All active models respond simultaneously to every message.',
  },
  {
    mode: 'manual',
    label: 'Manual',
    description: 'You choose which model to send each message to.',
  },
  {
    mode: 'auto-chain',
    label: 'Auto-chain',
    description: 'Models respond in sequence, each building on the previous reply.',
  },
];

// ─── ModeButton ───────────────────────────────────────────────────────────────

interface ModeButtonProps {
  config: InteractionModeConfig;
  isSelected: boolean;
  onSelect: (mode: InteractionMode) => void;
}

function ModeButton({ config, isSelected, onSelect }: ModeButtonProps) {
  return (
    <div className="relative group">
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        aria-label={`${config.label} — ${config.description}`}
        onClick={() => onSelect(config.mode)}
        className={[
          'relative h-7 px-3 rounded-full',
          'text-[12px] font-medium',
          'border',
          'transition-[background-color,border-color,color] duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          'cursor-pointer select-none whitespace-nowrap',
          isSelected
            ? 'bg-hover border-border text-text-primary'
            : 'bg-transparent border-transparent text-text-muted hover:text-text-secondary hover:border-border-subtle',
        ].join(' ')}
      >
        {config.label}
      </button>

      {/* Tooltip — shown on hover via group */}
      <div
        role="tooltip"
        className={[
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
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
        {/* Caret */}
        <span
          className="absolute top-full left-1/2 -translate-x-1/2 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
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
 */
export function InteractionModeSwitcher({
  activeMode,
  onModeChange,
}: InteractionModeSwitcherProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Interaction mode"
      className="inline-flex items-center gap-[2px] p-[3px] rounded-full bg-sidebar border border-border-subtle"
    >
      {INTERACTION_MODES.map((config) => (
        <ModeButton
          key={config.mode}
          config={config}
          isSelected={activeMode === config.mode}
          onSelect={onModeChange}
        />
      ))}
    </div>
  );
}
