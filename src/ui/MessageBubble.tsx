import { useState } from 'react';
import type { Message, ModelConfig, ModelError, ModelId, TokenCountVisibility } from '@/types';

interface MessageBubbleProps {
  message: Message;
  modelConfig?: ModelConfig;
  /** Shown when the model returned an error for this message. */
  error?: ModelError;
  /** Called when the user clicks Retry on an errored bubble. Atlas wires the actual retry. */
  onRetry?: () => void;
  /** Stagger index for bubble entrance animation delay (0-based). */
  entranceIndex?: number;
  /**
   * When provided, a "Reply to [Model]" affordance is shown on hover for assistant bubbles.
   * Called with the modelId of the model whose bubble was clicked.
   * Only rendered when the message is an assistant message with a known modelId.
   */
  onDirectedReply?: (modelId: ModelId) => void;
  /**
   * ModelConfig for the model this message was directed at (message.targetModelId).
   * When present, a subtle "→ [Model]" label is rendered below the message content.
   */
  targetModelConfig?: ModelConfig;
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility:
   *   'always' — shown unconditionally on completed messages (no hover required)
   *   'active' — hover-reveal (default; opacity-0 at rest, opacity-100 on hover)
   *   'never'  — removed from DOM entirely (null return, not CSS hide)
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
}

/** Maps a ModelId to the data-model attribute value for streaming shimmer CSS targeting. */
function getModelDataAttr(modelId: string | undefined): string {
  return modelId ?? 'other';
}

export function MessageBubble({
  message,
  modelConfig,
  error,
  onRetry,
  entranceIndex = 0,
  onDirectedReply,
  targetModelConfig,
  tokenCountVisibility = 'active',
}: MessageBubbleProps) {
  const isStreaming = message.isStreaming ?? false;
  const hasError    = !!error;
  // Token count and directed-reply affordance are hidden by default; revealed on hover.
  const [isHovered, setIsHovered] = useState(false);

  // Entrance animation stagger via inline style
  const entranceDelay = `${entranceIndex * 100}ms`;

  // Left border color: read from ModelConfig.color (CSS custom property), error overrides.
  // accent-other is only used when modelConfig is genuinely absent/unknown.
  const accentColor = modelConfig?.color ?? 'accent-other';
  const borderLeftColor = hasError ? 'var(--error)' : `var(--${accentColor})`;

  // Only assistant messages from a model show the name header
  const showHeader = message.role === 'assistant' && modelConfig;

  // "Reply to [Model]" affordance: only on completed assistant messages with a known modelId
  const canDirectReply =
    !!onDirectedReply &&
    message.role === 'assistant' &&
    !!message.modelId &&
    !isStreaming;

  // Determine whether to render the token count element and whether it needs
  // opacity control. 'never' removes it from the DOM entirely (accessibility tree included).
  const showTokenCount = tokenCountVisibility !== 'never' && !!message.tokenUsage;

  // The bottom row hosts both the reply button and the token count. It is
  // rendered when at least one of the two is applicable AND the message is done.
  // With 'never', the token count is suppressed but the reply button can still appear.
  const showBottomRow = !isStreaming && (canDirectReply || showTokenCount);

  // Opacity of the bottom row:
  //   'always'  — always visible (1) when row is rendered
  //   'active'  — hover-controlled
  //   'never'   — token count already excluded; reply button uses same hover logic
  const rowVisible = tokenCountVisibility === 'always' ? true : isHovered;

  return (
    <div
      className={[
        'relative w-full bg-card rounded-md shadow-sm hover:shadow-md',
        'border-l-[3px]',
        'px-4 py-3',
        'transition-shadow duration-fast',
        'bubble-entering',
        isStreaming ? 'streaming-shimmer' : '',
      ].join(' ')}
      style={{ animationDelay: entranceDelay, borderLeftColor }}
      data-model={getModelDataAttr(message.modelId)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-busy={isStreaming && message.role === 'assistant' ? true : undefined}
    >
      {/* Model name header — assistant messages only */}
      {showHeader && (
        <div
          className="mb-2 text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em]"
        >
          {modelConfig.name}
        </div>
      )}

      {/* Message body
          aria-live="polite": notifies screen readers as streaming content arrives.
          aria-atomic="false": the region updates incrementally — only newly appended
          text is announced, not the full accumulated content on every chunk.
          aria-live is only set during streaming on assistant bubbles; once streaming
          completes the attribute switches to "off" so finalized content is not
          re-announced on subsequent re-renders.
          User messages are never streaming, so they always get aria-live="off". */}
      <div
        className="text-[15px] font-normal leading-[1.6] text-text-primary whitespace-pre-wrap break-words"
        aria-live={isStreaming && message.role === 'assistant' ? 'polite' : 'off'}
        aria-atomic={isStreaming && message.role === 'assistant' ? 'false' : undefined}
      >
        {message.content}
        {isStreaming && !hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>

      {/* Directed-to label — shown on user messages that have a targetModelId.
          Subtle indicator so the thread stays readable after the fact.
          Color is read from targetModelConfig.color — no modelId switch needed. */}
      {targetModelConfig && message.role === 'user' && (
        <div
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium"
          style={{ color: `var(--${targetModelConfig.color ?? 'accent-other'})` }}
          aria-label={`Directed to ${targetModelConfig.name}`}
        >
          <span aria-hidden="true">→</span>
          <span>{targetModelConfig.name}</span>
        </div>
      )}

      {/* Error state — terminal indicator rendered after any partial streamed content. */}
      {hasError && (
        <div className={message.content ? 'mt-3 pt-2 border-t border-border-subtle' : 'mt-1'}>
          <p className="flex items-start gap-1.5 text-[13px] text-error">
            <span aria-hidden="true" className="select-none shrink-0">&#9888;</span>
            <span>{error!.message}</span>
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1.5 text-[12px] text-text-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Bottom row: token count (right) and directed-reply affordance (left).
          Visibility is driven by tokenCountVisibility:
            'always' — row always visible on completed messages
            'active' — reveal on hover (progressive disclosure, default)
            'never'  — token count excluded from DOM; reply button still hover-reveals

          A11y: aria-hidden must NOT be placed on this container. The Reply button
          is interactive and must remain in the accessibility tree at all times so
          keyboard users can reach it. The row becomes visible on hover OR on
          focus-within (WAI-ARIA Authoring Practices: hover-reveal controls must
          also be reachable by keyboard). The token count is non-interactive and
          carries aria-hidden when the row is not visible — it is only supplementary
          information already conveyed through other means (title tooltip). */}
      {showBottomRow && (
        <div
          className={[
            'mt-2 flex items-center justify-between',
            'transition-opacity duration-fast',
            rowVisible ? 'opacity-100' : 'opacity-0 focus-within:opacity-100',
          ].join(' ')}
        >
          {/* "Reply to [Model]" — left side, only for assistant bubbles.
              Color is read from modelConfig.color — no modelId switch needed.
              The button is always in the accessibility tree (no aria-hidden); it
              is opacity-0 at rest but becomes visible on hover OR keyboard focus
              via focus-within on the parent container. */}
          {canDirectReply ? (
            <button
              type="button"
              onClick={() => onDirectedReply!(message.modelId as ModelId)}
              className={[
                'text-[11px] font-medium',
                'hover:underline underline-offset-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                'rounded-sm',
              ].join(' ')}
              style={{ color: `var(--${accentColor})` }}
              aria-label={`Reply to ${modelConfig?.name ?? message.modelId}`}
            >
              Reply to {modelConfig?.name ?? message.modelId}
            </button>
          ) : (
            // spacer so token count stays right-aligned even when no reply button
            <span />
          )}

          {/* Token count — right side.
              'never': excluded from DOM entirely (not here due to showTokenCount guard).
              'always'/'active': rendered; aria-hidden when row is not visible since
              this element is non-interactive (keyboard users cannot act on it) and
              the data is supplementary — already conveyed via the title tooltip. */}
          {showTokenCount && (
            <div
              className="text-[11px] text-text-muted text-right"
              title={`Input: ${message.tokenUsage!.inputTokens.toLocaleString()} · Output: ${message.tokenUsage!.outputTokens.toLocaleString()}`}
              aria-hidden={!rowVisible}
            >
              {message.tokenUsage!.totalTokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      )}
    </div>
  );
}
