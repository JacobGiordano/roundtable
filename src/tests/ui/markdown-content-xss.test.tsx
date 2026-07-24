/**
 * XSS payload unit tests for MarkdownContent — closes #416
 *
 * MarkdownContent implements a four-layer security model (documented in
 * src/ui/components/MarkdownContent.tsx §Security):
 *
 *   Layer 1: DOMPurify pre-processes the raw markdown string with
 *            ALLOWED_TAGS: [], ALLOWED_ATTR: []. Every HTML element a model
 *            might inject is stripped before react-markdown sees it.
 *
 *   Layer 2: rehype-raw is intentionally absent — react-markdown never
 *            evaluates raw HTML passthrough.
 *
 *   Layer 3: rehypeSanitize strips unsafe hast nodes after the plugin
 *            pipeline runs.
 *
 *   Layer 4: Custom <a> renderer validates href scheme against
 *            SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']).
 *            Any href whose scheme is not in the set renders as <span> text,
 *            producing no clickable link element.
 *
 * These tests assert observable output behavior — not implementation details.
 * A test here fails for exactly the right reason when the security contract breaks:
 * it either finds an <a> element it should not, or finds injected script text.
 *
 * Cross-agent contracts exercised:
 *   MarkdownContent (Aria, src/ui/components/MarkdownContent.tsx)
 *   SAFE_SCHEMES allowlist — link renderer security contract
 *   DOMPurify sanitizeMarkdown() — raw HTML layer
 *
 * This file lives in src/tests/ui/ (Scout owns).
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MarkdownContent } from '@/ui/components/MarkdownContent';

// ─── Helper ────────────────────────────────────────────────────────────────────

/**
 * Return all <a> elements present in the rendered output.
 * An XSS-blocked link must produce zero <a> elements — it renders as <span>.
 */
function getLinks(container: HTMLElement): NodeListOf<HTMLAnchorElement> {
  return container.querySelectorAll('a');
}

// ─── Suite 1: SAFE_SCHEMES — link renderer (Layer 4) ─────────────────────────

describe('MarkdownContent — SAFE_SCHEMES link allowlist (#416)', () => {

  // ── 1a. javascript: scheme ──────────────────────────────────────────────────

  it('renders javascript: href as plain <span> text, not an <a> element', () => {
    // A model that injects [click me](javascript:alert(1)) must not produce
    // a clickable anchor. The custom <a> renderer catches new URL() returning
    // protocol "javascript:" which is absent from SAFE_SCHEMES.
    const { container } = render(
      <MarkdownContent content="[click me](javascript:alert(1))" />
    );

    const links = getLinks(container);
    expect(links).toHaveLength(0);

    // The link text itself must still be visible — the span child is preserved.
    expect(container.textContent).toContain('click me');
  });

  it('renders javascript: scheme with mixed case as plain <span> text', () => {
    // URL parsing normalises the scheme to lowercase, so "Javascript:" and
    // "JAVASCRIPT:" both produce protocol "javascript:" — blocked by SAFE_SCHEMES.
    const { container } = render(
      <MarkdownContent content="[xss](Javascript:alert(1))" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  it('renders javascript: scheme with encoded colon as plain <span> text', () => {
    // The URL constructor parses javascript%3Aalert as a relative URL, which
    // throws (no base) — falling into the catch block where isSafe = false.
    const { container } = render(
      <MarkdownContent content="[xss](javascript%3Aalert(1))" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1b. data: scheme ────────────────────────────────────────────────────────

  it('renders data: href as plain <span> text, not an <a> element', () => {
    // data: URIs can carry arbitrary HTML/script payloads that execute in some
    // browsers when navigated to. "data:" is not in SAFE_SCHEMES.
    const { container } = render(
      <MarkdownContent content='[click](data:text/html,<script>alert(1)</script>)' />
    );
    expect(getLinks(container)).toHaveLength(0);
    expect(container.textContent).toContain('click');
  });

  it('renders data:text/plain as plain <span> text (data: is never safe)', () => {
    // Even a data: URI carrying plain text must be blocked — SAFE_SCHEMES does
    // not distinguish data: subtypes. The allowlist is scheme-level.
    const { container } = render(
      <MarkdownContent content="[file](data:text/plain,hello)" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1c. Protocol-relative URLs ─────────────────────────────────────────────

  it('renders protocol-relative (//example.com) href as plain <span> text', () => {
    // new URL("//example.com") throws "Invalid URL" — no scheme can be
    // extracted. The catch block sets isSafe = false.
    const { container } = render(
      <MarkdownContent content="[site](//example.com)" />
    );
    expect(getLinks(container)).toHaveLength(0);
    expect(container.textContent).toContain('site');
  });

  it('renders protocol-relative URL with path as plain <span> text', () => {
    const { container } = render(
      <MarkdownContent content="[page](//example.com/path?q=1)" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1d. vbscript: scheme ────────────────────────────────────────────────────

  it('renders vbscript: href as plain <span> text, not an <a> element', () => {
    // vbscript: executes in legacy IE — blocked because "vbscript:" is absent
    // from SAFE_SCHEMES. new URL() parses it successfully as a non-http scheme.
    const { container } = render(
      <MarkdownContent content="[run](vbscript:MsgBox(1))" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1e. file: scheme ────────────────────────────────────────────────────────

  it('renders file: href as plain <span> text, not an <a> element', () => {
    // file: URIs access the local filesystem — not in SAFE_SCHEMES.
    const { container } = render(
      <MarkdownContent content="[local](file:///etc/passwd)" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1f. Empty and malformed hrefs ──────────────────────────────────────────

  it('renders an empty href as plain <span> text', () => {
    // An empty string is not parseable by new URL() without a base — throws.
    // isSafe = false in the catch block.
    const { container } = render(
      <MarkdownContent content="[empty]()" />
    );
    // react-markdown may omit the link entirely for empty hrefs — either way
    // no <a> should appear.
    expect(getLinks(container)).toHaveLength(0);
  });

  it('renders a relative path href as plain <span> text', () => {
    // Relative paths (no scheme) fail new URL() — blocked.
    // This guards against payloads like [x](./malicious.html).
    const { container } = render(
      <MarkdownContent content="[relative](./page.html)" />
    );
    expect(getLinks(container)).toHaveLength(0);
  });

  // ── 1g. Safe schemes — must pass through ───────────────────────────────────

  it('renders http: href as a real <a> element', () => {
    const { container } = render(
      <MarkdownContent content="[site](http://example.com)" />
    );
    const links = getLinks(container);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('http://example.com/');
  });

  it('renders https: href as a real <a> element with target="_blank"', () => {
    const { container } = render(
      <MarkdownContent content="[secure](https://example.com)" />
    );
    const links = getLinks(container);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('https://example.com/');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders mailto: href as a real <a> element', () => {
    // mailto: is safe and in SAFE_SCHEMES. It is not external (does not start
    // with http/https) so no target="_blank" or rel is added.
    const { container } = render(
      <MarkdownContent content="[email](mailto:hello@example.com)" />
    );
    const links = getLinks(container);
    expect(links).toHaveLength(1);
    expect(links[0].href).toBe('mailto:hello@example.com');
    expect(links[0].getAttribute('target')).toBeNull();
  });

  it('https: link carries sr-only "(opens in new tab)" text for WCAG 2.4.4', () => {
    // §7.3 of the spec requires an sr-only new-tab announcement on external links.
    // This is a security-adjacent contract — a missing sr-only text breaks
    // WCAG 2.4.4 and is also the canonical sign that the link renderer has been
    // replaced with a fallback that does not enforce the full security contract.
    const { container } = render(
      <MarkdownContent content="[docs](https://docs.example.com)" />
    );
    const srOnly = container.querySelector('.sr-only');
    expect(srOnly).not.toBeNull();
    expect(srOnly?.textContent).toContain('opens in new tab');
  });
});

// ─── Suite 2: DOMPurify layer — raw HTML injection (Layer 1) ─────────────────

describe('MarkdownContent — DOMPurify raw HTML sanitization (#416)', () => {

  it('strips a <script> tag injected directly in markdown content', () => {
    // DOMPurify with ALLOWED_TAGS: [] removes every HTML element including
    // <script>. react-markdown never sees the script element.
    const { container } = render(
      <MarkdownContent content={'<script>alert("xss")</script>Hello'} />
    );
    const scripts = container.querySelectorAll('script');
    expect(scripts).toHaveLength(0);

    // The surrounding text should still render (DOMPurify preserves text nodes
    // when stripping tags, though markdown may or may not surface "Hello" —
    // what matters is the script element is gone).
  });

  it('strips an <img> tag with onerror payload', () => {
    // <img src=x onerror=alert(1)> is a classic XSS vector via inline HTML.
    // DOMPurify ALLOWED_TAGS: [] removes the img element entirely.
    const { container } = render(
      <MarkdownContent content='<img src="x" onerror="alert(1)" />Safe text after' />
    );
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(0);
  });

  it('strips an <iframe> tag injected in markdown content', () => {
    const { container } = render(
      <MarkdownContent content='<iframe src="https://evil.com"></iframe>' />
    );
    const iframes = container.querySelectorAll('iframe');
    expect(iframes).toHaveLength(0);
  });

  it('strips an <svg> with onload payload', () => {
    // SVG elements can carry event handlers — DOMPurify ALLOWED_TAGS: [] blocks them.
    const { container } = render(
      <MarkdownContent content='<svg onload="alert(1)"><circle r="50"/></svg>' />
    );
    const svgs = container.querySelectorAll('svg');
    expect(svgs).toHaveLength(0);
  });

  it('strips event handler attributes from any element', () => {
    // Even if an element type were allowed (it is not — ALLOWED_TAGS is empty),
    // ALLOWED_ATTR: [] removes all attributes including onclick, onmouseover, etc.
    const { container } = render(
      <MarkdownContent content='<div onclick="alert(1)">click me</div>' />
    );
    const divsWithOnclick = container.querySelectorAll('[onclick]');
    expect(divsWithOnclick).toHaveLength(0);
  });

  it('preserves normal markdown paragraph text after a stripped HTML tag', () => {
    // Verify DOMPurify does not corrupt surrounding markdown content when it
    // strips an injected element. Text nodes are preserved; tags are removed.
    const { container } = render(
      <MarkdownContent content={'<script>bad()</script>\n\nThis paragraph should render.'} />
    );
    expect(container.textContent).toContain('This paragraph should render.');
  });

  it('strips a raw <a> element with javascript: href injected as HTML', () => {
    // If someone injects raw HTML <a href="javascript:..."> rather than using
    // markdown link syntax, DOMPurify layer 1 removes the entire <a> element
    // (ALLOWED_TAGS: []) before the link renderer even runs.
    const { container } = render(
      <MarkdownContent content='<a href="javascript:alert(1)">click</a>' />
    );
    // No anchor should be present — DOMPurify stripped the raw HTML <a>.
    // Note: the link text "click" may appear as a text node (DOMPurify
    // may preserve text content when stripping tags). What must not appear
    // is an <a> element.
    expect(getLinks(container)).toHaveLength(0);
  });
});

// ─── Suite 3: Combination payloads ───────────────────────────────────────────

describe('MarkdownContent — combination XSS payloads (#416)', () => {

  it('renders a message with mixed safe and unsafe links correctly', () => {
    // Multiple links in one message — only safe ones produce <a> elements.
    const content = [
      '[safe](https://example.com)',
      '[evil](javascript:alert(1))',
      '[also safe](mailto:a@b.com)',
      '[data-xss](data:text/html,<h1>xss</h1>)',
    ].join(' ');

    const { container } = render(<MarkdownContent content={content} />);
    const links = getLinks(container);

    // Only https: and mailto: links should produce <a> elements.
    expect(links).toHaveLength(2);
    const hrefs = Array.from(links).map(a => a.href);
    expect(hrefs).toContain('https://example.com/');
    expect(hrefs).toContain('mailto:a@b.com');

    // Neither javascript: nor data: should appear as href.
    expect(hrefs.some(h => h.startsWith('javascript:'))).toBe(false);
    expect(hrefs.some(h => h.startsWith('data:'))).toBe(false);
  });

  it('renders a message with a script tag AND a malicious link without executing either', () => {
    // Two different attack vectors in a single message — both blocked.
    const content = '<script>evil()</script>\n\n[xss](javascript:evil())';

    const { container } = render(<MarkdownContent content={content} />);

    // No script elements.
    expect(container.querySelectorAll('script')).toHaveLength(0);

    // No anchor elements (javascript: link was blocked).
    expect(getLinks(container)).toHaveLength(0);
  });

  it('treats a javascript: link inside a blockquote as blocked', () => {
    // The custom <a> renderer runs regardless of block context.
    const { container } = render(
      <MarkdownContent content="> [quoted evil](javascript:alert(1))" />
    );
    expect(getLinks(container)).toHaveLength(0);
    // Blockquote itself should still render.
    expect(container.querySelector('blockquote')).not.toBeNull();
  });

  it('treats a data: link inside a list item as blocked', () => {
    const { container } = render(
      <MarkdownContent content="- [list item](data:text/plain,payload)" />
    );
    expect(getLinks(container)).toHaveLength(0);
    // The list itself still renders.
    expect(container.querySelector('li')).not.toBeNull();
  });
});
