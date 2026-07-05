/**
 * ConversationEmptyState — replaces the bare "Start a conversation" placeholder
 * shown in MessageThread when there are no messages yet.
 *
 * Three rendering states keyed on models.length:
 *   A (0 models) — defensive: "Select a model to get started"
 *   B (1 model)  — beacon + model name + "Ask [Name] anything"
 *   C (2+ models) — beacon row + heading + subtext + 3 suggestion chips
 *
 * Suggestion chips (State C only) call onSuggestionSelect with the chip text.
 * AppLayout wires this to a prefillText state that InputBar consumes.
 *
 * Motion:
 *   - Content block: emptyStateEnter (200ms ease-out, opacity + translateY)
 *   - Model beacons: beaconEnter (100ms ease-out, opacity + scale), staggered
 *     50ms per beacon via CSS custom property --beacon-index.
 *   - prefers-reduced-motion: both animations are suppressed by the overrides
 *     in index.css.
 *
 * Issue #341.
 */

import type { ModelConfig } from '@/types';
import { getModelDotStyle } from './utils/modelColor';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_VISIBLE_BEACONS = 4;

const SUGGESTION_CHIPS = [
  'Compare approaches to a decision',
  'What are the tradeoffs of X vs. Y?',
  'Explain something from different angles',
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ConversationEmptyStateProps {
  /** Active models for the current conversation — pre-filtered by AppLayout. */
  models: ModelConfig[];
  /**
   * Called when the user clicks a suggestion chip.
   * Receives the chip text; AppLayout stores it as prefillText and passes it
   * to InputBar, which populates the textarea and focuses it.
   */
  onSuggestionSelect: (text: string) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * A single model beacon: 20×20px colored circle above a 12px model name label.
 * The dot is aria-hidden; the visible label carries the accessible text.
 * Animation: beaconEnter keyframe, staggered by --beacon-index.
 */
function ModelBeacon({ model, index }: { model: ModelConfig; index: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="w-5 h-5 rounded-full beacon-enter flex-shrink-0"
        style={
          {
            ...getModelDotStyle(model.modelId),
            '--beacon-index': index,
          } as React.CSSProperties
        }
        aria-hidden="true"
      />
      <span className="text-[12px] font-medium text-text-muted leading-none">
        {model.name}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConversationEmptyState({
  models,
  onSuggestionSelect,
}: ConversationEmptyStateProps) {
  const visibleModels = models.slice(0, MAX_VISIBLE_BEACONS);
  const overflowCount = Math.max(0, models.length - MAX_VISIBLE_BEACONS);

  return (
    <div
      role="region"
      aria-label="New conversation"
      className="flex-1 flex flex-col items-center justify-center overflow-y-auto px-6 py-12"
    >
      {/* Content block — entrance animation via emptyStateEnter keyframe */}
      <div className="max-w-[480px] w-full text-center flex flex-col items-center empty-state-enter">

        {/* ── State A: no active models ───────────────────────────────── */}
        {models.length === 0 && (
          <h2 className="text-[18px] font-semibold text-text-primary">
            Select a model to get started
          </h2>
        )}

        {/* ── State B: single model ───────────────────────────────────── */}
        {models.length === 1 && (
          <div className="flex flex-col items-center">
            <span
              className="w-5 h-5 rounded-full beacon-enter flex-shrink-0"
              style={
                {
                  ...getModelDotStyle(models[0].modelId),
                  '--beacon-index': 0,
                } as React.CSSProperties
              }
              aria-hidden="true"
            />
            <p className="text-[12px] font-medium text-text-muted mt-2 leading-none">
              {models[0].name}
            </p>
            <h2 className="text-[20px] font-semibold text-text-primary mt-4">
              Ask {models[0].name} anything
            </h2>
          </div>
        )}

        {/* ── State C: 2+ models ─────────────────────────────────────── */}
        {models.length >= 2 && (
          <div className="flex flex-col items-center gap-8 w-full">

            {/* Beacon row — max 4 visible, then "+N" overflow label */}
            <div className="flex gap-5 justify-center items-end">
              {visibleModels.map((model, i) => (
                <ModelBeacon key={model.modelId} model={model} index={i} />
              ))}
              {overflowCount > 0 && (
                /* aria-hidden: decorative count — heading "Ask anything — all
                   models will respond" already conveys multi-model context.
                   Announcing "+1" without a label adds noise for screen readers. */
                <span
                  className="text-[13px] text-text-muted self-end leading-none pb-[1px]"
                  aria-hidden="true"
                >
                  +{overflowCount}
                </span>
              )}
            </div>

            {/* Copy block + chips */}
            <div className="flex flex-col gap-6 w-full">
              {/* Heading + subtext */}
              <div>
                <h2 className="text-[20px] font-semibold text-text-primary mb-2">
                  Ask anything — all models will respond
                </h2>
                <p className="text-[14px] leading-relaxed text-text-secondary">
                  Compare perspectives, get multiple takes, or let the models build on each other's answers.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTION_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    aria-label={`Start with: ${chip}`}
                    onClick={() => onSuggestionSelect(chip)}
                    className={[
                      'h-8 rounded-full px-3.5 py-1.5',
                      'flex items-center',
                      'border border-border-subtle bg-transparent',
                      'text-[13px] text-text-muted',
                      'hover:border-border hover:bg-hover hover:text-text-secondary',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-focus',
                      'transition-[background-color,border-color,color] duration-fast',
                      'cursor-pointer',
                    ].join(' ')}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
