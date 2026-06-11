import { useEffect, useRef, useState } from 'react';
import type { ExportFormat, Message, ModelConfig, ModelId, TokenCountVisibility } from '@/types';
import { MessageBubble } from './MessageBubble';
import { ExportButton } from './ExportButton';

interface MessageThreadProps {
  messages: Message[];
  /**
   * In-flight streaming messages for models that are still receiving chunks.
   * These are rendered after persisted messages. When a stream completes
   * (isDone), App removes the message from this array and adds it to `messages`.
   * App ensures no message appears in both arrays simultaneously.
   */
  streamingMessages?: Message[];
  models: ModelConfig[];
  onRetry?: (messageId: string) => void;
  /**
   * Called when the user clicks "Reply to [Model]" on an assistant bubble.
   * Sets a pending directed-reply target in App state; InputBar shows the pill.
   */
  onDirectedReply?: (modelId: ModelId) => void;
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility.
   * Threaded from App → AppLayout → MessageThread → MessageBubble.
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
  /**
   * Called when the user selects an export format from the ExportButton popover.
   * Parent (App via AppLayout) handles the async exportConversation call and
   * triggers downloadExportedConversation. Omit to hide the export button.
   */
  onExport?: (format: ExportFormat) => void;
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

export function MessageThread({
  messages,
  streamingMessages = [],
  models,
  onRetry,
  onDirectedReply,
  tokenCountVisibility,
  onExport,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Visually hidden live region for streaming completion announcements.
  // When a model finishes streaming (its message leaves streamingMessages),
  // we announce "[Model name] responded" once via aria-live="assertive".
  // The message is cleared after a brief delay so the region is ready
  // for the next announcement.
  const [completionAnnouncement, setCompletionAnnouncement] = useState('');
  const prevStreamingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(streamingMessages.map((m) => m.id));
    const prevIds = prevStreamingIdsRef.current;

    // Find IDs that were streaming last render but are no longer — these finished.
    const completedIds = [...prevIds].filter((id) => !currentIds.has(id));

    // Always advance the ref so the next run diffs from the current state.
    prevStreamingIdsRef.current = currentIds;

    if (completedIds.length > 0) {
      // Build announcement from recently-committed messages that match.
      // messages[] is the committed list, so completed streams are there now.
      const completedMessages = messages.filter((m) => completedIds.includes(m.id));
      const names = completedMessages
        .map((m) => findModelConfig(m.modelId, models)?.name ?? m.modelId ?? 'Model')
        .filter((name, i, arr) => arr.indexOf(name) === i); // deduplicate

      if (names.length > 0) {
        const announcement = names.length === 1
          ? `${names[0]} responded`
          : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} responded`;
        setCompletionAnnouncement(announcement);
        // Clear after 1 s so the region is ready for the next completion event.
        const timer = setTimeout(() => setCompletionAnnouncement(''), 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [streamingMessages, messages, models]);

  // Combine persisted messages and in-flight streaming messages for rendering.
  // Streaming messages are always appended after persisted ones so the thread
  // ordering is: all committed messages → all in-flight streaming messages.
  const allMessages = [...messages, ...streamingMessages];

  // Auto-scroll to bottom when either list changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessages]);

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <p className="text-[13px] text-text-muted">Start a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Visually hidden live region — announces streaming completion to screen readers.
          aria-live="assertive" is intentional: completion is a discrete event (not
          continuous updates) and "polite" risks being deferred indefinitely when the
          user is still reading streamed text from the message body live region above.
          aria-atomic="true": the full announcement string is read as a unit. */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {completionAnnouncement}
      </div>

      {/* Thread header — only shown when there are messages */}
      {onExport && (
        <div className="flex-shrink-0 flex items-center justify-end px-4 pt-3 pb-0">
          <ExportButton
            onExport={onExport}
            disabled={messages.length === 0}
          />
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto w-full max-w-[720px] flex flex-col gap-2">
          {allMessages.map((message, index) => {
            const modelConfig = findModelConfig(message.modelId, models);
            // Resolve the ModelConfig for the message's targetModelId (if any).
            // Used to render the "→ [Model]" directed-to label on user messages.
            const targetModelConfig = findModelConfig(message.targetModelId, models);
            const entranceIndex = getEntranceIndex(allMessages, index);

            // Gap between bubbles: spec says 8px same-model, 16px different model.
            // We implement this via margin-top on each bubble.
            const prevMessage = index > 0 ? allMessages[index - 1] : null;
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
                  targetModelConfig={targetModelConfig}
                  error={message.error}
                  onRetry={onRetry ? () => onRetry(message.id) : undefined}
                  onDirectedReply={onDirectedReply}
                  entranceIndex={entranceIndex}
                  tokenCountVisibility={tokenCountVisibility}
                />
              </div>
            );
          })}
          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
