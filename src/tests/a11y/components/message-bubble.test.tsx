/**
 * MessageBubble — Axe-core Accessibility Tests
 *
 * Covers two Aria fixes:
 *
 * Fix 1 — issue #46 (Reply button keyboard accessibility)
 *   WCAG 2.1 — 4.1.2 Name, Role, Value
 *   The bottom-row container previously had aria-hidden on it, which removed
 *   the Reply button from the accessibility tree entirely. The fix removed that
 *   aria-hidden. These tests verify:
 *     (a) no axe violations in the hover-reveal state (Reply button present)
 *     (b) the Reply button has an accessible name
 *     (c) neither the button nor its container carry aria-hidden="true"
 *
 * Fix 2 — issue #48 (Streaming live region announcement)
 *   WCAG 2.1 — 1.3.1 Info and Relationships
 *   WCAG 2.1 — 4.1.3 Status Messages
 *   During streaming on assistant messages, the message body must have
 *   aria-live="polite" so screen readers announce incoming content. The fix
 *   added aria-live="polite" and aria-atomic="false" to the content div, and
 *   aria-busy="true" to the outer bubble container. These tests verify:
 *     (a) no axe violations in the streaming state
 *     (b) the live region is present with the correct role/property values
 *     (c) aria-busy is set on the container during streaming
 *     (d) aria-live reverts to "off" (non-live) on completed messages
 *
 * axe-core assertion pattern:
 *   vitest-axe@0.1.0 exports `toHaveNoViolations` under `export type *` in its
 *   .d.ts, which prevents safe use via expect.extend() under strict tsc. We
 *   instead assert directly on `results.violations` — equivalent coverage, zero
 *   type workarounds. Violation descriptions are included in the failure message
 *   via the `violationSummary` helper so failures are still actionable.
 */

import { render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect } from 'vitest';
import { MessageBubble } from '@/ui/MessageBubble';
import type { Message, ModelConfig } from '@/types';

// ─── Axe assertion helper ────────────────────────────────────────────────────
// Formats axe violations into a readable string so test failure messages are
// as useful as the `toHaveNoViolations` matcher output.

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n')
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CLAUDE_CONFIG: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

/** A completed assistant message — no streaming, no error. */
const COMPLETED_ASSISTANT_MESSAGE: Message = {
  id: 'msg-1',
  role: 'assistant',
  content: 'This is a completed response from Claude.',
  modelId: 'claude',
  timestamp: 1_700_000_000_000,
  isStreaming: false,
};

/** An in-progress assistant message — streaming active. */
const STREAMING_ASSISTANT_MESSAGE: Message = {
  id: 'msg-2',
  role: 'assistant',
  content: 'This is a partial response still arriving…',
  modelId: 'claude',
  timestamp: 1_700_000_001_000,
  isStreaming: true,
};

/** A user message — never streaming, no model header. */
const USER_MESSAGE: Message = {
  id: 'msg-3',
  role: 'user',
  content: 'Hello, can you help me?',
  timestamp: 1_700_000_002_000,
};

// ─── Fix #46 — Reply button accessible name + not aria-hidden ─────────────────

describe('MessageBubble — Fix #46: Reply button accessibility (WCAG 4.1.2)', () => {
  it('has no axe violations when Reply button is rendered', async () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('Reply button has an accessible name', () => {
    render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    // The button must be in the accessibility tree with an accessible name.
    // It renders as: <button aria-label="Reply to Claude">Reply to Claude</button>
    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    expect(replyButton).toBeTruthy();
  });

  it('Reply button is not aria-hidden', () => {
    render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    const replyButton = screen.getByRole('button', { name: /reply to claude/i });
    // aria-hidden="true" on the button itself or any ancestor would have hidden it
    // from getByRole — the fact that getByRole found it proves it is not aria-hidden.
    expect(replyButton.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('Reply button container does not carry aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    // No element in the rendered output should have aria-hidden="true" on a
    // container that wraps an interactive element. The bottom-row div specifically
    // must not have aria-hidden (that was the pre-#46 bug).
    const hiddenContainers = container.querySelectorAll('[aria-hidden="true"]');
    for (const el of hiddenContainers) {
      // If an aria-hidden element contains a button descendant, that is the
      // original #46 bug — the fix must ensure no such nesting exists.
      expect(el.querySelector('button')).toBeNull();
    }
  });

  it('has no axe violations — user message (no Reply button)', async () => {
    const { container } = render(
      <MessageBubble
        message={USER_MESSAGE}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — completed assistant bubble with token count always-visible', async () => {
    const messageWithTokens: Message = {
      ...COMPLETED_ASSISTANT_MESSAGE,
      tokenUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    };
    const { container } = render(
      <MessageBubble
        message={messageWithTokens}
        modelConfig={CLAUDE_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="always"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Fix #48 — Streaming live region (WCAG 1.3.1, 4.1.3) ─────────────────────

describe('MessageBubble — Fix #48: Streaming live region (WCAG 1.3.1, 4.1.3)', () => {
  it('has no axe violations in the streaming state', async () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('message content div has aria-live="polite" during streaming', () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The content div is the live region — not the outer bubble container.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    // It must contain the streaming content
    expect(liveRegion?.textContent).toContain(STREAMING_ASSISTANT_MESSAGE.content);
  });

  it('aria-atomic is "false" during streaming (incremental announcement)', () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // aria-atomic="false" tells screen readers to announce only the newly added
    // text, not re-read the full accumulated content on every streaming chunk.
    // Without this, long responses would re-announce from the beginning each chunk.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('false');
  });

  it('outer bubble container has aria-busy="true" during streaming', () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // aria-busy="true" on the outer container signals to ATs that the region
    // is not yet fully loaded — they should wait before reading the content.
    const bubble = container.firstElementChild as Element;
    expect(bubble.getAttribute('aria-busy')).toBe('true');
  });

  it('aria-live reverts to "off" on a completed (non-streaming) assistant message', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // Once streaming is done the live region must be silenced.
    // aria-live="off" prevents re-announcement on subsequent re-renders (e.g. when
    // a new message arrives and the component re-renders with updated context).
    const contentDiv = container.querySelector('[aria-live]');
    expect(contentDiv?.getAttribute('aria-live')).toBe('off');
  });

  it('aria-busy is absent on a completed assistant message', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const bubble = container.firstElementChild as Element;
    // aria-busy must be absent (not "false") once streaming completes.
    // The component uses aria-busy={isStreaming ? true : undefined} — undefined
    // means the attribute is not present in the DOM at all.
    expect(bubble.hasAttribute('aria-busy')).toBe(false);
  });

  it('user messages never get aria-live (they do not stream)', () => {
    const { container } = render(
      <MessageBubble
        message={USER_MESSAGE}
        tokenCountVisibility="never"
      />
    );
    // User messages are never streaming — their content div must have aria-live="off".
    const contentDiv = container.querySelector('[aria-live]');
    expect(contentDiv?.getAttribute('aria-live')).toBe('off');
  });

  it('has no axe violations — streaming state with no modelConfig (unknown model)', async () => {
    const streamingUnknown: Message = {
      ...STREAMING_ASSISTANT_MESSAGE,
      modelId: undefined,
    };
    const { container } = render(
      <MessageBubble
        message={streamingUnknown}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});
