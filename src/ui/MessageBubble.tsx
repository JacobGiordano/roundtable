import { useState } from 'react';
import type { Message, ModelConfig, ModelError, ModelId } from '@/types';

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

      {/* Error state */}
      {hasError && (
        <div className="mt-2">
          <p className="text-[13px] italic text-error">
            Error: {error.message}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-[12px] text-text-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {/* Bottom row: token count (right) and directed-reply affordance (left).
          Both are hidden by default, revealed on hover (progressive disclosure).
          Row is only rendered when at least one of the two is applicable. */}
      {(!isStreaming && (message.tokenUsage || canDirectReply)) && (
        <div
          className={[
            'mt-2 flex items-center justify-between',
            'transition-opacity duration-fast',
            isHovered ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={!isHovered}
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

          {/* Token count — right side */}
          {message.tokenUsage && (
            <div
              className="text-[11px] text-text-muted text-right"
              title={`Input: ${message.tokenUsage.inputTokens.toLocaleString()} · Output: ${message.tokenUsage.outputTokens.toLocaleString()}`}
            >
              {message.tokenUsage.totalTokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      )}
    </div>
  );
}
