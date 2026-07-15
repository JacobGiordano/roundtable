/**
 * MarkdownContent — spec-compliant markdown renderer for model response bubbles.
 *
 * Issue #409: renders markdown in assistant message bubbles using react-markdown +
 * remark-gfm. Security: three-layer defense per Luma spec (markdown-rendering.md §5):
 *   1. DOMPurify pre-processing strips all raw HTML from the markdown string
 *      (ALLOWED_TAGS: [], ALLOWED_ATTR: []).
 *   2. rehype-raw is NOT enabled — ever.
 *   3. Custom <a> renderer validates href scheme against SAFE_SCHEMES before
 *      producing a link element. Unsafe schemes render as <span> text.
 *
 * All class names use registered Tailwind token classes. No inline styles.
 * No @tailwindcss/typography (prose plugin) — all styling is via custom component overrides.
 *
 * Rune review required before this ships: this component renders untrusted model output.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

// ─── Security: Safe URL schemes ───────────────────────────────────────────────

/**
 * Allowlist of safe URL schemes for link rendering.
 * Any href whose scheme is not in this set renders as plain <span> text.
 * Blocks javascript:, data:, vbscript:, and any other unsafe protocol.
 */
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// ─── Security: DOMPurify sanitizer ────────────────────────────────────────────

/**
 * Strip all raw HTML from a markdown string before handing it to react-markdown.
 * ALLOWED_TAGS: [] removes every HTML element a model might inject.
 * ALLOWED_ATTR: [] removes every attribute.
 *
 * react-markdown renders to React elements (not innerHTML), so this is defense
 * in depth — it prevents a model-injected raw HTML snippet from surviving even
 * if react-markdown's HTML-in-markdown handling ever changes.
 */
function sanitizeMarkdown(raw: string): string {
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}

// ─── Copy-code button ─────────────────────────────────────────────────────────

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Copy-code button for fenced code blocks.
 * Spec: markdown-rendering.md §4.
 *
 * Accessibility:
 *   - <button> element (not div/span with onClick).
 *   - aria-live="polite" on the label span: state changes (Copied! / Failed)
 *     are announced to screen readers without requiring focus retention (§7.1).
 *   - focus-visible: ring on keyboard focus; opacity-0 at rest, visible on
 *     group-hover of the <pre> wrapper and on focus-visible.
 *   - Timeout cleared on unmount to prevent setState on unmounted component.
 */
function CopyCodeButton({ codeText }: { codeText: string }) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any pending reset timeout on unmount.
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(codeText)
      .then(() => {
        setCopyState('copied');
        timeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
      })
      .catch(() => {
        setCopyState('error');
        timeoutRef.current = setTimeout(() => setCopyState('idle'), 2000);
      });
  }, [codeText]);

  const label =
    copyState === 'copied' ? 'Copied!' : copyState === 'error' ? 'Failed' : 'Copy';

  const labelColorClass =
    copyState === 'copied'
      ? 'text-success'
      : copyState === 'error'
        ? 'text-error'
        : '';

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label="Copy code"
      className={[
        'absolute top-2 right-2',
        'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        'transition-opacity duration-[100ms]',
        'px-2 py-1 rounded-sm',
        'text-[11px] font-medium leading-none',
        // bg-card = var(--surface-card) per tailwind.config.js — spec calls this bg-surface-card
        // but the Tailwind key is 'card', making the class bg-card.
        'bg-card text-text-secondary',
        'border border-border',
        'hover:bg-hover hover:text-text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
      ].join(' ')}
    >
      {/* aria-live="polite": announces state changes to screen readers (WCAG 4.1.3). */}
      <span aria-live="polite" className={labelColorClass}>
        {label}
      </span>
    </button>
  );
}

// ─── Markdown component renderers ─────────────────────────────────────────────

/**
 * react-markdown component overrides per Luma spec §2.
 * All styles use registered Tailwind token classes — no hardcoded hex values,
 * no inline styles.
 *
 * Note on heading elements: semantic <h1>–<h3> elements are used here as spec
 * permits for v1. If the page has a conflicting heading hierarchy, Ada can advise
 * whether to switch to styled <p> elements in a follow-on issue (#409 §7.4).
 *
 * Note on inline code detection: react-markdown v10 removed the `inline` prop.
 * Detection uses node position: when start.line === end.line, the node is inline.
 * When start.line !== end.line (multiple source lines), it is a fenced block.
 * The outer <pre> renderer handles block code wrapping.
 */
function buildComponents(): React.ComponentProps<typeof ReactMarkdown>['components'] {
  return {
    // ── Paragraphs ─────────────────────────────────────────────────────────
    // §2.12: leading-relaxed, my-2, first:mt-0 last:mb-0.
    p({ children }) {
      return (
        <p className="leading-relaxed my-2 text-text-primary first:mt-0 last:mb-0">
          {children}
        </p>
      );
    },

    // ── Headings ───────────────────────────────────────────────────────────
    // §2.5: semantic heading elements in v1; flagged for Ada review (§7.4).
    h1({ children }) {
      return (
        <h1 className="text-xl font-bold mt-5 mb-2 text-text-primary leading-snug first:mt-0">
          {children}
        </h1>
      );
    },
    h2({ children }) {
      return (
        <h2 className="text-lg font-semibold mt-4 mb-2 text-text-primary leading-snug first:mt-0">
          {children}
        </h2>
      );
    },
    h3({ children }) {
      return (
        <h3 className="text-base font-semibold mt-3 mb-1 text-text-primary leading-snug first:mt-0">
          {children}
        </h3>
      );
    },
    // h4–h6: not in spec scope but rendered gracefully with text-text-secondary.
    h4({ children }) {
      return (
        <h4 className="text-sm font-semibold mt-3 mb-1 text-text-secondary leading-snug first:mt-0">
          {children}
        </h4>
      );
    },
    h5({ children }) {
      return (
        <h5 className="text-xs font-semibold mt-2 mb-1 text-text-secondary leading-snug first:mt-0">
          {children}
        </h5>
      );
    },
    h6({ children }) {
      return (
        <h6 className="text-xs font-semibold mt-2 mb-1 text-text-muted leading-snug first:mt-0">
          {children}
        </h6>
      );
    },

    // ── Emphasis ───────────────────────────────────────────────────────────
    // §2.3: font-semibold (600, not 700 — does not compete with headings).
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>;
    },
    // §2.4: italic, no color/weight change.
    em({ children }) {
      return <em className="italic">{children}</em>;
    },

    // ── Strikethrough ──────────────────────────────────────────────────────
    // §2.13: GFM extension (requires remark-gfm). line-through + text-text-secondary.
    del({ children }) {
      return <del className="line-through text-text-secondary">{children}</del>;
    },

    // ── Lists ──────────────────────────────────────────────────────────────
    // §2.6: unordered list — list-disc list-outside pl-5 my-2 space-y-1.
    ul({ children }) {
      return (
        <ul className="list-disc list-outside pl-5 my-2 space-y-1 text-text-primary">
          {children}
        </ul>
      );
    },
    // §2.7: ordered list — list-decimal, same spacing.
    ol({ children }) {
      return (
        <ol className="list-decimal list-outside pl-5 my-2 space-y-1 text-text-primary">
          {children}
        </ol>
      );
    },
    // §2.6/2.7: list items — leading-relaxed for multi-line readability.
    // §2.8: nested lists inside <li> — pl-4 mt-1, no bottom margin.
    // The nested ul/ol renderers above handle nesting (react-markdown with remark-gfm
    // produces correct semantic nesting: <ul> inside <li>, not adjacent).
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>;
    },

    // ── Blockquote ─────────────────────────────────────────────────────────
    // §2.9: 3px left border (border-blockquote), italic, text-text-secondary.
    blockquote({ children }) {
      return (
        <blockquote className="border-l-[3px] border-blockquote pl-3 my-2 italic text-text-secondary">
          {children}
        </blockquote>
      );
    },

    // ── Horizontal rule ────────────────────────────────────────────────────
    // §2.11: border-t border-border-subtle, my-4.
    hr() {
      return <hr className="my-4 border-t border-border-subtle" />;
    },

    // ── Links ──────────────────────────────────────────────────────────────
    // §2.10 + §5: scheme validation is the third security layer.
    // Unsafe schemes (javascript:, data:, etc.) render as <span> text.
    // External links (http/https) get target="_blank" + rel="noopener noreferrer"
    // + sr-only "(opens in new tab)" text (§7.3 — required, not optional).
    // WCAG 1.4.1: underline is the non-color differentiator alongside text-link color.
    a({ href, children }) {
      let isSafe = false;
      if (href) {
        try {
          const url = new URL(href);
          isSafe = SAFE_SCHEMES.has(url.protocol);
        } catch {
          // Non-parseable href (e.g. relative path, malformed) — render as plain text.
          isSafe = false;
        }
      }
      if (!isSafe) {
        // Unsafe scheme: render children as plain text, no link element.
        return <span>{children}</span>;
      }
      const isExternal = href!.startsWith('http://') || href!.startsWith('https://');
      return (
        <a
          href={href}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-link hover:text-link-hover underline decoration-1 underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded-sm"
        >
          {children}
          {/* §7.3: sr-only text required on external links for WCAG compliance. */}
          {isExternal && <span className="sr-only"> (opens in new tab)</span>}
        </a>
      );
    },

    // ── Code (inline and fenced blocks) ───────────────────────────────────
    // §2.1/§2.2: fenced blocks via <pre> below; inline code here.
    // Inline detection: start.line === end.line (react-markdown v10 — no inline prop).
    code({ children, className, node }) {
      const isBlock =
        node?.position?.start.line !== node?.position?.end.line;

      if (isBlock) {
        // Fenced block: the inner <code> is unstyled — the outer <pre> controls appearance.
        // §2.1: "The inner <code> element inside <pre> receives no additional classes."
        // className (e.g. "language-python") is passed through but not highlighted in v1
        // (syntax highlighting is out of scope — separate issue per spec §1 out-of-scope).
        return (
          <code className={className}>
            {children}
          </code>
        );
      }

      // Inline code — §2.2 token classes.
      // Note: spec tailwind-mapping.md shows 'text-code' but the configured key is 'code-text'
      // which generates class 'text-code-text'. Using 'text-code-text' (the actual key-derived class).
      // Gap flagged for Luma: markdown-rendering.md §2.2 uses 'text-code' but tailwind-mapping.md
      // key 'code-text' generates 'text-code-text'. Applied the key-consistent class here.
      return (
        <code className="bg-code border border-code-border text-code-text rounded-sm px-1 py-0.5 font-mono text-[13px] whitespace-nowrap">
          {children}
        </code>
      );
    },

    // ── Pre (fenced code block wrapper) ───────────────────────────────────
    // §2.1: bg-code-block, rounded-md, p-4, overflow-x-auto, my-3, font-mono, text-sm.
    // §4: copy-code button, group for group-hover, relative for absolute positioning.
    // Table fallback (§1): tables render as <pre> blocks with raw markdown text.
    pre({ children }) {
      // Extract the raw text content from the code block children for the copy button.
      // children is a React element (the <code> rendered above); we extract its text
      // content by traversing the children tree recursively.
      const codeText = extractTextContent(children);
      return (
        <pre className="group relative bg-code-block rounded-md p-4 overflow-x-auto my-3 text-sm font-mono leading-relaxed text-text-primary">
          {children}
          <CopyCodeButton codeText={codeText} />
        </pre>
      );
    },

    // ── Table fallback ─────────────────────────────────────────────────────
    // §1 out-of-scope: tables are rendered as a <pre> block showing raw markdown.
    // This prevents broken layouts from malformed model-generated table markdown.
    // Aria implements this as a custom table component override per spec.
    table({ children }) {
      // Render the table as a pre block with the raw text content.
      const rawText = extractTextContent(children);
      return (
        <pre className="bg-code-block rounded-md p-4 overflow-x-auto my-3 text-sm font-mono">
          {rawText || String(children)}
        </pre>
      );
    },
  };
}

/**
 * Recursively extract plain text content from a React node tree.
 * Used to get the raw string for clipboard copy — never copies rendered HTML.
 */
function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextContent).join('');
  if (node && typeof node === 'object' && 'props' in (node as object)) {
    const el = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractTextContent(el.props.children);
  }
  return '';
}

// Memoize components — built once, stable across renders.
// This prevents react-markdown from re-building the components object on every render,
// which would cause all child components to remount unnecessarily during streaming.
const markdownComponents = buildComponents();

// remark plugins: remarkGfm enables strikethrough, tables (caught by table override above).
const remarkPlugins = [remarkGfm];

// ─── MarkdownContent ──────────────────────────────────────────────────────────

interface MarkdownContentProps {
  /** Raw model output string — will be DOMPurify-sanitized before rendering. */
  content: string;
}

/**
 * Renders model output as spec-compliant markdown inside a message bubble.
 *
 * Security: DOMPurify runs before react-markdown. rehype-raw is never enabled.
 * Custom <a> renderer validates href scheme.
 *
 * Usage:
 *   <MarkdownContent content={message.content} />
 *
 * Only for assistant message content. User messages should render as plain
 * whitespace-preserving text (no markdown parsing).
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  // Layer 1: strip raw HTML from the markdown string before react-markdown sees it.
  const sanitized = sanitizeMarkdown(content);

  return (
    // §3: bubble content wrapper — text-text-primary base color, text-sm, leading-relaxed.
    <div className="text-text-primary text-sm leading-relaxed">
      {/*
       * react-markdown renders to React elements, never innerHTML.
       * rehype-raw is intentionally omitted — raw HTML passthrough is the primary XSS vector.
       * remarkGfm enables GFM extensions: strikethrough, tables (caught by table override).
       */}
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={markdownComponents}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}
