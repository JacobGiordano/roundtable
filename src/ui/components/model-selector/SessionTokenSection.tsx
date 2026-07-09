/**
 * SessionTokenSection — collapsible per-model token usage display.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
 *
 * Hidden by default — user expands on demand (progressive disclosure).
 * Sits below the System Prompts section in the ModelSelectorPanel slide-up panel.
 *
 * #353: Added cost column (per-model + session total) and staleness footer.
 *
 * Cross-agent import: getPricingMetadata() is a pure read-only utility from
 * Gate (@/auth) — it reads localStorage synchronously and never mutates state.
 * It is imported here under the same exception that allows getSessionTokenUsage()
 * from @/models: small, pure, synchronous getters that don't drag in provider
 * side-effects. Only the metadata is read; key management and API calls stay in Gate.
 */

import { useState, useCallback, useEffect } from 'react';
import type { ModelConfig, SessionTokenUsage, TokenCountVisibility } from '@/types';
// #150: shared ChevronIcon replaces the local copy.
import { ChevronIcon } from '../ChevronIcon';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';
// #353: Cross-agent Gate exception — pure synchronous read; see module docstring.
import { getPricingMetadata } from '@/auth';
// #357: formatCost extracted to shared util so MessageBubble can reuse it.
import { formatCost } from '@/ui/utils/formatCost';

type StalenessState = 'never-fetched' | 'fresh' | 'stale-24h' | 'stale-48h';

const H24 = 24 * 60 * 60 * 1000;
const H48 = 48 * 60 * 60 * 1000;

/**
 * Classifies pricing data freshness based on the lastFetched ISO string.
 *   null          → 'never-fetched' (pricing has never been loaded; hide cost column)
 *   ≤ 24h old     → 'fresh' (no footer)
 *   24h – 48h old → 'stale-24h' (soft warning, text-muted)
 *   > 48h old     → 'stale-48h' (hard warning, text-warning)
 */
function getStalenessState(lastFetched: string | null): StalenessState {
  if (!lastFetched) return 'never-fetched';
  const ageMs = Date.now() - new Date(lastFetched).getTime();
  if (ageMs <= H24) return 'fresh';
  if (ageMs <= H48) return 'stale-24h';
  return 'stale-48h';
}

/** Returns a short human-readable age string, e.g. "26h" or "3d". */
function formatAge(lastFetched: string): string {
  const ageMs = Date.now() - new Date(lastFetched).getTime();
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface SessionTokenSectionProps {
  /**
   * Per-model session totals. Computed from all messages in the active
   * conversation via getSessionTokenUsage() from @/models (documented exception).
   * In App.tsx, each entry is enriched with estimatedCost before being passed here.
   */
  sessionUsage: SessionTokenUsage[];
  activeModels: ModelConfig[];
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility:
   *   'always' — section rendered; counts always visible when expanded
   *   'active' — section rendered (default); standard collapse/expand behavior
   *   'never'  — section removed from DOM entirely (null return)
   */
  tokenCountVisibility?: TokenCountVisibility;
}

export function SessionTokenSection({
  sessionUsage,
  activeModels,
  tokenCountVisibility = 'active',
}: SessionTokenSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Re-read pricing metadata when a background fetch lands (same-tab event).
  const [, setPricingTick] = useState(0);
  useEffect(() => {
    const handler = () => setPricingTick((n) => n + 1);
    window.addEventListener('roundtable:pricing-updated', handler);
    return () => window.removeEventListener('roundtable:pricing-updated', handler);
  }, []);

  const handleToggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  // 'never': remove from DOM entirely (not CSS hidden — fully absent from accessibility tree)
  if (tokenCountVisibility === 'never') return null;

  // Only show section if we have any usage data at all
  if (sessionUsage.length === 0) return null;

  // #353: Read pricing metadata to determine cost-column visibility and staleness.
  // getPricingMetadata() is synchronous — safe to call during render.
  const pricingMeta = getPricingMetadata();
  const staleness = getStalenessState(pricingMeta.lastFetched);
  const showCostColumn = staleness !== 'never-fetched';

  const sessionTotal = sessionUsage.reduce((sum, u) => sum + u.totalTokens, 0);

  // Session-wide estimated cost — only meaningful when cost column is shown.
  const sessionTotalCost = showCostColumn
    ? sessionUsage.reduce((sum, u) => sum + (u.estimatedCost ?? 0), 0)
    : 0;
  const sessionTotalCostStr = showCostColumn ? formatCost(sessionTotalCost) : null;

  // Human-readable exact timestamp for the staleness tooltip.
  const lastFetchedDisplay = pricingMeta.lastFetched
    ? new Date(pricingMeta.lastFetched).toLocaleString()
    : '';

  return (
    <div className="mt-4 pt-4 border-t border-border-subtle">
      {/* Section header — always visible, acts as the toggle */}
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls="session-token-panel"
        onClick={handleToggle}
        className={[
          'w-full flex items-center justify-between',
          'cursor-pointer select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          'rounded',
          'hover:bg-hover transition-colors duration-fast',
          'px-1 py-[2px]',
          'mb-1',
        ].join(' ')}
      >
        <p className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em]">
          Token usage
        </p>
        <div className="flex items-center gap-2">
          {/* Session total — always visible as a quick summary.
              #357: append estimated cost when available (formatCost returns null for
              undefined/zero, so the · separator only appears when cost data exists). */}
          <span
            className="text-[11px] text-text-muted tabular-nums"
            aria-label={sessionTotalCostStr !== null
              ? `${sessionTotal.toLocaleString()} tokens, estimated cost ${sessionTotalCostStr}`
              : `${sessionTotal.toLocaleString()} tokens`}
          >
            {sessionTotal.toLocaleString()} tokens{sessionTotalCostStr !== null ? ` · ${sessionTotalCostStr}` : ''}
          </span>
          <ChevronIcon isOpen={isExpanded} />
        </div>
      </button>

      {/* Per-model breakdown — revealed on expand. Always in DOM so aria-controls resolves. */}
      <div
        id="session-token-panel"
        hidden={!isExpanded}
        className="rounded-md border border-border-subtle overflow-hidden"
      >
        {sessionUsage.map((usage, i) => {
          // Find the display name for this modelId
          const modelConfig = activeModels.find((m) => m.modelId === usage.modelId);
          const displayName = modelConfig?.name ?? usage.modelId;
          const costStr = showCostColumn ? formatCost(usage.estimatedCost) : null;

          return (
            <div
              key={usage.modelId}
              className={[
                'flex items-center gap-2 px-3 py-2',
                i < sessionUsage.length - 1 ? 'border-b border-border-subtle' : '',
              ].join(' ')}
            >
              {/* Color dot — getModelDotStyle handles fallback to accent-other internally */}
              <span
                className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                style={getModelDotStyle(usage.modelId)}
                aria-hidden="true"
              />

              {/* Model name */}
              <span className="text-[12px] text-text-secondary flex-1 font-medium">
                {displayName}
              </span>

              {/* Per-model token breakdown + optional cost */}
              <div className="flex items-center gap-3 text-[11px] text-text-muted tabular-nums">
                <span title="Input tokens">
                  ↑ {usage.inputTokens.toLocaleString()}
                </span>
                <span title="Output tokens">
                  ↓ {usage.outputTokens.toLocaleString()}
                </span>
                <span
                  className="font-medium text-text-secondary"
                  title="Total tokens this session"
                >
                  {usage.totalTokens.toLocaleString()}
                </span>
                {/* #353: Cost cell — only rendered when pricing data is available */}
                {/* aria-label overrides the visual "· $X.XX" for screen readers, */}
                {/* removing the orphaned interpunct (·) from the announcement. */}
                {costStr !== null && (
                  <span
                    aria-label={`Estimated cost: ${costStr}`}
                    title="Estimated cost this session"
                    className="text-text-muted"
                  >
                    · {costStr}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {/* #353: Session total row — shown when cost column is visible */}
        {sessionUsage.length > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border-subtle bg-hover">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-[0.06em]">
              Session total
            </span>
            <div className="flex items-center gap-3 text-[11px] text-text-muted tabular-nums">
              <span className="font-medium text-text-secondary">
                {sessionTotal.toLocaleString()} tokens
              </span>
              {sessionTotalCostStr !== null && (
                <span
                  aria-label={`Session estimated cost: ${sessionTotalCostStr}`}
                  className="text-text-muted"
                >
                  · {sessionTotalCostStr}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* #353: Staleness footer — only for stale-24h and stale-48h states */}
      {(staleness === 'stale-24h' || staleness === 'stale-48h') && (
        // tabIndex={0} makes this reachable by keyboard so screen-reader users
        // can trigger the title tooltip via focus. The span is read-only; no role
        // change needed — aria-label describes the accessible name.
        <span
          tabIndex={0}
          title={lastFetchedDisplay}
          aria-label={`Pricing data age: ${formatAge(pricingMeta.lastFetched!)} old — fetched ${lastFetchedDisplay}`}
          className={[
            'mt-1 px-1 block text-[10px] cursor-default select-none rounded',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
            staleness === 'stale-48h' ? 'text-warning' : 'text-text-muted',
          ].join(' ')}
        >
          {staleness === 'stale-48h'
            ? `Pricing outdated — last updated ${formatAge(pricingMeta.lastFetched!)} ago`
            : `Pricing last updated ${formatAge(pricingMeta.lastFetched!)} ago`}
        </span>
      )}
    </div>
  );
}
