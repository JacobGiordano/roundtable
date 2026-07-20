/**
 * MarkdownContent — spec-compliant markdown renderer for message bubbles.
 *
 * Issue #409: renders markdown in assistant message bubbles using react-markdown +
 * remark-gfm. Security: three-layer defense per Luma spec (markdown-rendering.md §5):
 *   1. DOMPurify pre-processing strips all raw HTML from the markdown string
 *      (ALLOWED_TAGS: [], ALLOWED_ATTR: []).
 *   2. rehype-raw is NOT enabled — ever.
 *   3. Custom <a> renderer validates href scheme against SAFE_SCHEMES before
 *      producing a link element. Unsafe schemes render as <span> text.
 *
 * Issue #417: rehypeHighlight + rehypeSanitize (with extended schema) added so
 * fenced code blocks receive syntax highlighting in completed messages — matching
 * the streaming render path in MessageBubble.tsx.
 *
 * Issue #418: MarkdownContent is now used for user messages too. The security
 * model is identical — DOMPurify + rehype-sanitize. User content is trusted in
 * origin but still sanitized for defense in depth.
 *
 * All class names use registered Tailwind token classes. No inline styles.
 * No @tailwindcss/typography (prose plugin) — all styling is via custom component overrides.
 *
 * Rune review required before this ships: this component renders untrusted model output.
 */

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// #417: rehypeHighlight restores syntax highlighting in completed code blocks.
// Plugin order is load-bearing: rehypeHighlight BEFORE rehypeSanitize so hljs-* classes
// exist in the hast when sanitize evaluates them.
// #446: Restricted language set — avoids bundling all 37 "common" highlight.js languages
// (~9 MB source). Only languages commonly produced by AI models are included.
// html/xml share the same module in highlight.js (xml.js registers both).
import rehypeHighlight from 'rehype-highlight';
import hljs_javascript from 'highlight.js/lib/languages/javascript';
import hljs_typescript from 'highlight.js/lib/languages/typescript';
import hljs_python     from 'highlight.js/lib/languages/python';
import hljs_bash       from 'highlight.js/lib/languages/bash';
import hljs_shell      from 'highlight.js/lib/languages/shell';
import hljs_json       from 'highlight.js/lib/languages/json';
import hljs_css        from 'highlight.js/lib/languages/css';
import hljs_xml        from 'highlight.js/lib/languages/xml';
import hljs_sql        from 'highlight.js/lib/languages/sql';
import hljs_go         from 'highlight.js/lib/languages/go';
import hljs_rust       from 'highlight.js/lib/languages/rust';
import hljs_java       from 'highlight.js/lib/languages/java';
import hljs_cpp        from 'highlight.js/lib/languages/cpp';
import hljs_csharp     from 'highlight.js/lib/languages/csharp';
import hljs_ruby       from 'highlight.js/lib/languages/ruby';
import hljs_php        from 'highlight.js/lib/languages/php';
import hljs_swift      from 'highlight.js/lib/languages/swift';
import hljs_kotlin     from 'highlight.js/lib/languages/kotlin';
import hljs_yaml       from 'highlight.js/lib/languages/yaml';
import hljs_markdown   from 'highlight.js/lib/languages/markdown';
import hljs_diff       from 'highlight.js/lib/languages/diff';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
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

// ─── Security: Extended rehype-sanitize schema (#417) ────────────────────────

/**
 * Extended rehype-sanitize schema for syntax highlighting and GFM tables (#464).
 *
 * rehype-highlight adds:
 *   - `hljs` and `language-*` className on `<code>` elements
 *   - `hljs-*` className on `<span>` elements wrapping individual tokens
 *
 * The default schema allows `language-*` on `code` via `/^language-./` but does
 * not allow the `hljs` base class or any class on `span` elements. We extend the
 * schema minimally: allow `hljs` on `code` and `hljs-*` on `span`.
 *
 * #464: table, thead, tbody, tr, th, td are all in the defaultSchema allowlist.
 * GFM tables produce align="left"|"center"|"right" on th/td for column alignment.
 * We extend the schema to allow the align attribute on th and td so column
 * alignment renders correctly. No new element types are introduced.
 *
 * Plugin order is load-bearing: rehypeHighlight must run BEFORE rehypeSanitize so
 * the highlight classes exist in the hast when sanitize evaluates them.
 */
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    // Allow hljs base class alongside the existing language-* allowance.
    code: [['className', /^language-./, 'hljs']],
    // Allow individual token span wrappers added by rehype-highlight.
    span: [...(defaultSchema.attributes?.span ?? []), ['className', /^hljs-/]],
    // #464: Allow align attribute on table header and data cells for GFM column alignment.
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
  },
};

// ─── rehype-highlight language map (#446) ────────────────────────────────────

/**
 * Restricted language map for rehype-highlight.
 * Covers the languages most commonly produced by AI models.
 * html and xml are both registered by highlight.js/lib/languages/xml (the
 * highlight.js xml module registers itself under "html" and "xml" aliases).
 */
const HIGHLIGHT_LANGUAGES: Record<string, unknown> = {
  javascript: hljs_javascript,
  typescript: hljs_typescript,
  python:     hljs_python,
  bash:       hljs_bash,
  shell:      hljs_shell,
  json:       hljs_json,
  css:        hljs_css,
  xml:        hljs_xml,
  html:       hljs_xml, // highlight.js xml module handles html
  sql:        hljs_sql,
  go:         hljs_go,
  rust:       hljs_rust,
  java:       hljs_java,
  cpp:        hljs_cpp,
  csharp:     hljs_csharp,
  ruby:       hljs_ruby,
  php:        hljs_php,
  swift:      hljs_swift,
  kotlin:     hljs_kotlin,
  yaml:       hljs_yaml,
  markdown:   hljs_markdown,
  diff:       hljs_diff,
};

// ─── rehype plugin array (order-sensitive) ────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [
  [rehypeHighlight, { languages: HIGHLIGHT_LANGUAGES }],
  [rehypeSanitize, sanitizeSchema],
];

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
 * Note on heading elements: h1–h3 are downshifted to h3–h5 per Ada advisory
 * (WCAG 1.3.1) — conversational headings must not pollute the page heading outline.
 * h4–h6 collapse to h6. Visual sizes are preserved via Tailwind classes.
 *
 * Note on inline code detection: react-markdown v10 removed the `inline` prop.
 * Detection uses node position: when start.line === end.line, the node is inline.
 * When start.line !== end.line (multiple source lines), it is a fenced block.
 * The outer <pre> renderer handles block code wrapping.
 *
 * Note on fenced block code renderer (#417): className (e.g. "language-python hljs")
 * is passed through so rehype-highlight's hljs-* span classes reach the DOM.
 * text-text-primary is intentionally omitted — the hljs theme CSS controls token
 * colors via span.hljs-* selectors; a blanket foreground color conflicts with them.
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
    // §2.5 + Ada advisory (WCAG 1.3.1 — Info and Relationships):
    // Headings are downshifted by 2 levels so model- or user-generated `#` never
    // produces <h1>/<h2> inside <main>. Arbitrary conversational headings should
    // not pollute the screen reader heading-navigation outline (VoiceOver VO+Cmd+H,
    // NVDA H). The same downshift is applied in the streaming renderer in
    // MessageBubble.tsx (markdownComponents lines 255–271).
    // Visual sizes are preserved via Tailwind classes — semantic element and visual
    // weight are independent.
    h1({ children }) {
      return (
        <h3 className="text-xl font-bold mt-5 mb-2 text-text-primary leading-snug first:mt-0">
          {children}
        </h3>
      );
    },
    h2({ children }) {
      return (
        <h4 className="text-lg font-semibold mt-4 mb-2 text-text-primary leading-snug first:mt-0">
          {children}
        </h4>
      );
    },
    h3({ children }) {
      return (
        <h5 className="text-base font-semibold mt-3 mb-1 text-text-primary leading-snug first:mt-0">
          {children}
        </h5>
      );
    },
    // h4–h6: all render as <h6> — deepest safe level. Visual weight preserved.
    h4({ children }) {
      return (
        <h6 className="text-sm font-semibold mt-3 mb-1 text-text-secondary leading-snug first:mt-0">
          {children}
        </h6>
      );
    },
    h5({ children }) {
      return (
        <h6 className="text-xs font-semibold mt-2 mb-1 text-text-secondary leading-snug first:mt-0">
          {children}
        </h6>
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
    //
    // #417: For fenced blocks, className carries "language-{lang} hljs" from rehype-highlight.
    // Pass className through so the hljs token-color spans work against the atom-one-dark theme.
    // text-text-primary intentionally omitted — would override individual hljs-* token colors.
    code({ children, className, node }) {
      const isBlock =
        node?.position?.start.line !== node?.position?.end.line;

      if (isBlock) {
        // Fenced block: pass className (e.g. "language-python hljs") through to the DOM.
        // The hljs-* span elements injected by rehype-highlight carry the token colors;
        // the outer <pre> controls the block background via bg-code-block.
        return (
          <code className={['text-[13px] font-mono leading-relaxed block', className].filter(Boolean).join(' ')}>
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
        <pre className="group relative bg-code-block rounded-md p-4 overflow-x-auto my-3 text-sm font-mono leading-relaxed">
          {children}
          <CopyCodeButton codeText={codeText} />
        </pre>
      );
    },

    // ── Tables (#464) ──────────────────────────────────────────────────────
    // remark-gfm produces table AST nodes; react-markdown passes them through
    // as table/thead/tbody/tr/th/td elements. We override all six to apply
    // design-system token classes:
    //   - outer overflow-x-auto wrapper: horizontally scrollable on narrow viewports
    //   - table: full-width, collapsed borders (border-collapse removes double borders)
    //   - th: header cells — semibold, border-bottom, bg-hover tint for contrast
    //   - td: data cells — lighter weight, border-bottom
    //   - tr: alternating row shading via CSS :nth-child(even) emulated with
    //         even: class applied to every second tbody row
    //   All colors use existing token classes — no novel color choices.
    table({ children }) {
      return (
        <div className="overflow-x-auto my-3">
          <table className="w-full text-sm border-collapse border border-border-subtle">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return (
        <thead className="bg-hover">
          {children}
        </thead>
      );
    },
    tbody({ children }) {
      // #524: Tailwind's even: variant doesn't fire on <tr> elements rendered through
      // ReactMarkdown custom components — the CSS :nth-child pseudo-class runs against
      // the browser DOM, but the component tree is re-evaluated in React's reconciler
      // first, causing the selector to miss. Fix: enumerate children imperatively via
      // React.Children.map and assign the shading class based on the 0-indexed position.
      let rowIndex = 0;
      const shadedChildren = React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        // bg-border-subtle provides visible but gentle alternating shading across all 7 themes.
        // bg-hover/40 was invisible on dark themes (--interactive-hover at 40% = near-zero
        // contrast on deep-navy/dark surfaces). bg-border-subtle maps to --border-subtle,
        // a consistently distinct tint in every theme (e.g. #131E33 on Midnight, #EBEBEB on Chalk).
        const bgClass = rowIndex % 2 === 1 ? 'bg-border-subtle' : '';
        rowIndex++;
        // Merge into the child's existing className (tr renderer sets border classes).
        const existingClass = (child.props as { className?: string }).className ?? '';
        return React.cloneElement(child as React.ReactElement<{ className?: string }>, {
          className: [existingClass, bgClass].filter(Boolean).join(' '),
        });
      });
      return <tbody>{shadedChildren}</tbody>;
    },
    tr({ children }) {
      return (
        <tr className="border-b border-border-subtle">
          {children}
        </tr>
      );
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left text-[12px] font-semibold text-text-primary border-r border-border-subtle last:border-r-0 whitespace-nowrap">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 text-[13px] text-text-primary border-r border-border-subtle last:border-r-0">
          {children}
        </td>
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

// remark plugins: remarkGfm enables strikethrough, tables, and task lists.
// #464: tables are now rendered via the table/thead/tbody/tr/th/td component overrides.
const remarkPlugins = [remarkGfm];

// ─── MarkdownContent ──────────────────────────────────────────────────────────

interface MarkdownContentProps {
  /** Raw markdown string — will be DOMPurify-sanitized before rendering. */
  content: string;
}

/**
 * Renders markdown content inside a message bubble.
 *
 * Used for both assistant messages and user messages (#418).
 *
 * Security: DOMPurify (layer 1) runs before react-markdown. rehypeHighlight adds
 * syntax highlighting (layer 2 — token colors), then rehypeSanitize (layer 3)
 * strips any unsafe HTML that survived the hast pipeline. rehype-raw is never
 * enabled. Custom <a> renderer validates href scheme (layer 4).
 *
 * Usage:
 *   <MarkdownContent content={message.content} />
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  // Layer 1: strip raw HTML from the markdown string before react-markdown sees it.
  // #449: memoized — for completed messages content never changes, so DOMPurify
  // should not re-run on every parent re-render.
  const sanitized = useMemo(() => sanitizeMarkdown(content), [content]);

  return (
    // §3: bubble content wrapper — text-text-primary base color, text-sm, leading-relaxed.
    <div className="text-text-primary text-sm leading-relaxed">
      {/*
       * react-markdown renders to React elements, never innerHTML.
       * rehype-raw is intentionally omitted — raw HTML passthrough is the primary XSS vector.
       * remarkGfm enables GFM extensions: strikethrough, tables (caught by table override).
       * rehypeHighlight adds syntax token classes; rehypeSanitize follows to strip unsafe attrs.
       */}
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {sanitized}
      </ReactMarkdown>
    </div>
  );
}
