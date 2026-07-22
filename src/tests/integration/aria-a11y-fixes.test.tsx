/**
 * Integration: Aria a11y fixes — #46 (Reply button accessibility) and
 * #48 (streaming completion announcement)
 *
 * These tests guard regressions for two specific a11y fixes merged into main.
 * They exercise the UI components directly using @testing-library/react and jsdom.
 *
 * What is tested from the outside (behavior, not implementation):
 *   #46 — a keyboard user can reach the Reply button because it is never
 *          hidden from the accessibility tree via aria-hidden.
 *   #48 — a screen reader user hears "[Model] responded" when streaming
 *          completes, because the sr-only assertive live region receives the
 *          correct text after the streaming→committed transition.
 *
 * Cross-agent contracts exercised:
 *   MessageBubble (Aria) — aria-hidden placement on bottom row container
 *   MessageThread (Aria) — prevStreamingIdsRef diff logic, sr-only live region
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MessageBubble } from '@/ui/MessageBubble';
import { MessageThread } from '@/ui/MessageThread';
import type { Message, ModelConfig } from '@/types/index';
import { resetIdSeq, makeAssistantMessage, CLAUDE_MODEL, GPT_MODEL } from '../fixtures/conversations';

// ─── Setup ────────────────────────────────────────────────────────────────────

// jsdom does not implement scrollIntoView. MessageThread calls
// bottomRef.current?.scrollIntoView(...) in a useEffect. Without this stub,
// every MessageThread render throws "scrollIntoView is not a function" in the
// test environment. We stub it at the Element prototype level so all DOM nodes
// in the test environment silently accept the call — no scrolling happens in
// jsdom anyway.
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  resetIdSeq();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Walk up the DOM from a given element and return the first ancestor
 * (or the element itself) that has aria-hidden="true", or null if none.
 *
 * This is the authoritative check for whether an element is hidden from
 * the accessibility tree via aria-hidden inheritance. An element is
 * effectively aria-hidden if any ancestor carries aria-hidden="true".
 */
function findAriaHiddenAncestor(element: Element): Element | null {
  let node: Element | null = element;
  while (node) {
    if (node.getAttribute('aria-hidden') === 'true') {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

// ─── Fix #46: Reply button not aria-hidden ────────────────────────────────────

describe('MessageBubble — Reply button accessibility (#46)', () => {
  const modelConfig: ModelConfig = CLAUDE_MODEL;

  function makeCompletedAssistantMessage(): Message {
    return {
      ...makeAssistantMessage('Hello from Claude', 'claude'),
      isStreaming: false,
    };
  }

  it('renders the Reply button in the accessibility tree when the bubble is not hovered', () => {
    const message = makeCompletedAssistantMessage();
    render(
      <MessageBubble
        message={message}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
      />
    );

    // The button should be queryable by role — if it were aria-hidden it would
    // not appear in the accessible tree and getByRole would throw.
    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    expect(replyButton).toBeTruthy();
  });

  it('the Reply button has no aria-hidden ancestor', () => {
    const message = makeCompletedAssistantMessage();
    render(
      <MessageBubble
        message={message}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
      />
    );

    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    const hiddenAncestor = findAriaHiddenAncestor(replyButton);

    expect(hiddenAncestor).toBeNull();
  });

  it('the Reply button itself does not carry aria-hidden', () => {
    const message = makeCompletedAssistantMessage();
    render(
      <MessageBubble
        message={message}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
      />
    );

    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    expect(replyButton.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('the token count div — not the Reply button — carries aria-hidden when row is not visible', () => {
    const message: Message = {
      ...makeCompletedAssistantMessage(),
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    };

    render(
      <MessageBubble
        message={message}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
        tokenCountVisibility="active"
      />
    );

    // The Reply button must remain accessible regardless of hover state.
    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    expect(findAriaHiddenAncestor(replyButton)).toBeNull();

    // The token count text is rendered but supplementary — its container should
    // carry aria-hidden since it is non-interactive and the row is not yet hovered.
    // #458: title attribute replaced by sr-only span — find the container div via
    // the sr-only span text and assert aria-hidden on its parentElement.
    const srSpan = screen.getByText(/\(input:.*output:/i);
    const tokenEl = srSpan.parentElement!;
    expect(tokenEl.getAttribute('aria-hidden')).toBe('true');
  });

  it('token count loses aria-hidden when tokenCountVisibility is "always"', () => {
    const message: Message = {
      ...makeCompletedAssistantMessage(),
      tokenUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    };

    render(
      <MessageBubble
        message={message}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
        tokenCountVisibility="always"
      />
    );

    // #458: title attribute replaced by sr-only span — find the container div via
    // the sr-only span text and assert aria-hidden on its parentElement.
    const srSpan = screen.getByText(/\(input:.*output:/i);
    const tokenEl = srSpan.parentElement!;
    // aria-hidden={false} renders as no attribute or attribute value "false"
    expect(tokenEl.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('Reply button is not rendered for streaming messages (canDirectReply guard)', () => {
    const streamingMessage: Message = {
      ...makeCompletedAssistantMessage(),
      isStreaming: true,
    };

    render(
      <MessageBubble
        message={streamingMessage}
        modelConfig={modelConfig}
        onDirectedReply={() => {}}
      />
    );

    // The reply button must not appear while streaming — canDirectReply is false.
    const replyButton = screen.queryByRole('button', { name: /reply to/i });
    expect(replyButton).toBeNull();
  });
});

// ─── Fix #48: Streaming completion announcement ───────────────────────────────

describe('MessageThread — streaming completion announcement (#48)', () => {
  const models: ModelConfig[] = [CLAUDE_MODEL, GPT_MODEL];

  /**
   * Build a streaming assistant message. MessageThread renders this in
   * streamingMessages[]. When streaming completes, the caller moves the
   * message to messages[] and removes it from streamingMessages[].
   */
  function makeStreamingMessage(id: string, modelId: 'claude' | 'gpt-5.5' = 'claude'): Message {
    return {
      id,
      role: 'assistant',
      content: 'Thinking...',
      modelId,
      timestamp: Date.now(),
      isStreaming: true,
    };
  }

  function makeCommittedMessage(id: string, modelId: 'claude' | 'gpt-5.5' = 'claude'): Message {
    return {
      id,
      role: 'assistant',
      content: 'Final response',
      modelId,
      timestamp: Date.now(),
      isStreaming: false,
    };
  }

  it('sr-only live region is present in the DOM and assertive', () => {
    render(
      <MessageThread
        messages={[{ id: 'u1', role: 'user', content: 'Hello', timestamp: Date.now() }]}
        streamingMessages={[]}
        models={models}
      />
    );

    // The region must exist and be assertive so screen readers interrupt
    // the current reading context to announce the completion event.
    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion!.getAttribute('aria-atomic')).toBe('true');
  });

  it('announces "[Model] responded" when a streaming message transitions to committed', async () => {
    const streamingMsg = makeStreamingMessage('stream-1', 'claude');
    const userMsg: Message = { id: 'u1', role: 'user', content: 'Hello', timestamp: Date.now() };

    const { rerender } = render(
      <MessageThread
        messages={[userMsg]}
        streamingMessages={[streamingMsg]}
        models={models}
      />
    );

    // Transition: the streaming message moves to messages[], disappears from streamingMessages[]
    const committedMsg = makeCommittedMessage('stream-1', 'claude');

    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committedMsg]}
          streamingMessages={[]}
          models={models}
        />
      );
    });

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion!.textContent).toBe('Claude responded');
  });

  it('announces both model names when two streams complete simultaneously', async () => {
    const streamingClaude = makeStreamingMessage('stream-claude', 'claude');
    const streamingGpt = makeStreamingMessage('stream-gpt', 'gpt-5.5');
    const userMsg: Message = { id: 'u1', role: 'user', content: 'Hello', timestamp: Date.now() };

    const { rerender } = render(
      <MessageThread
        messages={[userMsg]}
        streamingMessages={[streamingClaude, streamingGpt]}
        models={models}
      />
    );

    const committedClaude = makeCommittedMessage('stream-claude', 'claude');
    const committedGpt = makeCommittedMessage('stream-gpt', 'gpt-5.5');

    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committedClaude, committedGpt]}
          streamingMessages={[]}
          models={models}
        />
      );
    });

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    // Both models completed — announcement includes both names
    expect(liveRegion!.textContent).toMatch(/Claude/);
    expect(liveRegion!.textContent).toMatch(/GPT-5\.5/);
    expect(liveRegion!.textContent).toMatch(/responded/);
  });

  it('does not announce when no stream was in progress before the rerender', async () => {
    const userMsg: Message = { id: 'u1', role: 'user', content: 'Hello', timestamp: Date.now() };
    const committedMsg = makeCommittedMessage('m1', 'claude');

    // Initial render already has a committed message — prevStreamingIdsRef starts empty
    const { rerender } = render(
      <MessageThread
        messages={[userMsg, committedMsg]}
        streamingMessages={[]}
        models={models}
      />
    );

    // Re-render with no change to streamingMessages — no announcement expected
    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committedMsg]}
          streamingMessages={[]}
          models={models}
        />
      );
    });

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion!.textContent).toBe('');
  });

  it('only announces a model once when the same model completes two sequential streams', async () => {
    const userMsg: Message = { id: 'u1', role: 'user', content: 'Hi', timestamp: Date.now() };

    // First stream completes
    const stream1 = makeStreamingMessage('s1', 'claude');
    const { rerender } = render(
      <MessageThread
        messages={[userMsg]}
        streamingMessages={[stream1]}
        models={models}
      />
    );

    const committed1 = makeCommittedMessage('s1', 'claude');
    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committed1]}
          streamingMessages={[]}
          models={models}
        />
      );
    });

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion!.textContent).toBe('Claude responded');

    // Second stream starts and completes
    const stream2 = makeStreamingMessage('s2', 'claude');
    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committed1]}
          streamingMessages={[stream2]}
          models={models}
        />
      );
    });

    const committed2 = makeCommittedMessage('s2', 'claude');
    await act(async () => {
      rerender(
        <MessageThread
          messages={[userMsg, committed1, committed2]}
          streamingMessages={[]}
          models={models}
        />
      );
    });

    // Second completion also announces correctly
    expect(liveRegion!.textContent).toBe('Claude responded');
  });

  it('sr-only class hides the live region visually while keeping it in the a11y tree', () => {
    render(
      <MessageThread
        messages={[{ id: 'u1', role: 'user', content: 'Hello', timestamp: Date.now() }]}
        streamingMessages={[]}
        models={models}
      />
    );

    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeTruthy();
    // The region carries the sr-only Tailwind class — it is off-screen, not display:none
    expect(liveRegion!.classList.contains('sr-only')).toBe(true);
  });
});
