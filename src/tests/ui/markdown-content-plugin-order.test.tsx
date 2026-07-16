/**
 * Regression test: MarkdownContent rehype plugin order — closes #474
 *
 * HANDOFF.md documents: "`rehypeHighlight` must run before `rehypeSanitize` in
 * `MarkdownContent` — order is load-bearing (hljs-* classes must exist in hast
 * before sanitize evaluates them)."
 *
 * If the plugin order is ever reversed (rehypeSanitize before rehypeHighlight),
 * rehypeSanitize will strip the hljs-* classes before rehypeHighlight can add
 * them — or rehypeSanitize will see no hljs-* classes at all because rehypeHighlight
 * hasn't run yet. Either way, the rendered code block will contain no `hljs-*`
 * class tokens, and syntax highlighting will be silently broken.
 *
 * This test renders a fenced TypeScript code block and asserts that at least one
 * element with an `hljs-*` class exists in the rendered output. A correct plugin
 * order produces token-colored spans; an incorrect order produces none.
 *
 * Cross-agent contracts exercised:
 *   MarkdownContent (Aria, src/ui/components/MarkdownContent.tsx) — plugin pipeline
 *
 * Source: src/ui/components/MarkdownContent.tsx (Aria owns)
 * This test file lives in src/tests/ui/ (Scout owns)
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownContent } from '@/ui/components/MarkdownContent';

const TS_CODE_BLOCK = [
  '```typescript',
  'const x: number = 1;',
  'const greet = (name: string): string => `Hello, ${name}!`;',
  '```',
].join('\n');

describe('MarkdownContent — rehype plugin order: rehypeHighlight before rehypeSanitize (#474)', () => {
  it('renders a fenced TypeScript code block with at least one hljs-* class token', () => {
    // This test guards the load-bearing plugin order documented in HANDOFF.md.
    // If rehypeSanitize runs BEFORE rehypeHighlight, the sanitizer removes all
    // hljs-* classes (they don't exist yet in the hast) and this assertion fails.
    // If the order is correct, rehypeHighlight injects hljs-* span wrappers first,
    // the sanitize schema allows /^hljs-/ on span elements, and they survive.
    const { container } = render(<MarkdownContent content={TS_CODE_BLOCK} />);

    // Query for any element whose className contains an hljs- token class.
    // querySelectorAll('[class*="hljs-"]' is the simplest selector for this.
    const hljsElements = container.querySelectorAll('[class*="hljs-"]');
    expect(hljsElements.length).toBeGreaterThan(0);
  });

  it('the code block also carries the hljs base class on the <code> element', () => {
    // rehypeHighlight adds the `hljs` base class to the <code> element alongside
    // the `language-typescript` class. The sanitize schema allows `hljs` on code.
    // If the plugin order is wrong, the hljs base class is also absent.
    const { container } = render(<MarkdownContent content={TS_CODE_BLOCK} />);

    const codeEl = container.querySelector('code.hljs');
    expect(codeEl).not.toBeNull();
  });

  it('the code block carries the language-typescript class (language detection working)', () => {
    // Confirms that rehypeHighlight correctly identified the language tag from
    // the fenced block. Complements the hljs-* token assertion above.
    const { container } = render(<MarkdownContent content={TS_CODE_BLOCK} />);

    const langCode = container.querySelector('code.language-typescript');
    expect(langCode).not.toBeNull();
  });
});
