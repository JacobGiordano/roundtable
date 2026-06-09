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

/** Maps a ModelId to the CSS custom-property-backed Tailwind border class. */
function getAccentBorderClass(modelId: string | undefined): string {
  switch (modelId) {
    case 'claude':  return 'border-l-accent-claude';
    case 'gpt-5.5': return 'border-l-accent-gpt';
    default:        return 'border-l-accent-other';
  }
}

/** Maps a ModelId to the data-model attribute value for streaming shimmer CSS targeting. */
function getModelDataAttr(modelId: string | undefined): string {
  switch (modelId) {
    case 'claude':  return 'claude';
    case 'gpt-5.5': return 'gpt';
    default:        return 'other';
  }
}

/** Maps a ModelId to the Tailwind text color class for the directed-reply pill. */
function getAccentTextClass(modelId: string | undefined): string {
  switch (modelId) {
    case 'claude':  return 'text-accent-claude';
    case 'gpt-5.5': return 'text-accent-gpt';
    default:        return 'text-accent-other';
  }
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

  // Left border color: error overrides model accent
  const borderClass = hasError
    ? 'border-l-error'
    : getAccentBorderClass(message.modelId);

  // Entrance animation stagger via inline style
  const entranceDelay = `${entranceIndex * 100}ms`;

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
        borderClass,
        'px-4 py-3',
        'transition-shadow duration-fast',
        'bubble-entering',
        isStreaming ? 'streaming-shimmer' : '',
      ].join(' ')}
      style={{ animationDelay: entranceDelay }}
      data-model={getModelDataAttr(message.modelId)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Model name header — assistant messages only */}
      {showHeader && (
        <div
          className="mb-2 text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em]"
        >
          {modelConfig.name}
        </div>
      )}

      {/* Message body */}
      <div className="text-[15px] font-normal leading-[1.6] text-text-primary whitespace-pre-wrap break-words">
        {message.content}
        {isStreaming && !hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>

      {/* Directed-to label — shown on user messages that have a targetModelId.
          Subtle indicator so the thread stays readable after the fact. */}
      {targetModelConfig && message.role === 'user' && (
        <div
          className={[
            'mt-1.5 flex items-center gap-1',
            'text-[11px] font-medium',
            getAccentTextClass(targetModelConfig.modelId),
          ].join(' ')}
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
            'never'  — token count excluded from DOM; reply button still hover-reveals */}
      {showBottomRow && (
        <div
          className={[
            'mt-2 flex items-center justify-between',
            'transition-opacity duration-fast',
            rowVisible ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={!rowVisible}
        >
          {/* "Reply to [Model]" — left side, only for assistant bubbles */}
          {canDirectReply ? (
            <button
              type="button"
              onClick={() => onDirectedReply!(message.modelId as ModelId)}
              className={[
                'text-[11px] font-medium',
                getAccentTextClass(message.modelId),
                'hover:underline underline-offset-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                'rounded-sm',
              ].join(' ')}
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
              'always'/'active': rendered; visibility controlled by rowVisible above. */}
          {showTokenCount && (
            <div
              className="text-[11px] text-text-muted text-right"
              title={`Input: ${message.tokenUsage!.inputTokens.toLocaleString()} · Output: ${message.tokenUsage!.outputTokens.toLocaleString()}`}
            >
              {message.tokenUsage!.totalTokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      )}
    </div>
  );
}
