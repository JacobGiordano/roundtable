/**
 * MessageBubble — Markdown Rendering Accessibility Tests (#132)
 *
 * Issue #132 added react-markdown + rehype-sanitize rendering for assistant
 * messages. This test file audits the accessibility of that change specifically.
 *
 * Audit targets:
 *   1. Axe violations — assistant message rendered with markdown content
 *   2. Link accessibility — external links (target="_blank" rel="noopener noreferrer")
 *   3. No new-tab announcement via visually hidden text or aria-label on links
 *   4. Heading elements rendered by react-markdown are present and accessible
 *   5. Code blocks are readable by screen readers (<pre><code> structure)
 *   6. aria-live/aria-atomic preserved through markdown re-renders (streaming)
 *
 * WCAG criteria:
 *   - 2.4.4 Link Purpose (In Context) — links must communicate where they go,
 *     including external/new-tab behavior
 *   - 1.3.1 Info and Relationships — heading hierarchy and structural semantics
 *   - 4.1.3 Status Messages — streaming live region preserved after markdown change
 *   - 4.1.2 Name, Role, Value — all interactive elements have accessible names
 *
 * axe-core assertion pattern:
 *   assertNoViolations() helper — equivalent to toHaveNoViolations().
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect } from 'vitest';
import { MessageBubble } from '@/ui/MessageBubble';
import type { Message, ModelConfig } from '@/types';

// ─── Axe assertion helper ─────────────────────────────────────────────────────

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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CLAUDE_CONFIG: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'accent-claude',
  isActive: true,
};

const MARKDOWN_CONTENT = `
# Heading One

## Heading Two

A paragraph with **bold text** and *italic text*.

Here is a [link to example](https://example.com).

- Bullet one
- Bullet two

\`\`\`typescript
const x: number = 42;
\`\`\`

> A blockquote.
`;

const MARKDOWN_MESSAGE: Message = {
  id: 'msg-md-1',
  role: 'assistant',
  content: MARKDOWN_CONTENT,
  modelId: 'claude',
  timestamp: 1_700_000_010_000,
  isStreaming: false,
};

const STREAMING_MARKDOWN_MESSAGE: Message = {
  ...MARKDOWN_MESSAGE,
  id: 'msg-md-2',
  isStreaming: true,
  content: '# Partial heading\n\nStreaming content arrives here…',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MessageBubble — #132: markdown rendering (WCAG 2.4.4, 1.3.1, 4.1.3)', () => {
  it('has no axe violations — assistant message with full markdown content', async () => {
    const { container } = render(
      <MessageBubble
        message={MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations — streaming assistant message with markdown', async () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('external links have target="_blank" and rel="noopener noreferrer"', () => {
    const { container } = render(
      <MessageBubble
        message={MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const links = container.querySelectorAll('a[href^="https://"]');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
      expect(link.getAttribute('rel')).toContain('noreferrer');
    }
  });

  it('code block renders as <pre><code> structure readable by screen readers', () => {
    const { container } = render(
      <MessageBubble
        message={MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // <pre> must contain a <code> child — the standard accessible code block structure
    const preElements = container.querySelectorAll('pre');
    expect(preElements.length).toBeGreaterThan(0);
    for (const pre of preElements) {
      expect(pre.querySelector('code')).not.toBeNull();
    }
  });

  it('heading elements rendered by markdown are semantically present', () => {
    const { container } = render(
      <MessageBubble
        message={MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    // headings are downshifted by 2 (#201): # → h3, ## → h4
    expect(container.querySelector('h3')).not.toBeNull();
    expect(container.querySelector('h4')).not.toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });

  it('aria-live="polite" and aria-atomic="false" are preserved during streaming with markdown', () => {
    const { container } = render(
      <MessageBubble
        message={STREAMING_MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion?.getAttribute('aria-atomic')).toBe('false');
  });

  it('aria-live reverts to "off" on a completed markdown message (no re-announcement)', () => {
    const { container } = render(
      <MessageBubble
        message={MARKDOWN_MESSAGE}
        modelConfig={CLAUDE_CONFIG}
        tokenCountVisibility="never"
      />
    );
    const liveEl = container.querySelector('[aria-live]');
    expect(liveEl?.getAttribute('aria-live')).toBe('off');
  });
});
