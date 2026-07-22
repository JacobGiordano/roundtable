/**
 * MessageBubble — #463 error tone differentiation
 *
 * Issue #463 introduced three distinct error states in MessageBubble, keyed on
 * ModelError.code. Each tone presents a different icon, summary message, and CTA
 * label so users immediately understand what kind of failure occurred and what
 * action to take.
 *
 * | error.code     | Icon        | Summary text                           | CTA label      |
 * |----------------|-------------|----------------------------------------|----------------|
 * | auth_failure   | KeyIcon     | "Check your API key"                   | "Go to Settings" |
 * | rate_limit     | ClockIcon   | "Rate limited — try again in a moment" | "Retry"        |
 * | network_error  | WifiOffIcon | "Connection issue — Retry when ready"  | "Retry"        |
 * | (unclassified) | ⚠ triangle  | "Error: <raw message>"                 | "Retry"        |
 *
 * For the three known codes, the raw error.message is preserved in a sr-only span
 * so screen reader users still receive the full provider error text even though the
 * visual message is the simplified summary. For unclassified errors the raw message
 * is the summary — no sr-only span is added to avoid repetition.
 *
 * Cross-agent contracts exercised:
 *   MessageBubble (Aria, src/ui/MessageBubble.tsx) — error tone rendering
 *   KeyIcon / ClockIcon / WifiOffIcon (Aria, src/ui/icons/index.tsx) — tone icons
 *   ModelError / ModelErrorCode (Arch, src/types/index.ts) — error shape
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '@/ui/MessageBubble';
import type { Message, ModelConfig, ModelError } from '@/types/index';

// ─── Stub scrollIntoView (not available in jsdom) ─────────────────────────────

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CLAUDE_CONFIG: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

/** Sentinel error message — no visible body content; error section only. */
const ERROR_MESSAGE: Message = {
  id: 'msg-error-1',
  role: 'assistant',
  modelId: 'claude',
  content: 'Error',
  timestamp: 1_700_000_000_000,
  isStreaming: false,
};

function makeError(code: string, message: string): ModelError {
  return {
    modelId: 'claude',
    code: code as ModelError['code'],
    message,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the SVG elements inside the nameplate error icon wrapper.
 * The wrapper is the <span aria-hidden="true" className="text-error shrink-0 flex items-center">
 * immediately after the color dot. We locate it by querying all aria-hidden spans
 * in the nameplate and finding the one that contains an SVG (or the ⚠ span).
 */
function getNameplateIconContainer(container: HTMLElement): Element | null {
  // The nameplate error icon is wrapped in a span with class "text-error shrink-0 flex items-center".
  // Because aria-hidden is set, we cannot use getBy* — query directly.
  return container.querySelector('span.text-error.shrink-0.flex.items-center');
}

// ─── 1. auth_failure tone ─────────────────────────────────────────────────────

describe('MessageBubble error tone — auth_failure (#463)', () => {
  const AUTH_ERROR = makeError('auth_failure', 'Invalid API key provided by the user.');

  it('renders KeyIcon (SVG with key circle at cx=5) in the nameplate for auth_failure', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={AUTH_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const iconWrapper = getNameplateIconContainer(container);
    expect(iconWrapper).not.toBeNull();

    // KeyIcon uses a circle with cx="5" cy="6.5" — the distinguishing shape.
    const svg = iconWrapper!.querySelector('svg');
    expect(svg).not.toBeNull();
    const keyCircle = svg!.querySelector('circle[cx="5"]');
    expect(keyCircle).not.toBeNull();
  });

  it('shows "Check your API key" as the error summary text for auth_failure', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={AUTH_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // The summary renders in the error <p> inside role="alert".
    const alertRegion = screen.getByRole('alert');
    const summaryParagraph = alertRegion.querySelector('p');
    expect(summaryParagraph?.textContent).toContain('Check your API key');
    // Must NOT show the unclassified "Error:" prefix.
    expect(summaryParagraph?.textContent).not.toMatch(/^Error:/);
  });

  it('CTA button label is "Go to Settings" (not "Retry") for auth_failure', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={AUTH_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // "Go to Settings" is the retryLabel for auth_failure.
    const ctaButton = screen.getByRole('button', { name: 'Go to Settings' });
    expect(ctaButton).toBeTruthy();
    // Confirm "Retry" is NOT the label.
    const retryButton = screen.queryByRole('button', { name: 'Retry' });
    expect(retryButton).toBeNull();
  });

  it('raw error.message is preserved in a sr-only span for screen readers (auth_failure)', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={AUTH_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // The sr-only span preserves the technical provider error text.
    // It must be in the DOM (for screen readers) but visually hidden.
    const rawMessageSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === AUTH_ERROR.message);
    expect(rawMessageSpan).not.toBeUndefined();
    // The sr-only class hides the element visually.
    expect(rawMessageSpan?.className).toContain('sr-only');
  });
});

// ─── 2. rate_limit tone ───────────────────────────────────────────────────────

describe('MessageBubble error tone — rate_limit (#463)', () => {
  const RATE_ERROR = makeError('rate_limit', 'Too many requests — 429 from provider.');

  it('renders ClockIcon (SVG with clock circle at cx=7 cy=7) for rate_limit', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={RATE_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const iconWrapper = getNameplateIconContainer(container);
    expect(iconWrapper).not.toBeNull();

    const svg = iconWrapper!.querySelector('svg');
    expect(svg).not.toBeNull();
    // ClockIcon uses a circle with cx="7" cy="7" r="5.5" — the clock face.
    const clockCircle = svg!.querySelector('circle[cx="7"][cy="7"]');
    expect(clockCircle).not.toBeNull();
  });

  it('shows "Rate limited — try again in a moment" summary text for rate_limit', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={RATE_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const alertRegion = screen.getByRole('alert');
    const summaryParagraph = alertRegion.querySelector('p');
    expect(summaryParagraph?.textContent).toContain('Rate limited — try again in a moment');
    expect(summaryParagraph?.textContent).not.toMatch(/^Error:/);
  });

  it('CTA button label is "Retry" for rate_limit', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={RATE_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeTruthy();
    // "Go to Settings" must not appear for rate_limit.
    const goToSettings = screen.queryByRole('button', { name: 'Go to Settings' });
    expect(goToSettings).toBeNull();
  });

  it('raw error.message is preserved in a sr-only span for screen readers (rate_limit)', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={RATE_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const rawMessageSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === RATE_ERROR.message);
    expect(rawMessageSpan).not.toBeUndefined();
    expect(rawMessageSpan?.className).toContain('sr-only');
  });
});

// ─── 3. network_error tone ────────────────────────────────────────────────────

describe('MessageBubble error tone — network_error (#463)', () => {
  const NET_ERROR = makeError('network_error', 'Failed to fetch: network timeout.');

  it('renders WifiOffIcon (SVG with diagonal slash path M1.5 1.5l11 11) for network_error', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={NET_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const iconWrapper = getNameplateIconContainer(container);
    expect(iconWrapper).not.toBeNull();

    const svg = iconWrapper!.querySelector('svg');
    expect(svg).not.toBeNull();
    // WifiOffIcon has a diagonal slash: d="M1.5 1.5l11 11"
    const slashPath = [...svg!.querySelectorAll('path')]
      .find((p) => p.getAttribute('d')?.includes('M1.5 1.5l11 11'));
    expect(slashPath).not.toBeUndefined();
  });

  it('shows "Connection issue — Retry when ready" summary text for network_error', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={NET_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const alertRegion = screen.getByRole('alert');
    const summaryParagraph = alertRegion.querySelector('p');
    expect(summaryParagraph?.textContent).toContain('Connection issue — Retry when ready');
    expect(summaryParagraph?.textContent).not.toMatch(/^Error:/);
  });

  it('CTA button label is "Retry" for network_error', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={NET_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeTruthy();
    const goToSettings = screen.queryByRole('button', { name: 'Go to Settings' });
    expect(goToSettings).toBeNull();
  });

  it('raw error.message is preserved in a sr-only span for screen readers (network_error)', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={NET_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const rawMessageSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === NET_ERROR.message);
    expect(rawMessageSpan).not.toBeUndefined();
    expect(rawMessageSpan?.className).toContain('sr-only');
  });
});

// ─── 4. Unclassified / fallback error tone ────────────────────────────────────

describe('MessageBubble error tone — unclassified / fallback (#463)', () => {
  const UNKNOWN_ERROR = makeError('context_length_exceeded', 'Input tokens exceeded context window.');

  it('renders ⚠ triangle glyph (not a known icon) for unclassified error code', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={UNKNOWN_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const iconWrapper = getNameplateIconContainer(container);
    expect(iconWrapper).not.toBeNull();

    // The fallback path renders a <span> with the ⚠ glyph (U+26A0, &#9888;).
    const warningGlyph = iconWrapper!.querySelector('span.select-none');
    expect(warningGlyph).not.toBeNull();

    // No SVG — the fallback is a text glyph, not one of the three icon SVGs.
    const svg = iconWrapper!.querySelector('svg');
    expect(svg).toBeNull();
  });

  it('falls back to "Error: <raw message>" summary for unclassified error codes', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={UNKNOWN_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const alertRegion = screen.getByRole('alert');
    const summaryParagraph = alertRegion.querySelector('p');
    // The fallback is `Error: ${error.message}` — raw message shown directly.
    expect(summaryParagraph?.textContent).toContain(`Error: ${UNKNOWN_ERROR.message}`);
  });

  it('CTA button label is "Retry" for unclassified error codes', () => {
    render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={UNKNOWN_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    const retryButton = screen.getByRole('button', { name: 'Retry' });
    expect(retryButton).toBeTruthy();
    const goToSettings = screen.queryByRole('button', { name: 'Go to Settings' });
    expect(goToSettings).toBeNull();
  });

  it('does NOT add a redundant sr-only span for unclassified errors (raw message already in summary)', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={UNKNOWN_ERROR}
        onRetry={() => {}}
        tokenCountVisibility="never"
      />
    );
    // For unclassified errors, summary === `Error: ${error.message}` so the
    // component skips the sr-only span (it would duplicate what's already visible).
    const srOnlySpanWithRawMessage = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === UNKNOWN_ERROR.message);
    expect(srOnlySpanWithRawMessage).toBeUndefined();
  });
});

// ─── 5. sr-only raw message — cross-tone contract ─────────────────────────────

describe('MessageBubble error tone — sr-only raw message contract (#463)', () => {
  it('sr-only span is in the DOM but not visible for auth_failure', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={makeError('auth_failure', 'API key is malformed.')}
        tokenCountVisibility="never"
      />
    );
    // The sr-only span must be present in the DOM (for AT) — not display:none which
    // would fully remove it from the AOM.
    const srSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === 'API key is malformed.');
    expect(srSpan).not.toBeUndefined();
    // Tailwind sr-only uses absolute positioning + overflow:hidden, not display:none.
    // getComputedStyle in jsdom returns empty strings for CSS class rules, so we
    // verify the class name rather than computed style — the class is the contract.
    expect(srSpan?.className).toMatch(/\bsr-only\b/);
  });

  it('sr-only span is in the DOM but not visible for rate_limit', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={makeError('rate_limit', 'Rate limit: 60 req/min exceeded.')}
        tokenCountVisibility="never"
      />
    );
    const srSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === 'Rate limit: 60 req/min exceeded.');
    expect(srSpan).not.toBeUndefined();
    expect(srSpan?.className).toMatch(/\bsr-only\b/);
  });

  it('sr-only span is in the DOM but not visible for network_error', () => {
    const { container } = render(
      <MessageBubble
        message={ERROR_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        error={makeError('network_error', 'Connection refused by upstream.')}
        tokenCountVisibility="never"
      />
    );
    const srSpan = [...container.querySelectorAll('span.sr-only')]
      .find((el) => el.textContent === 'Connection refused by upstream.');
    expect(srSpan).not.toBeUndefined();
    expect(srSpan?.className).toMatch(/\bsr-only\b/);
  });

  it('the three known codes each produce a distinct visible summary (no two are equal)', () => {
    // Regression guard: if the summaryMap keys get corrupted or collapsed, two
    // codes would produce the same visible text — this test catches that.
    const summaries: string[] = [];

    for (const code of ['auth_failure', 'rate_limit', 'network_error'] as const) {
      const { container } = render(
        <MessageBubble
          message={{ ...ERROR_MESSAGE, id: `msg-${code}` }}
          modelConfig={CLAUDE_CONFIG}
          error={makeError(code, 'provider error detail')}
          tokenCountVisibility="never"
        />
      );
      const alertRegion = container.querySelector('[role="alert"]');
      const p = alertRegion?.querySelector('p');
      if (p?.textContent) summaries.push(p.textContent);
      // Unmount between renders to avoid aria-label conflicts in the same document.
      container.remove();
    }

    expect(summaries).toHaveLength(3);
    const uniqueSummaries = new Set(summaries);
    expect(uniqueSummaries.size).toBe(3);
  });

  it('error section renders with role="alert" for all error codes', () => {
    for (const code of ['auth_failure', 'rate_limit', 'network_error', 'context_length_exceeded'] as const) {
      const { container } = render(
        <MessageBubble
          message={{ ...ERROR_MESSAGE, id: `msg-alert-${code}` }}
          modelConfig={CLAUDE_CONFIG}
          error={makeError(code, 'some error')}
          tokenCountVisibility="never"
        />
      );
      const alertRegion = container.querySelector('[role="alert"]');
      expect(alertRegion).not.toBeNull();
      container.remove();
    }
  });
});
