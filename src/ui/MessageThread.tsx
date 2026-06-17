import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Ref for the scrollable message list container. */
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // ─── Smart scroll (#161) ───────────────────────────────────────────────────
  // pinnedToBottom: true when the user is at (or near) the bottom of the
  // scroll container. Auto-scroll fires only when pinned. Stored in a ref
  // (not state) so toggling it never triggers a re-render by itself.
  const pinnedToBottom = useRef(true);
  // showScrollButton drives the ↓ FAB that appears when the user scrolls up.
  const [showScrollButton, setShowScrollButton] = useState(false);

  /** Scroll threshold in pixels — within this distance = "at bottom". */
  const SCROLL_THRESHOLD = 100;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    pinnedToBottom.current = true;
    setShowScrollButton(false);
  }, []);

  // Attach scroll listener to the container to track whether user is pinned.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const isNearBottom = distanceFromBottom <= SCROLL_THRESHOLD;
      pinnedToBottom.current = isNearBottom;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // ─── Live region 1: streaming completion (#48) ─────────────────────────────
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

  // ─── Live region 2: non-streaming message arrival (#54) ───────────────────
  // Announces the content of messages that arrive complete (never streamed).
  // Streaming messages are explicitly excluded: when their stream ends, live
  // region 1 fires "[Model] responded" — announcing content here too would be
  // duplicate audio.
  //
  // Trigger: a message ID appears in messages[] that was not present last render
  // AND was never tracked in streamingMessages (i.e., arrived pre-complete).
  //
  // Announcement format: "Author: [first 100 chars of content]"
  // aria-live="polite" yields to in-progress TTS and does not interrupt the user.
  // aria-atomic="false" is intentional — only the updated text node is read, not
  // the full region, since this is a replacement rather than an append.
  const [arrivalAnnouncement, setArrivalAnnouncement] = useState('');
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  // Tracks every message ID that has ever appeared in streamingMessages, so we
  // can exclude those from the arrival announcement (region 1 covers them).
  const everStreamedIdsRef = useRef<Set<string>>(new Set());

  // Keep everStreamedIdsRef current as streaming messages arrive.
  useEffect(() => {
    for (const m of streamingMessages) {
      everStreamedIdsRef.current.add(m.id);
    }
  }, [streamingMessages]);

  useEffect(() => {
    const currentIds = new Set(messages.map((m) => m.id));
    const prevIds = prevMessageIdsRef.current;

    // New IDs: present now but not in the previous render.
    const newIds = [...currentIds].filter((id) => !prevIds.has(id));

    // Always advance the ref.
    prevMessageIdsRef.current = currentIds;

    // Exclude IDs that went through streamingMessages — region 1 handles those.
    const nonStreamedNewIds = newIds.filter((id) => !everStreamedIdsRef.current.has(id));

    if (nonStreamedNewIds.length > 0) {
      const newMessages = messages.filter((m) => nonStreamedNewIds.includes(m.id));

      // When multiple non-streamed messages arrive simultaneously (rare but possible
      // in parallel mode if the provider returns instantly), announce only the last
      // one. The thread is navigable by keyboard; reading every arrival in rapid
      // succession would overwhelm the user.
      const msg = newMessages[newMessages.length - 1];
      const author =
        msg.role === 'user'
          ? 'You'
          : findModelConfig(msg.modelId, models)?.name ?? msg.modelId ?? 'Model';
      const snippet = msg.content.slice(0, 100).trim();
      const ellipsis = msg.content.length > 100 ? '…' : '';
      const announcement = `${author}: ${snippet}${ellipsis}`;

      setArrivalAnnouncement(announcement);
      // Clear after 1.5 s so the region is ready for the next arrival.
      const timer = setTimeout(() => setArrivalAnnouncement(''), 1500);
      return () => clearTimeout(timer);
    }
  }, [messages, models]);

  // Combine persisted messages and in-flight streaming messages for rendering.
  // Streaming messages are always appended after persisted ones so the thread
  // ordering is: all committed messages → all in-flight streaming messages.
  const allMessages = [...messages, ...streamingMessages];

  // ─── Auto-scroll logic (#161) ──────────────────────────────────────────────
  // Track the last user message ID so we can detect when the user sends a new
  // message and force-pin back to bottom regardless of current scroll position.
  const lastUserMessageIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const allMsgs = [...messages, ...streamingMessages];
    // Find the most recent user message.
    const lastUserMsg = [...allMsgs].reverse().find((m) => m.role === 'user');

    if (lastUserMsg && lastUserMsg.id !== lastUserMessageIdRef.current) {
      // The user just sent a new message — always scroll to bottom and re-pin.
      lastUserMessageIdRef.current = lastUserMsg.id;
      scrollToBottom('smooth');
      return;
    }

    // For streaming chunks / assistant messages: only scroll if pinned.
    if (pinnedToBottom.current) {
      scrollToBottom('smooth');
    }
  }, [messages, streamingMessages, scrollToBottom]);

  if (allMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center overflow-y-auto">
        <p className="text-[13px] text-text-muted">Start a conversation</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* Live region 1 — streaming completion (#48).
          Fires "[Model] responded" when a stream transitions from
          streamingMessages to messages. aria-live="assertive" so the
          completion is announced immediately even if TTS is active.
          aria-atomic="true": the full string is read as a unit. */}
      <div
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {completionAnnouncement}
      </div>

      {/* Live region 2 — non-streaming message arrival (#54).
          Fires "Author: [first 100 chars]" when a complete (non-streamed)
          message lands in messages[]. Streaming messages are excluded to
          avoid double-announcing with live region 1 above.
          aria-live="polite" defers to any in-progress TTS.
          aria-atomic="false": only the updated text node is read. */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="sr-only"
      >
        {arrivalAnnouncement}
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
      {/* Scroll container — ref used by the smart-scroll listener (#161) */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-4 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset">
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

        {/* Scroll-to-bottom FAB (#161) — appears when the user scrolls up.
            Sticky at the bottom of the visible scroll viewport, right-aligned.
            Clicking re-pins and scrolls to the latest message. */}
        {showScrollButton && (
          <div className="sticky bottom-4 flex justify-end pr-2 pointer-events-none">
            <button
              type="button"
              aria-label="Scroll to bottom"
              onClick={() => scrollToBottom('smooth')}
              className={[
                'pointer-events-auto',
                'flex items-center justify-center',
                'w-8 h-8',
                'rounded-full',
                'bg-bg-elevated border border-border',
                'text-text-secondary hover:text-text-primary',
                'shadow-md',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              {/* Down-chevron icon */}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 4.5l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
