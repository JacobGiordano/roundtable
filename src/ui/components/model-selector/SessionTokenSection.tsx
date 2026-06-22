/**
 * SessionTokenSection — collapsible per-model token usage display.
 *
 * Extracted from ModelSelectorPanel.tsx (#146) to improve maintainability.
 *
 * Hidden by default — user expands on demand (progressive disclosure).
 * Sits below the System Prompts section in the ModelSelectorPanel slide-up panel.
 */

import { useState, useCallback } from 'react';
import type { ModelConfig, SessionTokenUsage, TokenCountVisibility } from '@/types';
// #150: shared ChevronIcon replaces the local copy.
import { ChevronIcon } from '../ChevronIcon';
// #148: getModelDotStyle is the shared utility for model identity dot colors.
import { getModelDotStyle } from '@/ui/utils/modelColor';

export interface SessionTokenSectionProps {
  /**
   * Per-model session totals. Computed from all messages in the active
   * conversation via getSessionTokenUsage() from @/models (documented exception).
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

  const handleToggle = useCallback(() => setIsExpanded((prev) => !prev), []);

  // 'never': remove from DOM entirely (not CSS hidden — fully absent from accessibility tree)
  if (tokenCountVisibility === 'never') return null;

  // Only show section if we have any usage data at all
  if (sessionUsage.length === 0) return null;

  const sessionTotal = sessionUsage.reduce((sum, u) => sum + u.totalTokens, 0);

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
          {/* Session total — always visible as a quick summary */}
          <span className="text-[11px] text-text-muted tabular-nums">
            {sessionTotal.toLocaleString()} total
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

              {/* Per-model token breakdown */}
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
