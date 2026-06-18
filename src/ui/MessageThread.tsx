import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// ─── ModelVisibilityBar (#165) ─────────────────────────────────────────────────

/**
 * Renders a row of per-model visibility toggle buttons.
 * Only shown when there are 2+ active models (single-model sessions have nothing to hide).
 *
 * Accessibility:
 * - Each button is an aria-pressed toggle (true = visible, false = hidden).
 * - The "at least one must remain visible" guard disables the toggle when only
 *   one model is currently visible — the disabled state is announced via aria-disabled.
 * - The entire bar is wrapped in a <section> with an accessible label so screen
 *   readers can navigate to it.
 */
interface ModelVisibilityBarProps {
  models: ModelConfig[];
  hiddenModelIds: Set<ModelId>;
  onToggleVisibility: (modelId: ModelId) => void;
}

function ModelVisibilityBar({ models, hiddenModelIds, onToggleVisibility }: ModelVisibilityBarProps) {
  // Only render when there are 2+ models — no point hiding if only one.
  if (models.length < 2) return null;

  const visibleCount = models.length - hiddenModelIds.size;

  return (
    <div
      className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-border"
      role="group"
      aria-label="Model visibility"
    >
      <span className="text-[11px] text-text-muted font-medium mr-1 flex-shrink-0">Show:</span>
      {models.map((model) => {
        const isVisible = !hiddenModelIds.has(model.modelId);
        // Disable the toggle when this is the last visible model (guard against hiding all).
        const isLastVisible = isVisible && visibleCount === 1;

        return (
          <button
            key={model.modelId}
            type="button"
            aria-pressed={isVisible}
            aria-label={`${isVisible ? 'Hide' : 'Show'} ${model.name}`}
            aria-disabled={isLastVisible ? true : undefined}
            onClick={() => { if (!isLastVisible) onToggleVisibility(model.modelId); }}
            className={[
              'flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium',
              'border transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              isVisible
                ? 'bg-hover border-border text-text-primary'
                : 'border-transparent text-text-muted hover:text-text-secondary hover:bg-hover/40',
              isLastVisible
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer',
            ].join(' ')}
          >
            {/* Colored dot matching model accent */}
            <span
              className="w-[6px] h-[6px] rounded-full flex-shrink-0"
              style={{ backgroundColor: `var(--${model.color ?? 'accent-other'})` }}
              aria-hidden="true"
            />
            {model.name}
            {/* Eye icon: open when visible, crossed when hidden */}
            <span aria-hidden="true" className="flex-shrink-0 opacity-60">
              {isVisible ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <ellipse cx="6" cy="6" rx="5" ry="3.5" stroke="currentColor" strokeWidth="1.1" />
                  <circle cx="6" cy="6" r="1.5" fill="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1.5 1.5l9 9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M3 4.5C2.1 5.1 1.5 5.6 1 6c1 1.7 2.8 3.5 5 3.5.8 0 1.5-.2 2.2-.6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  <path d="M9.5 7.8C10.5 6.9 11 6.3 11 6c-1-1.7-2.8-3.5-5-3.5-.7 0-1.4.2-2 .5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
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

  // ─── Per-model visibility (#165) ───────────────────────────────────────────
  // Ephemeral per-session state: which model IDs are currently hidden.
  // Hidden models still receive messages — only their display is suppressed.
  // Reset when the models prop changes (e.g. conversation switch) so hidden
  // state from one conversation does not carry over to the next.
  const [hiddenModelIds, setHiddenModelIds] = useState<Set<ModelId>>(new Set());

  // Reset hidden state whenever the set of active model IDs changes.
  // We key on the sorted join of model IDs — if models are added/removed or the
  // conversation switches, we clear hidden state to avoid stale suppressions.
  const modelIdsKey = useMemo(
    () => models.map((m) => m.modelId).sort().join(','),
    [models],
  );
  const prevModelIdsKeyRef = useRef(modelIdsKey);
  if (prevModelIdsKeyRef.current !== modelIdsKey) {
    prevModelIdsKeyRef.current = modelIdsKey;
    // Reset hidden set synchronously during render (same as derived state pattern).
    // This avoids a double-render from useEffect and prevents a flash of incorrectly
    // hidden messages when switching conversations.
    setHiddenModelIds(new Set());
  }

  const handleToggleVisibility = useCallback((modelId: ModelId) => {
    setHiddenModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        // Guard: never hide if it would leave zero visible models.
        // (Button is also disabled at the UI level, but defence-in-depth.)
        const visibleCount = models.length - prev.size;
        if (visibleCount <= 1) return prev;
        next.add(modelId);
      }
      return next;
    });
  }, [models.length]);

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
  // Filter: hide messages from models the user has toggled off (#165).
  // User messages are always shown regardless of visibility state.
  const allMessages = [...messages, ...streamingMessages].filter(
    (m) => m.role === 'user' || !m.modelId || !hiddenModelIds.has(m.modelId),
  );

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

      {/* Model visibility bar (#165) — only shown when 2+ models are active.
          Lets users hide individual model responses without stopping message delivery.
          Hidden models still receive and process messages; their output is simply not
          rendered until the user toggles them back on. */}
      <ModelVisibilityBar
        models={models}
        hiddenModelIds={hiddenModelIds}
        onToggleVisibility={handleToggleVisibility}
      />

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
