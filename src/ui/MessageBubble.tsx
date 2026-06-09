import { useState } from 'react';
import type { Message, ModelConfig, ModelError } from '@/types';

interface MessageBubbleProps {
  message: Message;
  modelConfig?: ModelConfig;
  /** Shown when the model returned an error for this message. */
  error?: ModelError;
  /** Called when the user clicks Retry on an errored bubble. Atlas wires the actual retry. */
  onRetry?: () => void;
  /** Stagger index for bubble entrance animation delay (0-based). */
  entranceIndex?: number;
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

export function MessageBubble({
  message,
  modelConfig,
  error,
  onRetry,
  entranceIndex = 0,
}: MessageBubbleProps) {
  const isStreaming = message.isStreaming ?? false;
  const hasError    = !!error;
  // Token count is hidden by default; revealed on hover (progressive disclosure).
  const [isHovered, setIsHovered] = useState(false);

  // Left border color: error overrides model accent
  const borderClass = hasError
    ? 'border-l-error'
    : getAccentBorderClass(message.modelId);

  // Entrance animation stagger via inline style
  const entranceDelay = `${entranceIndex * 100}ms`;

  // Only assistant messages from a model show the name header
  const showHeader = message.role === 'assistant' && modelConfig;

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

      {/* Token usage — hidden by default, revealed on hover (progressive disclosure).
          Only shown for completed assistant messages that have token data. */}
      {!isStreaming && message.tokenUsage && (
        <div
          className={[
            'mt-2 text-[11px] text-text-muted text-right',
            'transition-opacity duration-fast',
            isHovered ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={!isHovered}
          title={`Input: ${message.tokenUsage.inputTokens.toLocaleString()} · Output: ${message.tokenUsage.outputTokens.toLocaleString()}`}
        >
          {message.tokenUsage.totalTokens.toLocaleString()} tokens
        </div>
      )}
    </div>
  );
}
