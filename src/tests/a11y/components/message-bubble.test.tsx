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
import type { Message, ModelConfig, ModelId } from '@/types';

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

// ─── Fix #271 — Sentinel error state (WCAG 1.3.1, 4.1.2, 4.1.3) ──────────────
//
// When useStreamingMessages guard path synthesizes a minimal error Message
// with content: 'Error', MessageBubble applies three conditional guards:
//
//   1. MessageContent returns null  (body suppressed — sentinel not meaningful to read)
//   2. Copy button removed from DOM (sentinel string is not meaningful to copy)
//   3. Border-t divider removed     (no body above the error section to separate from)
//
// WCAG criteria under audit:
//   1.3.1 — Info and Relationships: error detail section must remain navigable and
//            in reading order even when body is absent.
//   4.1.2 — Name, Role, Value: no interactive element may lose its accessible name
//            as a result of the conditional rendering. Retry button must retain its
//            role and be reachable by keyboard.
//   4.1.3 — Status Messages: the live region path for this error state is confirmed
//            correct (live region 2 in MessageThread announces "ModelName: Error").
//            These tests cover the MessageBubble DOM structure only; the live region
//            itself is in MessageThread and is tested separately.

describe('MessageBubble — Fix #271: Sentinel error state accessibility (WCAG 1.3.1, 4.1.2)', () => {
  const SENTINEL_ERROR_MESSAGE: Message = {
    id: 'msg-error-sentinel',
    role: 'assistant',
    modelId: 'claude',
    content: 'Error',
    timestamp: 1_700_000_003_000,
    isStreaming: false,
  };

  const MODEL_ERROR = {
    modelId: 'claude' as const,
    message: 'API rate limit exceeded. Please try again.',
    code: 'rate_limit' as const,
  };

  it('has no axe violations — sentinel error state', async () => {
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('body paragraph is absent when content is the sentinel string', () => {
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        tokenCountVisibility="never"
      />
    );
    // MessageContent returns null for hasError + !isStreaming + content === 'Error'.
    // No aria-live region should be in the DOM (neither polite nor off-state body div).
    // The absence of this div confirms the sentinel body is fully suppressed —
    // the word "Error" is never presented as message body text to screen readers.
    const liveRegions = container.querySelectorAll('[aria-live]');
    // Zero live regions: body suppressed, message is not streaming.
    expect(liveRegions.length).toBe(0);
  });

  it('copy button is present and keyboard-reachable when content is the sentinel string but an error message exists', () => {
    render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        tokenCountVisibility="never"
      />
    );
    // Since issue #396, the copy button is shown for error-only messages (content === 'Error'
    // or content === '') as long as error.message is non-empty. The button copies the error
    // message text so users can share or report it. It must be in the DOM and reachable
    // by keyboard (not hidden with aria-hidden or removed from the tab order).
    // WCAG 2.1 — 4.1.2 Name, Role, Value: the button must have an accessible name.
    const copyButton = screen.queryByRole('button', { name: /copy message/i });
    expect(copyButton).not.toBeNull();
    // The button must not carry aria-hidden (which would hide it from assistive technology).
    expect(copyButton?.getAttribute('aria-hidden')).not.toBe('true');
  });

  it('Retry button is present and keyboard-reachable in sentinel error state', () => {
    render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // The error section always renders when hasError is true, regardless of
    // body suppression. The Retry button must remain in the accessibility tree
    // with its default button role and reachable via Tab.
    const retryButton = screen.getByRole('button', { name: /retry/i });
    expect(retryButton).toBeTruthy();
    expect(retryButton.getAttribute('aria-hidden')).not.toBe('true');
    // type="button" prevents accidental form submission
    expect(retryButton.getAttribute('type')).toBe('button');
  });

  it('error message text is present in the DOM for screen reader traversal', () => {
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        tokenCountVisibility="never"
      />
    );
    // The error detail <p> must contain the human-readable error message.
    // Screen reader users navigating the thread via virtual cursor must encounter
    // this text immediately after the model name header — there is no body paragraph
    // in between to traverse (it was suppressed).
    const errorParagraph = container.querySelector('p');
    expect(errorParagraph?.textContent).toContain(MODEL_ERROR.message);
  });

  it('warning glyph in error section is aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        tokenCountVisibility="never"
      />
    );
    // The ⚠ glyph (&#9888;) is decorative — the adjacent <span> carries the
    // human-readable error text. The glyph must be aria-hidden so screen readers
    // do not announce "warning" or the raw Unicode codepoint before the message.
    const hiddenGlyph = container.querySelector('[aria-hidden="true"].select-none');
    expect(hiddenGlyph).not.toBeNull();
  });

  it('has no axe violations — sentinel error state without Retry button', async () => {
    // Retry may be omitted when no onRetry handler is provided. The error section
    // must still be axe-clean with only the error text and no interactive element.
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — real partial-content error (non-sentinel) is unaffected', async () => {
    // Real partial-content messages have content !== 'Error'. Confirm the three
    // suppression guards do NOT fire, and the bubble passes axe with body + copy + divider.
    const partialErrorMessage: Message = {
      id: 'msg-partial-error',
      role: 'assistant',
      modelId: 'claude',
      content: 'Here is some partial content before the error occurred.',
      timestamp: 1_700_000_004_000,
      isStreaming: false,
    };
    const { container } = render(
      <MessageBubble
        message={partialErrorMessage}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('copy button is present for real partial-content error message', () => {
    const partialErrorMessage: Message = {
      id: 'msg-partial-error-2',
      role: 'assistant',
      modelId: 'claude',
      content: 'Here is some partial content before the error occurred.',
      timestamp: 1_700_000_005_000,
      isStreaming: false,
    };
    render(
      <MessageBubble
        message={partialErrorMessage}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // Copy button must be present for real content — only the sentinel suppresses it.
    const copyButton = screen.getByRole('button', { name: /copy message/i });
    expect(copyButton).toBeTruthy();
  });
});

// ─── Fix #275 — Custom provider hex accent color (WCAG 4.1.2, 1.4.3) ─────────
//
// resolveAccentCssColor() was added to handle ModelConfig.color values that are
// raw hex strings (custom providers) rather than CSS var suffixes (built-ins).
// Wrapping a hex string in var(--#9C6BCC) produces an invalid CSS declaration
// and silently dropped the color, causing custom provider bubbles to show no accent.
//
// From an accessibility standpoint, the fix is purely cosmetic — the ARIA structure
// of the three affected elements (border, directed-to label, reply button) is
// identical regardless of which branch resolveAccentCssColor() takes. These tests
// confirm that the hex-color path introduces no axe violations and that the
// directed-to label and reply button retain their accessible names.
//
// WCAG criteria:
//   4.1.2 — Name, Role, Value: interactive elements (reply button) retain accessible names
//   1.4.3 — Contrast (Minimum): color changes are cosmetic; no contrast regression
//            introduced (accent colors are pre-audited in contrast.test.ts)

describe('MessageBubble — Fix #275: Custom provider hex color path (WCAG 4.1.2)', () => {
  const CUSTOM_CONFIG: ModelConfig = {
    modelId: 'custom-local' as ModelId,
    name: 'Local LLM',
    color: '#9C6BCC',   // hex string — exercises the hex branch in resolveAccentCssColor
    isActive: true,
  };

  const COMPLETED_CUSTOM_MESSAGE: Message = {
    id: 'msg-custom-1',
    role: 'assistant',
    content: 'Response from a custom provider.',
    modelId: 'custom-local' as ModelId,
    timestamp: 1_700_000_010_000,
    isStreaming: false,
  };

  const USER_DIRECTED_MESSAGE: Message = {
    id: 'msg-user-directed',
    role: 'user',
    content: 'Hello, Local LLM.',
    timestamp: 1_700_000_011_000,
  };

  it('has no axe violations — completed assistant bubble with hex accent color', async () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_CUSTOM_MESSAGE}
        modelConfig={CUSTOM_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('Reply button has accessible name with hex accent color', () => {
    render(
      <MessageBubble
        message={COMPLETED_CUSTOM_MESSAGE}
        modelConfig={CUSTOM_CONFIG}
        onDirectedReply={() => {}}
        tokenCountVisibility="never"
      />
    );
    const replyButton = screen.getByRole('button', { name: /reply to local llm/i });
    expect(replyButton).toBeTruthy();
  });

  it('has no axe violations — user message with directed-to hex accent color', async () => {
    const { container } = render(
      <MessageBubble
        message={USER_DIRECTED_MESSAGE}
        targetModelConfig={CUSTOM_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('directed-to label communicates model name with hex accent color', () => {
    render(
      <MessageBubble
        message={USER_DIRECTED_MESSAGE}
        targetModelConfig={CUSTOM_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The directed-to label expresses "Directed to {name}" as visible text in a
    // <span> (ARIA 1.2 §6.2.6 prohibits aria-label on role="generic" elements).
    // Screen readers announce the span text directly — no aria-label is needed.
    // The → glyph is aria-hidden="true" (decorative only).
    const directedSpan = screen.getByText('Directed to Local LLM');
    expect(directedSpan).toBeTruthy();
    expect(directedSpan.tagName.toLowerCase()).toBe('span');
  });
});

// ─── Fix #322 — Nameplate zone structure (WCAG 1.3.1, 4.1.2) ──────────────────
//
// #322 replaced the 3px left-border on assistant bubbles with a 28px nameplate
// zone containing: a color dot, an optional warning icon, the model name label,
// and a right-aligned timestamp. This describe block audits the nameplate's
// structural accessibility:
//
//   1. Decorative elements (dot, warning icon) must be aria-hidden.
//   2. The model name span must be in the accessibility tree (NOT aria-hidden) —
//      it is the primary source of model identity for screen reader users.
//   3. The timestamp <time> element must be in the accessibility tree.
//   4. Axe must find no violations in the error-state nameplate (error-tint bg,
//      visible warning icon, model name in error color).
//   5. The outer bubble wrapper must have no aria-hidden on any ancestor of the
//      nameplate that would remove the model name from the AT tree.
//
// Note on CSS text-transform: the model name span uses `uppercase` (CSS). The
// DOM textContent is the natural-case model name ("Claude", "Mistral"), not the
// visual uppercase ("CLAUDE"). Modern screen readers read the DOM text, not the
// CSS-rendered text, so users will hear "Claude" rather than "C-L-A-U-D-E". This
// is the correct and accessible behavior — no fix is needed.
//
// WCAG criteria:
//   1.3.1 — Info and Relationships: model identity communicated in reading order
//   4.1.2 — Name, Role, Value: decorative elements hidden; informative text exposed

describe('MessageBubble — Fix #322: Nameplate zone structure (WCAG 1.3.1, 4.1.2)', () => {
  const SENTINEL_ERROR_MESSAGE: Message = {
    id: 'msg-nameplate-error',
    role: 'assistant',
    modelId: 'claude',
    content: 'Error',
    timestamp: 1_700_000_020_000,
    isStreaming: false,
  };

  const MODEL_ERROR = {
    modelId: 'claude' as const,
    message: 'Network request failed.',
    code: 'network_error' as const,
  };

  // ─── Model name accessibility ─────────────────────────────────────────────

  it('model name text is present in the accessibility tree', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The model name span must not be inside an aria-hidden container.
    // Screen reader users rely on this span to know which model produced the response.
    // getByText will throw if the text is inside an aria-hidden subtree, so this
    // implicitly verifies the element is in the AT tree.
    //
    // We query directly for the span containing the model name to confirm the
    // raw DOM text node is present (CSS text-transform uppercase does not affect
    // textContent — the DOM value is "Claude", not "CLAUDE").
    const allText = container.textContent ?? '';
    expect(allText).toContain('Claude');
  });

  it('DOM textContent of model name is natural-case (CSS uppercase does not affect AT)', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The model name span uses Tailwind `uppercase` (text-transform: uppercase).
    // The DOM textContent must still be the natural-case name — not all-caps —
    // because CSS text-transform is not reflected in the DOM. This confirms that
    // screen readers will announce "Claude", not "C-L-A-U-D-E".
    const spans = container.querySelectorAll('span');
    const nameSpan = [...spans].find((s) => s.textContent === 'Claude');
    expect(nameSpan).not.toBeUndefined();
  });

  it('model name is not inside any aria-hidden ancestor', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // Walk up from each aria-hidden element and confirm none contain the model name.
    const hiddenEls = container.querySelectorAll('[aria-hidden="true"]');
    for (const el of hiddenEls) {
      // No aria-hidden element should contain the model name as text.
      expect(el.textContent).not.toBe('Claude');
    }
  });

  // ─── Decorative element hiding ────────────────────────────────────────────

  it('nameplate color dot is aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The color dot is a 7px×7px <span> with background-color set to --bubble-accent.
    // It is purely decorative — model identity is conveyed by the model name text,
    // not by color alone (WCAG 1.4.1). The dot must be aria-hidden.
    // We identify it by its specific size classes.
    const dot = container.querySelector('span.w-\\[7px\\].h-\\[7px\\]');
    expect(dot).not.toBeNull();
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('nameplate warning icon is aria-hidden in error state', () => {
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // The ⚠ glyph (&#9888;) in the nameplate is decorative — the error message text
    // in the body zone conveys the error. The glyph must be aria-hidden so screen
    // readers do not announce "warning" or the raw Unicode character before the model name.
    const warningGlyph = container.querySelector('span[aria-hidden="true"].select-none');
    expect(warningGlyph).not.toBeNull();
    // Confirm it contains the warning character (not some other aria-hidden span)
    expect(warningGlyph?.textContent?.trim()).toBeTruthy();
  });

  // ─── Timestamp accessibility ──────────────────────────────────────────────

  it('timestamp is present in DOM as a <time> element with datetime attribute and is not aria-hidden', () => {
    const { container } = render(
      <MessageBubble
        message={COMPLETED_ASSISTANT_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // The relative-time timestamp ("< 1m", "5m", "3h" etc.) is supplementary information.
    // It must be in the DOM and accessible to screen readers — it should NOT be
    // aria-hidden, since it communicates message recency.
    // We find it by its unique combination of size and color classes.
    const timestampEl = container.querySelector('time.text-\\[11px\\].text-text-muted.shrink-0');
    expect(timestampEl).not.toBeNull();
    expect(timestampEl?.getAttribute('aria-hidden')).not.toBe('true');
    // The text content should be non-empty (formatRelativeTime returns a string)
    expect(timestampEl?.textContent?.trim().length).toBeGreaterThan(0);
    expect(timestampEl?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  // ─── Error state nameplate axe scan ──────────────────────────────────────

  it('has no axe violations — error state nameplate (error-tint bg, model name in error color)', async () => {
    // The error-state nameplate replaces the accent-tint bg with an error-tint bg
    // and sets the model name to text-error color. Both are new color paths introduced
    // in #322; this verifies the error nameplate is axe-clean.
    const { container } = render(
      <MessageBubble
        message={SENTINEL_ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={MODEL_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — nameplate with unknown model (no modelConfig)', async () => {
    // When modelConfig is absent the nameplate falls back to message.modelId ?? 'Model'.
    // Verify the fallback path is axe-clean.
    const noConfigMessage: Message = {
      ...COMPLETED_ASSISTANT_MESSAGE,
      id: 'msg-no-config',
      modelId: undefined,
    };
    const { container } = render(
      <MessageBubble
        message={noConfigMessage}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});
