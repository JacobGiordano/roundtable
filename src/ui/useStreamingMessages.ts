/**
 * useStreamingMessages — manages in-flight streaming message accumulation.
 *
 * Extracted from App.tsx (#158) to reduce the god-component footprint.
 *
 * Responsibilities:
 *   - Holds the `streamingMessages` state map and the `accumulatorRef` that
 *     lets the chunk callback read without stale closures.
 *   - Exposes `handleChunk`, a stable callback passed to `sendMessage()`.
 *     Callers provide `onMessageComplete` so the hook stays agnostic about
 *     persistence (Vault / ghost-mode) — those concerns stay in App.tsx.
 *   - Derives `activeStreamingMessages` for the current conversation.
 *   - Derives `isStreaming` (any in-flight message for the active conversation).
 *   - Exposes `flushAbortedStreams` so App.tsx can clean up priming-chunk
 *     placeholders on user-initiated stop. (#347)
 *
 * Parameters:
 *   @param activeConversationId  The ID of the conversation currently in view.
 *   @param onMessageComplete     Called when a stream finishes. App.tsx uses
 *                                this to persist the completed message to the
 *                                correct storage backend (LocalStorage or ghost).
 *
 * Returns:
 *   @returns activeStreamingMessages  Messages currently streaming for the
 *                                     active conversation.
 *   @returns isStreaming              True when at least one message is live.
 *   @returns handleChunk             Stable chunk-handler callback — pass
 *                                    directly to `sendMessage()`.
 *   @returns flushAbortedStreams     Removes empty-content accumulator entries
 *                                    for a conversation after user-initiated stop.
 */

import { useState, useRef, useCallback } from 'react';
import type { Message, StreamChunk } from '@/types';

export interface UseStreamingMessagesOptions {
  activeConversationId: string | null;
  /**
   * Called when a stream for a given sending conversation is done.
   * App.tsx is responsible for persisting the message — this hook
   * does not import from @/storage or @/models.
   */
  onMessageComplete: (
    sendingConversationId: string,
    finalMsg: Message,
  ) => void;
}

export interface UseStreamingMessagesResult {
  /** In-flight messages for the currently active conversation. */
  activeStreamingMessages: Message[];
  /** True when at least one model is still streaming for the active conversation. */
  isStreaming: boolean;
  /**
   * Stable chunk callback — pass to sendMessage() as the second argument.
   * Captures `sendingConversationId` via closure at call time so mid-stream
   * conversation switches do not corrupt the wrong thread.
   */
  handleChunk: (sendingConversationId: string) => (chunk: StreamChunk) => void;
  /**
   * Removes all accumulator entries for the given conversation that have empty
   * content (content === ''). Called immediately after stopMessage() to clean up
   * priming-chunk placeholders that won't receive a done chunk when abort fires
   * before the HTTP response begins. (#347)
   *
   * Only removes empty-content entries — partial-content streams (where some
   * real content already arrived) are left alone; they will complete normally
   * via their own done chunk even after abort.
   */
  flushAbortedStreams: (conversationId: string) => void;
}

export function useStreamingMessages({
  activeConversationId,
  onMessageComplete,
}: UseStreamingMessagesOptions): UseStreamingMessagesResult {
  // streamingMessages holds in-flight assistant responses keyed by
  // `${conversationId}:${modelId}`. Pure React state — never written to
  // localStorage until isDone. Multiple concurrent models are safe because
  // each key is unique per model per conversation.
  const [streamingMessages, setStreamingMessages] = useState<
    Record<string, Message>
  >({});

  // accumulatorRef mirrors streamingMessages but is readable inside the chunk
  // callback closure without stale-closure issues. Updated synchronously on
  // every chunk alongside the React state update.
  const accumulatorRef = useRef<Record<string, Message>>({});

  // handleChunk is a factory: called once per send with the sending conversation
  // ID, it returns the actual per-chunk callback passed to sendMessage().
  // useCallback on the factory ensures a stable reference across re-renders;
  // the inner function captures sendingConversationId by value at call time.
  const handleChunk = useCallback(
    (sendingConversationId: string) =>
      (chunk: StreamChunk) => {
        const key = `${sendingConversationId}:${chunk.modelId}`;

        if (chunk.isDone) {
          // Finalize: flip isStreaming off, attach usage / error metadata.
          const existing = accumulatorRef.current[key];

          if (!existing) {
            // #266/#267 — belt-and-suspenders guard: no prior non-done chunk
            // created an accumulator entry. This normally shouldn't happen because
            // Atlas providers emit a priming `{ isDone: false, content: '' }` chunk
            // before every error chunk (the priming pattern remains in place).
            // When the done chunk carries an error, synthesize a minimal Message so
            // the error is surfaced rather than silently discarded. When there is no
            // error and no prior content (e.g. a bare `{ isDone: true }` with no
            // error), we treat it as a no-op — nothing meaningful to show the user.
            if (chunk.error) {
              const errorMsg: Message = {
                id: `stream-${sendingConversationId}-${chunk.modelId}-${Date.now()}`,
                role: 'assistant',
                modelId: chunk.modelId,
                content: 'Error',
                timestamp: Date.now(),
                isStreaming: false,
                error: chunk.error,
              };
              onMessageComplete(sendingConversationId, errorMsg);
            }
            // No error and no prior content — genuine no-op; nothing to finalize.
            return;
          }

          const finalMsg: Message = {
            ...existing,
            isStreaming: false,
            tokenUsage: chunk.tokenUsage,
            ...(chunk.error ? { error: chunk.error } : {}),
          };
          // Remove from accumulator so it no longer appears as streaming.
          const next = { ...accumulatorRef.current };
          delete next[key];
          accumulatorRef.current = next;
          setStreamingMessages(next);

          // Delegate persistence to the caller — this hook does not import
          // from @/storage or touch ghost-mode logic directly.
          onMessageComplete(sendingConversationId, finalMsg);
        } else {
          // Non-done chunk: accumulate content onto the in-progress message.
          const existing = accumulatorRef.current[key];
          const streamMsg: Message = existing
            ? { ...existing, content: existing.content + chunk.content }
            : {
                id: `stream-${sendingConversationId}-${chunk.modelId}-${Date.now()}`,
                role: 'assistant',
                modelId: chunk.modelId,
                content: chunk.content,
                timestamp: Date.now(),
                isStreaming: true,
              };

          const next = { ...accumulatorRef.current, [key]: streamMsg };
          accumulatorRef.current = next;
          setStreamingMessages(next);
        }
      },
    [onMessageComplete],
  );

  // Derive streaming messages for the active conversation only.
  const activeStreamingMessages = activeConversationId
    ? Object.entries(streamingMessages)
        .filter(([key]) => key.startsWith(`${activeConversationId}:`))
        .map(([, msg]) => msg)
    : [];

  const isStreaming = activeStreamingMessages.length > 0;

  // #347: Clean up priming-chunk placeholders that never received real content.
  // When abort fires before the HTTP response starts, providers swallow the
  // AbortError and emit no done chunk — empty accumulator entries hang forever.
  // This function removes only entries where content === '' so partial-content
  // streams (which will still emit their own done chunk) are left untouched.
  const flushAbortedStreams = useCallback((conversationId: string) => {
    const prefix = `${conversationId}:`;
    const hasEmpty = Object.entries(accumulatorRef.current).some(
      ([key, msg]) => key.startsWith(prefix) && msg.content === '',
    );
    if (!hasEmpty) return;

    const next: Record<string, Message> = {};
    for (const [key, msg] of Object.entries(accumulatorRef.current)) {
      // Keep entries from other conversations OR entries that have real content.
      if (!key.startsWith(prefix) || msg.content !== '') {
        next[key] = msg;
      }
    }
    accumulatorRef.current = next;
    setStreamingMessages(next);
  }, []);

  return { activeStreamingMessages, isStreaming, handleChunk, flushAbortedStreams };
}
