import { useEffect, useRef } from 'react';
import type { Message, ModelConfig } from '@/types';
import { MessageBubble } from './MessageBubble';

interface MessageThreadProps {
  messages: Message[];
  models: ModelConfig[];
  onRetry?: (messageId: string) => void;
}

function findModelConfig(modelId: string | undefined, models: ModelConfig[]): ModelConfig | undefined {
  if (!modelId) return undefined;
  return models.find((m) => m.modelId === modelId);
}

/**
 * Returns the stagger index for bubble entrance animations.
 * Only streaming or newly-arrived assistant messages get a stagger delay.
 * We group consecutive assistant messages that arrived "together" (within
 * the same render batch) by checking if they're at the tail of the list and streaming.
 */
function getEntranceIndex(messages: Message[], index: number): number {
  // Count how many consecutive streaming assistant messages appear at the tail
  const tailStreamingCount = messages
    .slice()
    .reverse()
    .findIndex((m) => !m.isStreaming || m.role !== 'assistant');

  const tailStart = messages.length - (tailStreamingCount === -1 ? messages.length : tailStreamingCount);

  if (index >= tailStart) {
    return index - tailStart;
  }
  return 0;
}

export function MessageThread({ messages, models, onRetry }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <p className="text-[13px] text-text-muted">Start a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto w-full max-w-[720px] flex flex-col gap-2">
        {messages.map((message, index) => {
          const modelConfig = findModelConfig(message.modelId, models);
          const entranceIndex = getEntranceIndex(messages, index);

          // Gap between bubbles: spec says 8px same-model, 16px different model.
          // We implement this via margin-top on each bubble.
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isNewModel =
            prevMessage &&
            prevMessage.role === 'assistant' &&
            message.role === 'assistant' &&
            prevMessage.modelId !== message.modelId;

          return (
            <div
              key={message.id}
              className={isNewModel ? 'mt-2' : ''}
            >
              <MessageBubble
                message={message}
                modelConfig={modelConfig}
                onRetry={onRetry ? () => onRetry(message.id) : undefined}
                entranceIndex={entranceIndex}
              />
            </div>
          );
        })}
        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
