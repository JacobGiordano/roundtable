import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
// #446: Restricted language set for the streaming ReactMarkdown path — same set
// as MarkdownContent so highlighting is consistent between streaming and done states.
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
import type { Attachment, GeneratedImage, Message, ModelConfig, ModelError, ModelId, TokenCountVisibility } from '@/types';
// #409: Spec-compliant markdown renderer — DOMPurify pre-sanitization + remark-gfm +
// copy-code button + Luma token classes. Replaces inline ReactMarkdown for "done" state.
// #417: rehypeHighlight + rehypeSanitize added to MarkdownContent for syntax highlighting.
// #418: MarkdownContent is now also used for user message bubbles.
import { MarkdownContent } from './components/MarkdownContent';
// #369: Lightbox — full-size image viewer for attachment thumbnails.
import { Lightbox } from './components/Lightbox';
// #405: CopyIcon extracted to shared icons so Lightbox can import the same component.
// Uses a <mask> internally — no pageFill prop needed, renders correctly on any surface.
// #463: KeyIcon (auth_failure), WifiOffIcon (network_error), ClockIcon (rate_limit)
// differentiate the three error states with distinct tone-appropriate icons.
import { CopyIcon, KeyIcon, WifiOffIcon, ClockIcon } from './icons';
// #390: downloadImage + copyImageToClipboard shared utilities.
// Extracted to utils/ so both Lightbox and MessageBubble share the same
// implementation without cross-component imports.
// #404: copyImageToClipboard now used directly in MessageBubble's below-image copy button.
import { downloadImage, copyImageToClipboard } from './utils/imageActions';
// #357: formatCost shared util — displays per-message estimated cost in the bubble footer.
import { formatCost } from './utils/formatCost';
// #471: stripMarkdown — regex-based plain text conversion for the "Copy as plain text" option.
import { stripMarkdown } from './utils/stripMarkdown';
// #294: resolveAccentCssColor is the shared single source of truth for accent
// color resolution — custom providers route through var(--accent-custom-{id})
// so AccentColorPicker live-session overrides are picked up at render time.
// Moved from a local function to modelColor.ts so InputBar.tsx can share it.
import { resolveAccentCssColor } from './utils/modelColor';
// #322: formatRelativeTime extracted to shared utility so ThreadRow and MessageBubble
// both use the same relative-time formatting logic without duplication.
import { formatRelativeTime } from './utils/timeFormat';
// #371: three-dot thinking indicator for the pre-response streaming state.
import { ThinkingIndicator } from './ThinkingIndicator';

/** Checkmark icon — 14×14 SVG, shown briefly after a successful copy. */
function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M2.5 7L5.5 10L11.5 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Pencil/edit icon — 14×14 SVG, consistent with other icon buttons in the app. */
function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Download arrow icon — 14×14 SVG, for the generated-image action bar below the image (#404).
 *  Matches the 14×14 size contract of CopyIcon and CheckIcon in this file.
 *  aria-hidden: parent button carries the accessible label.
 */
function ThumbnailDownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M7 2v7m0 0L4.5 6.5M7 9l2.5-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 10.5v.5a1 1 0 001 1h7a1 1 0 001-1v-.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface MessageBubbleProps {
  message: Message;
  modelConfig?: ModelConfig;
  /** Shown when the model returned an error for this message. */
  error?: ModelError;
  /** Called when the user clicks Retry on an errored bubble. Atlas wires the actual retry. */
  onRetry?: () => void;
  /**
   * Called when the user clicks "Go to Settings" on an auth_failure error bubble.
   * Opens the credentials/API key settings panel. Wired in AppLayout via
   * handleOpenProviderSettings. Distinct from onRetry — auth_failure directs the
   * user to fix their key rather than retrying the same request.
   * #545: Fixes the label/action mismatch where auth_failure called onRetry.
   */
  onOpenSettings?: () => void;
  /** Stagger index for bubble entrance animation delay (0-based). */
  entranceIndex?: number;
  /**
   * When provided, a "Reply to [Model]" affordance is shown on hover for assistant bubbles.
   * Called with the modelId of the model whose bubble was clicked.
   * Only rendered when the message is an assistant message with a known modelId.
   */
  onDirectedReply?: (modelId: ModelId) => void;
  /**
   * ModelConfig for the model this message was directed at (message.targetModelId).
   * When present, a subtle "→ [Model]" label is rendered below the message content.
   */
  targetModelConfig?: ModelConfig;
  /**
   * Controls token count rendering per UserPreferences.tokenCountVisibility:
   *   'always' — shown unconditionally on completed messages (no hover required)
   *   'active' — hover-reveal (default; opacity-0 at rest, opacity-100 on hover)
   *   'never'  — removed from DOM entirely (null return, not CSS hide)
   * Defaults to 'active' when omitted.
   */
  tokenCountVisibility?: TokenCountVisibility;
  /**
   * Called when the user clicks the edit button on a user message bubble.
   * Receives the message's index in the thread so App can truncate at that point.
   * Only provided for user message bubbles — omitting hides the edit button.
   */
  onEditMessage?: (messageIndex: number) => void;
  /**
   * The 0-based index of this message in the full messages array.
   * Required when onEditMessage is provided so the click handler can pass the
   * correct truncation index back to App.
   */
  messageIndex?: number;
}

/**
 * ImageCopyButton — copy-to-clipboard button for generated images (#402, #404).
 *
 * Manages its own copy state (idle / copied) locally so each image in a multi-strip
 * has independent feedback. PNG-only: callers must gate on mimeType before rendering.
 *
 * Uses the same CopyIcon as the nameplate text-copy button (#402) to unify icon
 * vocabulary between text and image copy actions.
 */
function ImageCopyButton({ img, copyLabel }: { img: GeneratedImage; copyLabel: string }) {
  const [imgCopyState, setImgCopyState] = useState<'idle' | 'copied'>('idle');

  const handleImgCopy = useCallback(async () => {
    if (imgCopyState !== 'idle') return;
    try {
      await copyImageToClipboard(img);
      setImgCopyState('copied');
      setTimeout(() => setImgCopyState('idle'), 1500);
    } catch {
      // Clipboard write failed (e.g. permission denied) — fail silently.
    }
  }, [img, imgCopyState]);

  return (
    <button
      type="button"
      aria-label={imgCopyState === 'copied' ? 'Copied!' : copyLabel}
      onClick={handleImgCopy}
      className={[
        'flex items-center min-h-[24px] gap-1 px-1.5 py-0.5 rounded text-[11px]',
        imgCopyState === 'copied'
          ? 'text-success'
          : 'text-text-secondary hover:text-text-primary hover:bg-hover',
        'transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
      ].join(' ')}
    >
      {imgCopyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
      <span aria-hidden="true">{imgCopyState === 'copied' ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}

/** Maps a ModelId to the data-model attribute value for streaming shimmer CSS targeting. */
function getModelDataAttr(modelId: string | undefined): string {
  return modelId ?? 'other';
}

// ─── Sanitize schema — extended for syntax highlighting ───────────────────────

/**
 * Extended rehype-sanitize schema for syntax highlighting (#359).
 *
 * rehype-highlight adds:
 *   - `hljs` and `language-*` className on `<code>` elements
 *   - `hljs-*` className on `<span>` elements wrapping individual tokens
 *
 * The default schema allows `language-*` on `code` via `/^language-./` but does
 * not allow the `hljs` base class or any class on `span` elements. We extend the
 * schema minimally: allow `hljs` on `code` and `hljs-*` on `span`.
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
  },
};

// #446: Restricted language map — same set as MarkdownContent for consistency.
const HIGHLIGHT_LANGUAGES: Record<string, unknown> = {
  javascript: hljs_javascript,
  typescript: hljs_typescript,
  python:     hljs_python,
  bash:       hljs_bash,
  shell:      hljs_shell,
  json:       hljs_json,
  css:        hljs_css,
  xml:        hljs_xml,
  html:       hljs_xml,
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

/** Shared rehype plugin array for the streaming ReactMarkdown instance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [
  [rehypeHighlight, { languages: HIGHLIGHT_LANGUAGES }],
  [rehypeSanitize, sanitizeSchema],
];

// ─── #452: StableMarkdown ──────────────────────────────────────────────────────
//
// The streaming path in MessageContent feeds an ever-growing stableContent string
// into ReactMarkdown. Without memoization, ReactMarkdown re-parses the entire
// stable portion on every streaming chunk — O(n) work per chunk, O(n²) total
// for a complete streaming response.
//
// Wrapping ReactMarkdown in React.memo means React bails out when stableContent
// hasn't changed (e.g. the parent re-renders for reasons unrelated to this
// streaming message, or between chunks where the stable boundary didn't advance).
// During active streaming the stable portion does grow each chunk, so the
// re-parse is still necessary — but peer bubbles and unrelated parent re-renders
// no longer pay the cost.
//
// A true AST cache would require react-markdown to expose its remark/rehype
// pipeline externally; that's not supported and the complexity isn't justified at
// typical AI response lengths (1–4 kB). The memo wrapper is the correct minimal fix.
const StableMarkdown = memo(function StableMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown rehypePlugins={rehypePlugins} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
});

// ─── Markdown component renderers ─────────────────────────────────────────────

/**
 * Custom renderers for react-markdown. All styles use registered Tailwind tokens.
 * Syntax highlighting via rehype-highlight — hljs-* classes on span tokens are
 * styled by the highlight.js theme imported in main.tsx.
 *
 * Links: external links open in a new tab with rel="noopener noreferrer" for
 * security. Color uses text-link — the semantic link token (colors.link → --prose-link)
 * shipped by Luma in #193, WCAG AA-compliant across all 7 themes. Underline provides the
 * non-color differentiator required by WCAG 1.4.1.
 */
const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  // Paragraphs: preserve existing body text sizing and line-height
  p({ children }) {
    return (
      <p className="text-[15px] font-normal leading-[1.6] text-text-primary mb-3 last:mb-0 break-words">
        {children}
      </p>
    );
  },
  // Headings: downshifted by 2 levels so model-generated # never produces <h1>/<h2>
  // inside <main> — preserves the page heading outline for screen readers (WCAG 1.3.1).
  // Visual sizing is preserved from the original scale; only the semantic element changes.
  h1({ children }) {
    return <h3 className="text-[18px] font-semibold leading-[1.4] text-text-primary mb-2 mt-3 first:mt-0">{children}</h3>;
  },
  h2({ children }) {
    return <h4 className="text-[16px] font-semibold leading-[1.4] text-text-primary mb-2 mt-3 first:mt-0">{children}</h4>;
  },
  h3({ children }) {
    return <h5 className="text-[15px] font-semibold leading-[1.4] text-text-primary mb-1.5 mt-2 first:mt-0">{children}</h5>;
  },
  h4({ children }) {
    return <h6 className="text-[14px] font-semibold leading-[1.4] text-text-secondary mb-1 mt-2 first:mt-0">{children}</h6>;
  },
  h5({ children }) {
    return <h6 className="text-[13px] font-semibold leading-[1.4] text-text-secondary mb-1 mt-1.5 first:mt-0">{children}</h6>;
  },
  h6({ children }) {
    return <h6 className="text-[12px] font-semibold leading-[1.4] text-text-muted mb-1 mt-1.5 first:mt-0">{children}</h6>;
  },
  // Emphasis
  strong({ children }) {
    return <strong className="font-semibold text-text-primary">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
  // Lists
  ul({ children }) {
    return <ul className="list-disc list-outside pl-5 mb-3 last:mb-0 space-y-1 text-[15px] leading-[1.6] text-text-primary">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-outside pl-5 mb-3 last:mb-0 space-y-1 text-[15px] leading-[1.6] text-text-primary">{children}</ol>;
  },
  li({ children }) {
    return <li className="text-text-primary break-words">{children}</li>;
  },
  // Links: external links open in new tab.
  // Color: text-link (colors.link → --prose-link) — the semantic link token shipped by Luma in #193.
  // WCAG AA-compliant across all 7 themes. Underline distinguishes links from
  // surrounding body text (WCAG 1.4.1 — non-color differentiator).
  a({ href, children }) {
    const isExternal = href?.startsWith('http') || href?.startsWith('//');
    return (
      <a
        href={href}
        {...(isExternal
          ? { target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className="text-link underline underline-offset-2 hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded-sm"
      >
        {children}
        {isExternal && <span className="sr-only"> (opens in new tab)</span>}
      </a>
    );
  },
  // Inline code + fenced code blocks.
  // For fenced blocks, rehype-highlight adds hljs and language-* classes to the
  // inner <code> element. className is passed through so the token colors take effect.
  // text-text-primary is intentionally omitted for block code — the hljs theme
  // CSS controls token colors via span.hljs-* selectors; a blanket foreground
  // color would conflict with individual token colors.
  code({ children, className, node }) {
    // Block detection: fenced code blocks always span multiple source lines
    // (opening fence + content + closing fence), so start.line !== end.line.
    // !!className alone misses fenced blocks with no language tag (className is
    // undefined for those), so we use position as the primary discriminator.
    const isBlock = node?.position?.start.line !== node?.position?.end.line;
    if (isBlock) {
      // Fenced block — pass className through so rehype-highlight's hljs-*
      // classes survive into the DOM for token coloring.
      return (
        <code className={['text-[13px] font-mono leading-[1.6] block overflow-x-auto', className].filter(Boolean).join(' ')}>
          {children}
        </code>
      );
    }
    // Inline code — design-system surface tokens, no syntax highlighting.
    return (
      <code className="bg-sidebar text-text-primary text-[13px] font-mono px-1 py-0.5 rounded-sm border border-border-subtle">
        {children}
      </code>
    );
  },
  // Code blocks: outer <pre> provides the surface background and rounded border.
  // rehype-highlight colours the inner <code> token spans via hljs-* classes.
  pre({ children }) {
    return (
      <pre className="bg-sidebar border border-border-subtle rounded-md px-4 py-3 mb-3 last:mb-0 overflow-x-auto">
        {children}
      </pre>
    );
  },
  // Blockquote — #431: match MarkdownContent.tsx spec (markdown-rendering.md §2.9):
  // border-l-[3px] border-blockquote prevents visual jump when streaming ends
  // and the done-state renderer (MarkdownContent) takes over.
  blockquote({ children }) {
    return (
      <blockquote className="border-l-[3px] border-blockquote pl-3 my-2 text-text-secondary italic">
        {children}
      </blockquote>
    );
  },
  // Horizontal rule
  hr() {
    return <hr className="border-border-subtle my-3" />;
  },
};

// ─── MessageContent ────────────────────────────────────────────────────────────

/**
 * Renders message content with markdown support for assistant messages.
 * User messages render as plain whitespace-preserving text — markdown in
 * user input is intentionally not parsed (user sees what they typed).
 *
 * XSS: rehypeSanitize removes all <script> tags, event handlers (onclick etc.),
 * and other unsafe HTML from model output. Model output is untrusted by default.
 *
 * Streaming: react-markdown re-parses on every render. This is fast enough for
 * streaming if we don't add debouncing complexity. No debounce is applied here;
 * revisit only if layout thrash is observed in practice.
 */
interface MessageContentProps {
  message: Message;
  isStreaming: boolean;
  hasError: boolean;
}

function MessageContent({ message, isStreaming, hasError }: MessageContentProps) {
  // #179 — chunk fade-in wiring.
  // Tracks the content length rendered at the end of the previous render cycle.
  // On each streaming render, text after this offset is "new" and gets wrapped in
  // a .chunk-entering span so the chunkFadeIn CSS animation fires. The ref is reset
  // to 0 when streaming ends so a subsequent stream on the same message component
  // (shouldn't happen in practice) starts fresh.
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      // Reset when streaming finishes so the ref doesn't carry stale state.
      prevLengthRef.current = 0;
    }
  }, [isStreaming]);

  const content = message.content ?? '';

  if (message.role === 'user') {
    // #418: User messages now render with markdown (MarkdownContent) for visual
    // consistency with model bubbles. Bold, italic, inline code, fenced blocks,
    // and links in user input are formatted, not shown as raw syntax.
    // User messages do not stream, so the chunk fade-in path is not needed here.
    return (
      <div className="break-words" aria-live="off">
        <MarkdownContent content={content} />
        {isStreaming && !hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>
    );
  }

  // When an error is present on a non-streaming message and the content is either:
  //   - the synthesized sentinel 'Error' (set by useStreamingMessages guard path when no
  //     priming chunk created an accumulator entry), OR
  //   - an empty string '' (the normal error path: emitErrorChunk priming chunk sets
  //     content:'' on the accumulator; final done chunk carries the error but no text)
  // …suppress the body text entirely. The error section in MessageBubble already
  // renders the full error detail via error.message.
  // Real partial-content + error messages (where the model streamed real text
  // before erroring) have non-empty, non-sentinel content and are NOT suppressed here.
  if (hasError && !isStreaming && (content === 'Error' || content === '')) {
    return null;
  }

  // Assistant messages: render with react-markdown + rehype-sanitize.
  // During streaming, split at prevLengthRef.current:
  //   stableContent — already-seen text, rendered via ReactMarkdown
  //   newChunk      — text that arrived this render, wrapped in .chunk-entering
  //
  // The new chunk is rendered as plain text during the ~100ms fade-in animation.
  // On the following render it becomes part of stableContent and is markdown-rendered.
  // This brief plain-text window is imperceptible during active streaming and is the
  // accepted trade-off for the Aria-only approach (no Atlas changes required).
  if (isStreaming) {
    const stableContent = content.slice(0, prevLengthRef.current);
    const newChunk = content.slice(prevLengthRef.current);
    // Capture offset before advancing — used as key so React unmounts/remounts
    // the span on each chunk, re-triggering the chunkFadeIn CSS animation.
    const chunkKey = prevLengthRef.current;

    // Advance the ref synchronously before React commits. Using a ref (not state)
    // avoids a re-render cycle; the value is read on the next render.
    prevLengthRef.current = content.length;

    return (
      <div
        className="text-[15px] font-normal leading-[1.6] text-text-primary break-words"
        aria-live="polite"
        aria-atomic="false"
      >
        {/* #452: StableMarkdown bails out via React.memo when stableContent
            is unchanged — avoids re-parsing the full stable portion on every
            peer-model streaming chunk or unrelated parent re-render. */}
        {stableContent && (
          <StableMarkdown content={stableContent} />
        )}
        {newChunk && (
          <span key={chunkKey} className="chunk-entering whitespace-pre-wrap">
            {newChunk}
          </span>
        )}
        {!hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>
    );
  }

  // Streaming done (or never streaming) — render full content via spec-compliant MarkdownContent.
  // #409: MarkdownContent applies DOMPurify pre-sanitization, remark-gfm, copy-code button,
  // and all Luma token classes per markdown-rendering.md. The outer div preserves the
  // existing break-words layout constraint while MarkdownContent handles prose styling.
  return (
    <div
      className="break-words"
      aria-live="off"
    >
      <MarkdownContent content={content} />
    </div>
  );
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

/**
 * #448 — Custom memo comparator for MessageBubble.
 *
 * A bubble is stable when:
 *   - message.id is the same (same message, not a replacement)
 *   - message.content hasn't changed
 *   - message.isStreaming hasn't changed
 *   - message.tokenUsage reference hasn't changed (deep equality would be costly;
 *     Atlas replaces the tokenUsage object when it arrives, so reference change
 *     is the correct signal)
 *   - message.error reference hasn't changed
 *   - modelConfig reference hasn't changed (only changes on conversation switch)
 *   - targetModelConfig reference hasn't changed
 *   - tokenCountVisibility hasn't changed
 *   - entranceIndex hasn't changed
 *
 * Callbacks (onRetry, onDirectedReply, onEditMessage) are intentionally excluded
 * from the comparison. They don't affect the rendered output — only what happens
 * on user interaction. MessageThread wraps onRetry in an inline lambda per message,
 * which is re-created on every parent render; including it in the comparison would
 * defeat the memo entirely. The callbacks are always fresh when called (closure
 * over current state), so stale-callback risk is not a concern here.
 *
 * messageIndex is also excluded: it only affects the value passed to onEditMessage,
 * not any rendered output.
 */
function areBubblePropsEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.message.id          === next.message.id          &&
    prev.message.content     === next.message.content     &&
    prev.message.isStreaming  === next.message.isStreaming  &&
    prev.message.tokenUsage  === next.message.tokenUsage  &&
    prev.message.error       === next.message.error       &&
    prev.modelConfig         === next.modelConfig         &&
    prev.targetModelConfig   === next.targetModelConfig   &&
    prev.tokenCountVisibility === next.tokenCountVisibility &&
    prev.entranceIndex       === next.entranceIndex
  );
}

function MessageBubbleBase({
  message,
  modelConfig,
  error,
  onRetry,
  onOpenSettings,
  entranceIndex = 0,
  onDirectedReply,
  targetModelConfig,
  tokenCountVisibility = 'active',
  onEditMessage,
  messageIndex,
}: MessageBubbleProps) {
  const isStreaming = message.isStreaming ?? false;
  const hasError    = !!error;
  // Token count and directed-reply affordance are hidden by default; revealed on hover.
  const [isHovered, setIsHovered] = useState(false);
  // Copy-to-clipboard state: 'idle' | 'copied'. Reverts to 'idle' after 1.5s.
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  // #471: Copy dropdown state — tracks which copy option was last used and whether
  // the dropdown is open. 'markdown' is the default (preserves existing muscle memory).
  const [copyDropdownOpen, setCopyDropdownOpen] = useState(false);
  // #523: chevronRef tracks the chevron button for portal dropdown positioning.
  // portalDropdownRef tracks the portaled dropdown div for click-outside detection.
  // Both refs are needed since the dropdown renders in document.body (escaping overflow:hidden).
  // #523 follow-up: firstDropdownButtonRef receives focus when the dropdown opens
  // (WCAG 2.4.3 Focus Order — keyboard users can Tab through both options).
  const copyDropdownRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);
  const portalDropdownRef = useRef<HTMLDivElement>(null);
  const firstDropdownButtonRef = useRef<HTMLButtonElement>(null);
  // #523: dropdown position — computed from chevron button's bounding rect when opened.
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  // #400 — Timestamp refresh on interaction.
  // A simple counter bumped on mouseenter forces useMemo to recompute the formatted time.
  // No background interval needed — recalculation happens when the user hovers the bubble.
  const [hoverTick, setHoverTick] = useState(0);

  // ── Lightbox state (#369) ─────────────────────────────────────────────────
  // Tracks which attachment (if any) is open in the full-size lightbox.
  // null = closed. Non-null = the Attachment whose thumbnail was clicked.
  // lightboxReturnRef: the trigger button that opened the lightbox — focus is
  // restored here when the lightbox closes (WCAG 2.4.3).
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);
  const lightboxReturnRef = useRef<HTMLElement | null>(null);

  // ── Generated-image lightbox state (#380) ────────────────────────────────
  // Tracks which generated image index (if any) is open in the full-size lightbox.
  // null = closed. Non-null = the index into message.generatedImages[].
  // generatedImageLightboxReturnRef: trigger button for focus restoration on close.
  const [lightboxGeneratedImageIdx, setLightboxGeneratedImageIdx] = useState<number | null>(null);
  const generatedImageLightboxReturnRef = useRef<HTMLElement | null>(null);

  // ─── Thinking indicator state (#371) ─────────────────────────────────────
  // ThinkingIndicator and MessageContent are mutually exclusive in the body zone.
  // Render condition: assistant bubble, streaming, no content yet.
  // Transition-out: 100ms opacity fade before unmount (instant under reduced-motion).
  //
  // isThinkingCondition: the raw derived boolean — true while we should be showing dots.
  // thinkingMounted: whether ThinkingIndicator is in the DOM (trails isThinkingCondition
  //   by up to 100ms for the fade-out, then snaps to false).
  // thinkingFading: true only during the 100ms fade window; drives the opacity-0 class.
  const isThinkingCondition = message.role === 'assistant' && isStreaming && (message.content ?? '') === '';
  const [thinkingMounted, setThinkingMounted] = useState(() => isThinkingCondition);
  const [thinkingFading, setThinkingFading] = useState(false);

  useEffect(() => {
    if (isThinkingCondition) {
      // Condition became true (re-used bubble or mount) — ensure indicator is shown.
      setThinkingMounted(true);
      setThinkingFading(false);
    } else if (thinkingMounted && !thinkingFading) {
      // Condition just became false and we're not already fading — start fade.
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        // Instant swap per spec: same render tick, no delay.
        setThinkingMounted(false);
      } else {
        // 100ms opacity fade then unmount (CSS transition-opacity duration-fast ease-out).
        setThinkingFading(true);
        const timer = setTimeout(() => {
          setThinkingMounted(false);
          setThinkingFading(false);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isThinkingCondition, thinkingMounted, thinkingFading]);

  const handleCopy = useCallback(() => {
    if (copyState === 'copied') return;
    // For error-only messages (content is empty or the 'Error' sentinel), copy the
    // error message text instead so users can share or report the error (#396).
    const hasUsableContent = message.content && message.content !== 'Error';
    const textToCopy = hasUsableContent ? message.content : (error?.message ?? '');
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    }).catch(() => {
      // Clipboard write failed (e.g. insecure context) — fail silently.
    });
  }, [message.content, error?.message, copyState]);

  // #471: Copy as plain text — strips markdown syntax before writing to clipboard.
  const handleCopyPlainText = useCallback(() => {
    if (copyState === 'copied') return;
    const hasUsableContent = message.content && message.content !== 'Error';
    const textToCopy = hasUsableContent ? stripMarkdown(message.content) : (error?.message ?? '');
    if (!textToCopy) return;
    setCopyDropdownOpen(false);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    }).catch(() => {
      // Clipboard write failed — fail silently.
    });
  }, [message.content, error?.message, copyState]);

  // #471/#523: Close the copy dropdown when clicking outside it or pressing Escape.
  // Escape is the standard ARIA menu close key; it also moves focus back to the
  // chevron trigger (WCAG 2.4.3 Focus Order).
  // #523: The dropdown now renders in a portal — use portalDropdownRef (the portaled
  // div) and the outer copyDropdownRef wrapper for click-outside detection.
  useEffect(() => {
    if (!copyDropdownOpen) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Close if click is outside both the trigger wrapper and the portaled dropdown.
      const outsideWrapper = !copyDropdownRef.current?.contains(target);
      const outsidePortal = !portalDropdownRef.current?.contains(target);
      if (outsideWrapper && outsidePortal) {
        setCopyDropdownOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setCopyDropdownOpen(false);
        // Return focus to the chevron trigger via chevronRef (#523: no longer
        // navigating the DOM tree since the dropdown is portaled out).
        chevronRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [copyDropdownOpen]);

  // #523 follow-up: Move focus to the first dropdown button when the dropdown opens.
  // Without this, focus remains on the chevron and keyboard users cannot reach the
  // portal buttons (they render in document.body, outside the normal Tab order).
  useEffect(() => {
    if (copyDropdownOpen) {
      firstDropdownButtonRef.current?.focus();
    }
  }, [copyDropdownOpen]);

  // Entrance animation stagger via inline style
  const entranceDelay = `${entranceIndex * 100}ms`;

  // Resolve accent color for this model — used for both the nameplate (--bubble-accent)
  // and any directed-reply button color.
  const accentColor = modelConfig?.color ?? 'accent-other';

  // #400 — Memoized relative timestamp, recomputed on each hover interaction.
  // hoverTick is not referenced inside the callback — it's included in the dep array
  // intentionally to force recomputation when the user hovers, refreshing the
  // displayed time if it has become stale. This is a deliberate invalidation pattern.
  /* eslint-disable react-hooks/exhaustive-deps */
  const relativeTimestamp = useMemo(
    () => formatRelativeTime(message.timestamp),
    [message.timestamp, hoverTick],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

  // #401 — Token count: shown only when:
  //   1. Visibility preference is not 'never', AND
  //   2. tokenUsage is present on the message.
  //
  // Image-generation messages (OpenAI Images API) return no token usage data, so
  // message.tokenUsage will be absent. The row is hidden entirely in that case
  // rather than rendering empty fields — the `!!message.tokenUsage` guard handles this.
  // Text model messages with tokenUsage continue to render normally.
  const showTokenCount = tokenCountVisibility !== 'never' && !!message.tokenUsage;

  // Row opacity: 'always' → always visible; 'active'/'never' → hover-controlled.
  const rowVisible = tokenCountVisibility === 'always' ? true : isHovered;

  // ─── Nameplate copy button factory ──────────────────────────────────────
  // Returns a split copy button styled for nameplate flow (not absolute-positioned).
  // Used in both assistant and user nameplates.
  // additionalClassName: pass 'ml-4' on the first button after a name/dot to add breathing room.
  //
  // #471: Split-button pattern — single click copies markdown (existing default behaviour);
  // the small chevron button opens a 2-item dropdown with "Markdown" and "Plain text" options.
  //
  // #523: The dropdown is rendered via createPortal into document.body so it escapes the
  // bubble wrapper's overflow:hidden boundary. Position is computed from the chevron button's
  // bounding rect each time the dropdown opens. chevronRef → position; portalDropdownRef →
  // click-outside detection (both needed since the dropdown is a DOM sibling of body, not
  // a descendant of the bubble).

  function NameplateCopyButton({ additionalClassName = '' }: { additionalClassName?: string }) {
    // Show copy button when there is usable content OR when there is an error message
    // to copy. For error-only messages (content is '' or the sentinel 'Error'),
    // the button copies error.message so users can share or report the error (#396).
    const hasUsableContent = message.content && message.content !== 'Error';
    const hasCopyableText = hasUsableContent || (hasError && !!error?.message);
    // Plain text copy only available for markdown content (not error messages).
    const hasMarkdownContent = hasUsableContent;
    if (!hasCopyableText) return null;

    const visibilityClass = isHovered || copyState === 'copied' || copyDropdownOpen
      ? 'opacity-100'
      : 'opacity-0 focus-visible:opacity-100 focus-within:opacity-100';

    // #523: Compute and store dropdown position from the chevron's bounding rect.
    const handleChevronClick = () => {
      if (copyDropdownOpen) {
        setCopyDropdownOpen(false);
        setDropdownPos(null);
      } else {
        if (chevronRef.current) {
          const rect = chevronRef.current.getBoundingClientRect();
          // Position the dropdown above the chevron (bottom-full pattern), right-aligned.
          setDropdownPos({ top: rect.top + window.scrollY, left: rect.right });
        }
        setCopyDropdownOpen(true);
      }
    };

    // #523: Portal dropdown rendered in document.body with fixed positioning.
    const portalDropdown = copyDropdownOpen && dropdownPos
      ? createPortal(
          // #523 follow-up: role="menu" removed — it requires Arrow-key navigation per
          // WAI-ARIA APG §3.15 which these plain buttons don't implement. Plain buttons
          // in DOM order are sufficient; Tab reaches them via firstDropdownButtonRef focus
          // on open (see useEffect above). aria-label retained for screen reader context.
          <div
            ref={portalDropdownRef}
            aria-label="Copy options"
            style={{
              position: 'fixed',
              // Place above the chevron: compute top from rect.top minus dropdown height.
              // We don't know the height until render, so use a translateY trick instead:
              // anchor to the chevron's top and shift up via transform.
              top: dropdownPos.top,
              left: dropdownPos.left,
              transform: 'translate(-100%, -100%)',
              zIndex: 9999,
            }}
            className={[
              'min-w-[148px] py-1 rounded-md',
              'bg-card border border-border shadow-md',
              'text-[12px]',
            ].join(' ')}
          >
            <button
              ref={firstDropdownButtonRef}
              type="button"
              onClick={() => { setCopyDropdownOpen(false); setDropdownPos(null); handleCopy(); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              Copy as markdown
            </button>
            <button
              type="button"
              onClick={() => { handleCopyPlainText(); setDropdownPos(null); }}
              className="w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              Copy as plain text
            </button>
          </div>,
          document.body,
        )
      : null;

    return (
      // Wrapper div: ref for click-outside detection of the trigger area.
      <div
        ref={copyDropdownRef}
        className={[additionalClassName, 'relative flex items-center', visibilityClass, 'transition-opacity duration-fast'].join(' ')}
      >
        {/* Primary copy button — copies markdown (default behaviour) */}
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyState === 'copied' ? 'Copied!' : 'Copy message as markdown'}
          className={[
            'w-6 h-6 rounded-l flex items-center justify-center shrink-0',
            'text-text-secondary',
            copyState === 'copied'
              ? 'text-success'
              : 'hover:bg-hover hover:text-text-primary',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
          ].join(' ')}
        >
          {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
        </button>

        {/* Chevron dropdown trigger — only shown when markdown content is available.
            For error-only messages, there is no meaningful distinction between
            markdown and plain text, so the secondary trigger is suppressed.
            #523: ref={chevronRef} enables getBoundingClientRect() for portal positioning. */}
        {hasMarkdownContent && (
          <button
            ref={chevronRef}
            type="button"
            aria-label="More copy options"
            aria-expanded={copyDropdownOpen}
            aria-haspopup="true"
            onClick={handleChevronClick}
            className={[
              'w-6 h-6 rounded-r flex items-center justify-center shrink-0',
              'text-text-secondary hover:bg-hover hover:text-text-primary',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            {/* Tiny downward chevron — 8×5 px */}
            <svg width="8" height="5" viewBox="0 0 8 5" fill="none" aria-hidden="true">
              <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* #523: Portal dropdown rendered into document.body — escapes overflow:hidden */}
        {portalDropdown}
      </div>
    );
  }

  // ─── Assistant (model) bubble — nameplate design (#322) ──────────────────
  //
  // Structure:
  //   outer container (relative, --bubble-accent, bubble-entering, drop-shadow, hover listeners)
  //   ├── tail (absolute, left side, points left ◄, CSS border trick)
  //   └── wrapper (rounded-[12px] overflow-hidden — no shadow, shadow is on outer container)
  //       ├── nameplate zone (28px, tinted background)
  //       │   ├── model color dot
  //       │   ├── [error] warning icon
  //       │   ├── model name label (truncate min-w-0)
  //       │   ├── copy button (in flow, opacity-0 at rest, ml-4 spacer)
  //       │   └── timestamp (ml-auto, right-aligned)
  //       └── body zone (bg-card, message content + error + bottom row)
  //
  // The tail MUST be a sibling of the wrapper — not a child.
  // The wrapper's overflow:hidden would clip a child that protrudes left.
  // --bubble-accent is on the outer container so the tail can inherit it.
  // drop-shadow on outer container follows rendered pixel shape including the tail.

  if (message.role === 'assistant') {
    // Directed-reply affordance — available on completed assistant bubbles with known modelId.
    const canDirectReply =
      !!onDirectedReply &&
      !!message.modelId &&
      !isStreaming;

    const showBottomRow = !isStreaming && (canDirectReply || showTokenCount);

    return (
      <div
        className={[
          'relative max-w-[85%] self-start',
          'bubble-entering',
          // Fix #322: drop-shadow on outer container so the tail triangle is included
          // in the shadow shape. box-shadow on the inner wrapper (which has overflow:hidden)
          // left the tail unshadowed. filter:drop-shadow() follows rendered pixel shape.
          // Polish2: bumped to drop-shadow (one step up from drop-shadow-sm) for better visibility.
          'drop-shadow hover:drop-shadow-md transition-[filter] duration-fast',
        ].join(' ')}
        style={{
          animationDelay: entranceDelay,
          '--bubble-accent': resolveAccentCssColor(accentColor, modelConfig?.modelId),
        } as React.CSSProperties}
        onMouseEnter={() => { setIsHovered(true); setHoverTick((t) => t + 1); }}
        onMouseLeave={() => setIsHovered(false)}
        aria-busy={isStreaming ? true : undefined}
      >
        {/* Tail — left side, points left ◄.
            Sibling of wrapper (not child) so overflow:hidden on wrapper does not clip it.
            Positioned absolutely relative to outer container (bottom-[12px] = near bottom of bubble).
            aria-hidden: purely decorative shape, no semantic content. */}
        <div
          className="absolute left-0 bottom-[12px] -translate-x-full w-0 h-0"
          aria-hidden="true"
          style={{
            borderRight: '8px solid var(--surface-card)',
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
          }}
        />

        {/* Bubble wrapper — overflow:hidden clips nameplate tint at rounded corners.
            Shadow moved to outer container (drop-shadow) so the tail sibling is also shadowed.
            streaming-shimmer + data-model on wrapper so the ::after shimmer bar
            renders at the correct bottom edge of the card (not the outer container). */}
        <div
          className={[
            'relative rounded-[12px] overflow-hidden',
            isStreaming ? 'streaming-shimmer' : '',
          ].join(' ')}
          data-model={getModelDataAttr(message.modelId)}
        >

        {/* ── Nameplate zone ─────────────────────────────────────────────────
            28px fixed-height strip at the top of the card. Background is a
            var(--nameplate-tint) blend of the model's accent color into the card surface
            (16% light themes, 18% dark themes — set by applyTheme() per theme.mode).
            In error state the accent tint is replaced by a 12% semantic-error tint.
            color-mix() graceful degradation: unsupported browsers (<Chrome 111) see
            bg-card (untinted) — identity is not lost, only the tint. */}
        <div
          className={[
            'h-[28px] px-4 flex items-center gap-2',
            hasError
              ? 'bg-[color-mix(in_srgb,var(--semantic-error)_12%,var(--surface-card))]'
              : 'bg-[color-mix(in_srgb,var(--bubble-accent)_var(--nameplate-tint),var(--surface-card))]',
          ].join(' ')}
        >
          {/* Model color dot — inherits --bubble-accent from wrapper */}
          <span
            className="w-[7px] h-[7px] rounded-full bg-[var(--bubble-accent)] shrink-0"
            aria-hidden="true"
          />

          {/* Error icon — error state only, between dot and model name.
              #463: Three variants keyed on error.code — each communicates
              a distinct tone: key = auth problem, clock = rate limit (wait),
              wifi-off = connectivity issue. Fallback: ⚠ for unknown codes. */}
          {hasError && (
            <span aria-hidden="true" className="text-error shrink-0 flex items-center">
              {error!.code === 'auth_failure' && <KeyIcon size={13} />}
              {error!.code === 'rate_limit'   && <ClockIcon size={13} />}
              {error!.code === 'network_error' && <WifiOffIcon size={13} />}
              {!['auth_failure', 'rate_limit', 'network_error'].includes(error!.code) && (
                <span className="text-[12px] select-none leading-none">&#9888;</span>
              )}
            </span>
          )}

          {/* Model name label — uppercase, semibold, secondary color.
              min-w-0 enables truncation in flex context (flex items default to min-w: auto
              which prevents overflow from triggering ellipsis). truncate handles the rest.
              In error state the label switches to semantic-error color. */}
          <span
            className={[
              'text-[12px] font-semibold uppercase tracking-[0.04em] truncate min-w-0',
              hasError ? 'text-error' : 'text-text-secondary',
            ].join(' ')}
          >
            {modelConfig?.name ?? message.modelId ?? 'Model'}
          </span>

          {/* Routing label (#382) — shown when this assistant message was a directed-reply
              response. "→ ModelName" rendered in text-muted at 11px per Luma spec
              (at-mention.md §Routing indicator spec). Position: after model name label,
              before the ml-auto right group. Inherits gap-2 from the flex row.
              The → glyph is decorative (aria-hidden); "Directed to X" framing is via
              sr-only text so screen readers announce the routing context cleanly.
              Note: targetModelConfig here is the model that was @mentioned by the user,
              which is the same model rendering this bubble (i.e. message.modelId). We
              show its display name rather than re-deriving it from modelConfig to be
              explicit about the data source. */}
          {targetModelConfig && (
            <span className="text-[11px] font-normal text-text-muted shrink-0 flex items-center gap-0.5">
              <span aria-hidden="true">→</span>
              <span className="sr-only">Directed to</span>
              <span>{targetModelConfig.name}</span>
            </span>
          )}

          {/* Right group: copy + timestamp — always flush-right as a unit.
              ml-auto on the group pushes everything right; gap-2 spaces copy from timestamp.
              This keeps the copy button at a consistent position regardless of name length. */}
          <div className="ml-auto flex items-center gap-2">
            <NameplateCopyButton />
            {/* #400: relativeTimestamp is recomputed on mouseenter (hoverTick) so stale values refresh on interaction. */}
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-[11px] text-text-muted shrink-0"
            >
              {relativeTimestamp}
            </time>
          </div>
        </div>

        {/* ── Body zone ──────────────────────────────────────────────────────
            Untinted bg-card surface below the nameplate. Contains message content,
            error detail, and the token count / directed-reply bottom row. */}
        <div className="px-4 pt-2 pb-3 bg-card">
          {/* Thinking indicator / message content — mutually exclusive (#371).
              ThinkingIndicator is shown while streaming with no content yet.
              thinkingMounted trails the condition by up to 100ms for the fade-out.
              thinkingFading drives the opacity-0 transition class during that window. */}
          {thinkingMounted ? (
            <div
              className={thinkingFading ? 'opacity-0 transition-opacity duration-fast ease-out' : ''}
            >
              <ThinkingIndicator modelName={modelConfig?.name ?? 'Assistant'} />
            </div>
          ) : (
            /* Message content — markdown-rendered via MessageContent.
               aria-live/aria-atomic handling is encapsulated in MessageContent. */
            <MessageContent
              message={message}
              isStreaming={isStreaming}
              hasError={hasError}
            />
          )}

          {/* Generated image strip — rendered below message text when the model returned images.
              Position: between MessageContent and the error detail / bottom row.
              Condition: non-empty generatedImages array (safe during and after streaming —
              images accumulate onto the message as chunks arrive via useStreamingMessages).
              src: data-URL constructed here — base64 field per GeneratedImage contract has no
              data-URL prefix (matches Attachment.base64 convention; Atlas strips any prefix).
              alt: uses model-supplied altText when present. When absent: a numbered fallback
              for multi-image strips so each is individually labeled (WCAG 2.1 AA — never empty).
              width/height hints: prevent layout shift when the provider supplies dimensions.
              Single image: max-w-full max-h-[280px] object-contain — preserves aspect ratio.
              Multiple images: 140×140 object-cover thumbnails — consistent grid, prevents
              tall images from dominating the thread.
              #380: each image is wrapped in a <button> that opens the Lightbox (same pattern
              as attachment thumbnails in #369). Focus returns to trigger on close.

              #403: Top margin (mt-2) is applied only when the message has visible text content
              preceding the image strip. When the model returned only an image (empty or blank
              content), no preceding text element is rendered and `mt-2` would add unwanted
              whitespace above the first image. The guard is `message.content?.trim()` —
              safe to evaluate before the image strip because MessageContent returns null for
              empty/blank content, leaving no sibling above the strip.

              #404: Download and copy (PNG-only) controls are rendered as persistent buttons
              below each image, replacing the previous hover overlay. This improves
              discoverability especially for small images and resolves the keyboard
              accessibility gap (controls are now always in the Tab order). The image itself
              remains clickable to open the lightbox.

              #402: The copy icon below the image uses the same CopyIcon component as the
              text copy button in the nameplate — unified across text and image actions. */}
          {message.generatedImages && message.generatedImages.length > 0 && (
            <div
              role="group"
              aria-label="Model-generated images"
              className={[
                'flex flex-wrap gap-3',
                message.content?.trim() ? 'mt-2' : '',
              ].join(' ')}
            >
              {message.generatedImages.map((img, idx) => {
                const imgSrc = `data:${img.mimeType};base64,${img.base64}`;
                const totalImages = message.generatedImages!.length;
                const imgAlt = img.altText
                  ? img.altText
                  : totalImages > 1
                    ? `Generated image ${idx + 1}`
                    : 'Model-generated image';
                const triggerLabel = img.altText
                  ? `View full size: ${img.altText}`
                  : totalImages > 1
                    ? `View full size: Generated image ${idx + 1}`
                    : 'View full size: Model-generated image';
                const isSingle = totalImages === 1;

                // ── Download button aria-label (#390 spec) ───────────────────
                // Four variants based on altText presence and single vs. multi-strip:
                //   "Download generated image"                          // no alt, single
                //   "Download: {altText}"                               // alt, single (~60 chars)
                //   "Download generated image {n} of {total}"          // no alt, multi
                //   "Download: {altText} (image {n} of {total})"       // alt, multi
                const downloadLabel = (() => {
                  const altSnippet = img.altText?.slice(0, 60);
                  if (altSnippet && totalImages > 1) {
                    return `Download: ${altSnippet} (image ${idx + 1} of ${totalImages})`;
                  }
                  if (altSnippet) return `Download: ${altSnippet}`;
                  if (totalImages > 1) return `Download generated image ${idx + 1} of ${totalImages}`;
                  return 'Download generated image';
                })();

                // ── Copy button aria-label ────────────────────────────────────
                // Mirrors the download label pattern but prefixed with "Copy".
                // Copy is only offered for PNG images (ClipboardItem JPEG/WebP support
                // is inconsistent across browsers).
                const copyLabel = (() => {
                  const altSnippet = img.altText?.slice(0, 60);
                  if (altSnippet && totalImages > 1) {
                    return `Copy: ${altSnippet} (image ${idx + 1} of ${totalImages})`;
                  }
                  if (altSnippet) return `Copy: ${altSnippet}`;
                  if (totalImages > 1) return `Copy generated image ${idx + 1} of ${totalImages}`;
                  return 'Copy generated image';
                })();

                // ── altText tooltip via aria-describedby (#390 spec) ────────
                // Visually hidden span with truncated alt text (max 120 chars).
                // Points thumbnail trigger button's aria-describedby at this span.
                // Only rendered when altText is present. Never uses title attribute.
                const tooltipId = img.altText ? `gen-img-tooltip-${img.id}` : undefined;

                // Whether to show copy button — only for PNG images.
                const showImgCopy = img.mimeType === 'image/png';

                return (
                  // Thumbnail wrapper: `relative` allows positioning descendants.
                  // #404: No longer uses `group` for hover overlay — controls are
                  // now persistent below the image and always in the Tab order.
                  <div
                    key={img.id}
                    className={[
                      isSingle ? 'block' : 'flex-shrink-0',
                    ].join(' ')}
                  >
                    {/* Visually hidden tooltip span (#390) — aria-describedby target.
                        sr-only keeps it out of the visual layout; screen readers
                        announce it as supplementary description on the trigger button.
                        Only rendered when altText is present on this image.
                        Never uses title attribute — unreliable with screen readers. */}
                    {tooltipId && (
                      <span id={tooltipId} className="sr-only">
                        {img.altText!.slice(0, 120)}
                      </span>
                    )}

                    {/* Lightbox trigger button — whole thumbnail is the zoom trigger.
                        aria-describedby: points at the hidden altText span when present,
                        giving screen readers additional context beyond the aria-label. */}
                    <button
                      type="button"
                      aria-label={triggerLabel}
                      {...(tooltipId ? { 'aria-describedby': tooltipId } : {})}
                      onClick={(e) => {
                        generatedImageLightboxReturnRef.current = e.currentTarget;
                        setLightboxGeneratedImageIdx(idx);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          generatedImageLightboxReturnRef.current = e.currentTarget;
                          setLightboxGeneratedImageIdx(idx);
                        }
                      }}
                      className={[
                        'block rounded overflow-hidden cursor-zoom-in',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                      ].join(' ')}
                    >
                      <img
                        src={imgSrc}
                        alt={imgAlt}
                        width={img.width}
                        height={img.height}
                        className={
                          isSingle
                            ? 'max-w-full max-h-[280px] rounded object-contain'
                            : 'w-[140px] h-[140px] rounded object-cover'
                        }
                      />
                    </button>

                    {/* #404 — Persistent action bar below the image.
                        Download and copy (PNG-only) buttons rendered as always-visible
                        controls beneath the image, replacing the previous hover overlay.
                        This improves discoverability and resolves the keyboard
                        accessibility gap — buttons are always in the Tab order.
                        #402 — Copy uses CopyIcon (same as text-copy nameplate button)
                        to unify icon vocabulary across text and image actions.
                        Layout: flex row, left-aligned, gap-1 between buttons.
                        Token contract: text-text-secondary / hover:text-text-primary /
                        hover:bg-hover — all established tokens, no novel color choices. */}
                    <div className="mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={downloadLabel}
                        onClick={() => downloadImage(img)}
                        className={[
                          'flex items-center min-h-[24px] gap-1 px-1.5 py-0.5 rounded text-[11px]',
                          'text-text-secondary hover:text-text-primary hover:bg-hover',
                          'transition-colors duration-fast',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                        ].join(' ')}
                      >
                        <ThumbnailDownloadIcon />
                        <span aria-hidden="true">Download</span>
                      </button>

                      {showImgCopy && (
                        <ImageCopyButton img={img} copyLabel={copyLabel} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Generated-image Lightbox (#380) — portal to document.body when open.
              Only one generated image can be open at a time. Focus is trapped inside
              the dialog and restored to the trigger button on close (WCAG 2.4.3).
              Inline base64 is the only copy — no external URL fallback.
              filename={lightboxAlt}: propagates alt text into the dialog aria-label
              so screen readers announce "Full size: {description}" rather than the
              generic "Full size image" fallback. */}
          {lightboxGeneratedImageIdx !== null && message.generatedImages?.[lightboxGeneratedImageIdx] && (() => {
            const img = message.generatedImages![lightboxGeneratedImageIdx];
            const totalImages = message.generatedImages!.length;
            const lightboxAlt = img.altText
              ? img.altText
              : totalImages > 1
                ? `Generated image ${lightboxGeneratedImageIdx + 1}`
                : 'Model-generated image';
            return (
              // #390: generatedImage prop enables download/copy/info controls in the lightbox.
              // imageIndex and imageTotal provide context for the download button aria-label
              // in multi-image strips (spec: "Download generated image {n} of {total}").
              <Lightbox
                src={`data:${img.mimeType};base64,${img.base64}`}
                alt={lightboxAlt}
                filename={lightboxAlt}
                onClose={() => setLightboxGeneratedImageIdx(null)}
                returnFocusRef={generatedImageLightboxReturnRef as React.RefObject<HTMLElement | null>}
                generatedImage={img}
                imageIndex={lightboxGeneratedImageIdx}
                imageTotal={totalImages}
              />
            );
          })()}

          {/* Error detail — rendered in the body zone below any partial content.
              The divider (border-t) is only shown when there is visible body content.
              When content is the synthesized sentinel 'Error' or empty '', MessageContent
              returns null and no body is rendered — so the divider is suppressed.
              The error icon is in the nameplate; the body shows a code-specific message.
              role="alert": announces the error to screen readers when the element mounts
              (WCAG 4.1.3 Status Messages). Fires assertively without requiring focus —
              a user who was not watching the streaming bubble still hears the failure.
              #463: Three differentiated tones — auth (directive), rate-limit (informational),
              network (reassuring). The raw error.message is retained as the sr-only detail
              so screen reader users still get the specific provider error text. */}
          {hasError && (() => {
            const code = error!.code;
            // Human-readable summaries per tone spec (#463).
            const summaryMap: Record<string, string> = {
              auth_failure:  'Check your API key',
              rate_limit:    'Rate limited — try again in a moment',
              network_error: 'Connection issue — Retry when ready',
            };
            const summary = summaryMap[code] ?? `Error: ${error!.message}`;
            // Retry button label varies by error type.
            // retryLabel is used for rate_limit and network_error only.
            // auth_failure now calls onOpenSettings with a hardcoded "Go to Settings" label (#545).
            const retryLabel = 'Retry';
            const hasDivider = message.content && message.content !== 'Error';
            return (
              <div
                role="alert"
                className={hasDivider ? 'mt-3 pt-2 border-t border-border-subtle' : 'mt-1'}
              >
                <p className="text-[13px] text-error italic">
                  {summary}
                </p>
                {/* sr-only: expose the raw provider error message to screen readers
                    without showing the technical detail visually for transient errors. */}
                {summary !== `Error: ${error!.message}` && (
                  <span className="sr-only">{error!.message}</span>
                )}
                {/* #545: auth_failure uses onOpenSettings to open the credentials panel;
                    rate_limit and network_error use onRetry for the normal retry flow.
                    Each button only renders when its respective callback is provided. */}
                {error!.code === 'auth_failure' ? (
                  onOpenSettings && (
                    <button
                      type="button"
                      onClick={onOpenSettings}
                      className="mt-1.5 inline-flex items-center min-h-[24px] text-[12px] text-text-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      Go to Settings
                    </button>
                  )
                ) : (
                  onRetry && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-1.5 inline-flex items-center min-h-[24px] text-[12px] text-text-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                    >
                      {retryLabel}
                    </button>
                  )
                )}
              </div>
            );
          })()}

          {/* Bottom row: directed-reply button (left) + token count (right).
              Only shown on completed assistant messages.
              A11y: aria-hidden must NOT be placed on this container — the Reply button
              is interactive and must remain in the accessibility tree at all times.
              Token count is non-interactive and carries aria-hidden when not visible. */}
          {showBottomRow && (
            <div
              className={[
                // gap-4 ensures a minimum 16px between "Reply to" label and token count
                // so they never collide on short bubbles or with long model names (#397).
                'mt-2 flex items-center justify-between gap-4',
                'transition-opacity duration-fast',
                rowVisible ? 'opacity-100' : 'opacity-0 focus-within:opacity-100',
              ].join(' ')}
            >
              {/* "Reply to [Model]" — left side.
                  Always in accessibility tree; opacity-0 at rest, visible on hover/focus. */}
              {canDirectReply ? (
                <button
                  type="button"
                  onClick={() => onDirectedReply!(message.modelId as ModelId)}
                  className={[
                    'inline-flex items-center min-h-[24px]',
                    'text-[11px] font-medium min-w-0 truncate',
                    'hover:underline underline-offset-2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    'rounded-sm',
                  ].join(' ')}
                  style={{ color: resolveAccentCssColor(accentColor, modelConfig?.modelId) }}
                  aria-label={`Reply to ${modelConfig?.name ?? message.modelId}`}
                >
                  Reply to {modelConfig?.name ?? message.modelId}
                </button>
              ) : (
                // Spacer so token count stays right-aligned when no reply button.
                <span />
              )}

              {/* Token count — right side.
                  'never': excluded from DOM entirely (showTokenCount guard above).
                  'always'/'active': rendered; aria-hidden when row is not visible since
                  this is non-interactive supplementary data.
                  #357: estimated cost appended when available (formatCost returns null
                  for undefined/zero, so the · separator only renders with real data).
                  #458: token breakdown (input/output split) exposed via sr-only span —
                  replaces the unreliable `title` attribute which VoiceOver on iOS ignores
                  and NVDA only announces in browse mode. The sr-only span announces the
                  breakdown immediately after the total, giving screen reader users full
                  access to the supplementary data (WCAG 1.3.1). */}
              {showTokenCount && (() => {
                const costStr = formatCost(message.tokenUsage!.estimatedCost);
                return (
                  /* #360: aria-label is prohibited on role="generic" (ARIA 1.2 §6.2.6).
                     Interpunct is hidden from AT via aria-hidden; cost is prefixed with
                     an sr-only comma-phrase so screen readers announce it cleanly. */
                  <div
                    className="text-[11px] text-text-muted text-right shrink-0"
                    aria-hidden={!rowVisible}
                  >
                    {message.tokenUsage!.totalTokens.toLocaleString()} tokens
                    {/* #458: sr-only breakdown replaces title attribute.
                        Announces as: "… tokens (input: N, output: N)" */}
                    <span className="sr-only">
                      {' '}(input: {message.tokenUsage!.inputTokens.toLocaleString()}, output: {message.tokenUsage!.outputTokens.toLocaleString()})
                    </span>
                    {costStr !== null && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, estimated cost </span>
                        {costStr}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        </div>
      </div>
    );
  }

  // ─── User bubble — nameplate design (#322 amendment) ─────────────────────
  //
  // User bubbles now use the same nameplate wrapper structure as model bubbles.
  // Differences from model bubbles: no dot, no name label — nameplate contains
  // copy button, edit button, and timestamp only. No left border.
  // --bubble-accent = var(--accent-user).
  //
  // Structure:
  //   outer container (relative, --bubble-accent: var(--accent-user), bubble-entering, drop-shadow)
  //   ├── tail (absolute, right side, points right ►, CSS border trick)
  //   └── wrapper (rounded-[12px] overflow-hidden — no shadow, shadow is on outer container)
  //       ├── nameplate zone (28px, tinted background)
  //       │   ├── copy button (ml-4 left spacer, opacity-0 at rest)
  //       │   ├── edit button (opacity-0 at rest, user messages only)
  //       │   └── timestamp (ml-auto, right-aligned)
  //       └── body zone (bg-card, message content + target label + token count)
  //
  // Token step 1 — --accent-user: confirmed in tailwind.config.js line 34.
  // Token step 2 — --accent-user: set by applyTheme() in theme.ts line 74.

  const userShowBottomRow = !isStreaming && showTokenCount;

  return (
    <div
      className={[
        'relative max-w-[85%] self-end',
        'bubble-entering',
        // Fix #322: drop-shadow on outer container so the tail triangle is included
        // in the shadow shape (same reasoning as assistant bubble above).
        // Polish2: bumped to drop-shadow (one step up from drop-shadow-sm) for better visibility.
        'drop-shadow hover:drop-shadow-md transition-[filter] duration-fast',
      ].join(' ')}
      style={{
        animationDelay: entranceDelay,
        '--bubble-accent': 'var(--accent-user)',
      } as React.CSSProperties}
      onMouseEnter={() => { setIsHovered(true); setHoverTick((t) => t + 1); }}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Tail — right side, points right ►.
          Sibling of wrapper (not child) so overflow:hidden on wrapper does not clip it.
          Positioned absolutely relative to outer container (bottom-[12px] = near bottom of bubble).
          aria-hidden: purely decorative shape, no semantic content. */}
      <div
        className="absolute right-0 bottom-[12px] translate-x-full w-0 h-0"
        aria-hidden="true"
        style={{
          borderLeft: '8px solid var(--surface-card)',
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
        }}
      />

      {/* Bubble wrapper — overflow:hidden clips nameplate tint at rounded corners.
          Shadow moved to outer container (drop-shadow) so the tail sibling is also shadowed.
          streaming-shimmer + data-model on wrapper so the ::after shimmer bar
          renders at the correct bottom edge of the card. */}
      <div
        className={[
          'relative rounded-[12px] overflow-hidden',
          isStreaming ? 'streaming-shimmer' : '',
        ].join(' ')}
        data-model={getModelDataAttr(message.modelId)}
      >

        {/* Nameplate zone — 28px fixed height.
            Contents: right group [edit? copy timestamp] — all flush-right as a unit.
            No dot, no name label for user bubbles.
            ml-auto on the group pushes everything right; gap-2 spaces items within the group.
            Button order: edit (leftmost) → copy → timestamp (rightmost — consistent position). */}
        <div className="h-[28px] px-4 flex items-center gap-2 bg-[color-mix(in_srgb,var(--bubble-accent)_var(--nameplate-tint),var(--surface-card))]">
          {/* Right group: [edit?] [copy] [timestamp] — always flush-right as a unit */}
          <div className="ml-auto flex items-center gap-2">
            {/* Edit button — user messages only, left of copy.
                Always in DOM (opacity toggled, not conditional) so Tab reaches it.
                Calls onEditMessage(messageIndex) → App truncate+resend path. */}
            {onEditMessage && messageIndex !== undefined && (
              <button
                type="button"
                onClick={() => onEditMessage(messageIndex)}
                aria-label="Edit message"
                className={[
                  'w-6 h-6 rounded flex items-center justify-center shrink-0',
                  'text-text-secondary hover:bg-hover hover:text-text-primary',
                  'transition-opacity transition-colors duration-fast',
                  isHovered ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                ].join(' ')}
              >
                <EditIcon />
              </button>
            )}

            {/* Copy button — rightmost action button, immediately before timestamp */}
            <NameplateCopyButton />

            {/* Timestamp — always rightmost in the group.
                #400: relativeTimestamp is recomputed on mouseenter (hoverTick) so stale values refresh on interaction. */}
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-[11px] text-text-muted shrink-0"
            >
              {relativeTimestamp}
            </time>
          </div>
        </div>

        {/* Body zone — same structure as model bubble body zone. */}
        <div className="px-4 pt-2 pb-3 bg-card">
          {/* Attachment thumbnail strip — rendered above message text for user messages
              that carry image attachments (Phase 5, issue #361).
              #369: each thumbnail is now wrapped in a <button> that opens the Lightbox.
              base64 content has no data-URL prefix per the Attachment contract —
              we prepend "data:{mimeType};base64," here at render time.
              role="group" + aria-label is ARIA-compliant (group role allows an accessible
              name from author); individual <img> alt text uses the filename when present,
              and a numbered fallback for anonymous attachments in multi-image strips.
              Trigger button aria-label: "View full size: {filename}" per #369 spec. */}
          {message.attachments && message.attachments.length > 0 && (
            <div
              role="group"
              aria-label="Attached images"
              className="mb-2 flex flex-wrap gap-2"
            >
              {message.attachments.map((attachment, idx) => {
                const imgSrc = `data:${attachment.mimeType};base64,${attachment.base64}`;
                const imgAlt = attachment.filename
                  ? attachment.filename
                  : message.attachments!.length > 1
                    ? `Attached image ${idx + 1}`
                    : 'Attached image';
                const triggerLabel = attachment.filename
                  ? `View full size: ${attachment.filename}`
                  : 'View full size';

                return (
                  <button
                    key={attachment.id}
                    type="button"
                    aria-label={triggerLabel}
                    onClick={(e) => {
                      // Capture trigger element for focus restoration on lightbox close.
                      lightboxReturnRef.current = e.currentTarget;
                      setLightboxAttachment(attachment);
                    }}
                    className={[
                      'relative rounded overflow-hidden cursor-zoom-in',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                    ].join(' ')}
                  >
                    <img
                      src={imgSrc}
                      alt={imgAlt}
                      className="w-16 h-16 object-cover block"
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Lightbox (#369) — renders as a portal to document.body when open.
              Only one attachment can be open at a time. Focus is trapped inside
              the dialog and restored to the trigger button on close. */}
          {lightboxAttachment && (
            <Lightbox
              src={`data:${lightboxAttachment.mimeType};base64,${lightboxAttachment.base64}`}
              alt={
                lightboxAttachment.filename
                  ? lightboxAttachment.filename
                  : 'Attached image'
              }
              filename={lightboxAttachment.filename}
              onClose={() => setLightboxAttachment(null)}
              returnFocusRef={lightboxReturnRef as React.RefObject<HTMLElement | null>}
            />
          )}

          {/* Directed-to label — shown above message text on user messages that have a targetModelId.
              Conventional UX pattern: label/context first, then content. (#372)
              mb-2 spacing separates the label from the message body below it.
              Color is read from targetModelConfig — modelId passed for custom provider
              CSS var routing. (#286)
              A11y: aria-label is prohibited on role="generic" (plain <div>, ARIA 1.2 §6.2.6).
              "Directed to" framing is expressed as visible text so screen readers announce the
              full context. The → glyph remains decorative (aria-hidden). */}
          {targetModelConfig && (
            <div
              className="mb-2 flex items-center gap-1 text-[11px] font-medium"
              style={{ color: resolveAccentCssColor(targetModelConfig.color ?? 'accent-other', targetModelConfig.modelId) }}
            >
              <span aria-hidden="true">→</span>
              <span>Directed to {targetModelConfig.name}</span>
            </div>
          )}

          {/* Message body — plain whitespace-preserving text for user messages. */}
          <MessageContent
            message={message}
            isStreaming={isStreaming}
            hasError={false}
          />

          {/* Bottom row — token count only (no directed-reply on user bubbles).
              Visibility is driven by tokenCountVisibility same as assistant bubbles.
              #357: estimated cost appended when available. */}
          {userShowBottomRow && (
            <div
              className={[
                'mt-2 flex items-center justify-end',
                'transition-opacity duration-fast',
                rowVisible ? 'opacity-100' : 'opacity-0 focus-within:opacity-100',
              ].join(' ')}
            >
              {showTokenCount && (() => {
                const costStr = formatCost(message.tokenUsage!.estimatedCost);
                return (
                  /* #360: aria-label is prohibited on role="generic" (ARIA 1.2 §6.2.6).
                     Interpunct is hidden from AT via aria-hidden; cost is prefixed with
                     an sr-only comma-phrase so screen readers announce it cleanly. */
                  <div
                    className="text-[11px] text-text-muted text-right"
                    aria-hidden={!rowVisible}
                  >
                    {message.tokenUsage!.totalTokens.toLocaleString()} tokens
                    {/* #458: sr-only breakdown replaces title attribute. */}
                    <span className="sr-only">
                      {' '}(input: {message.tokenUsage!.inputTokens.toLocaleString()}, output: {message.tokenUsage!.outputTokens.toLocaleString()})
                    </span>
                    {costStr !== null && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="sr-only">, estimated cost </span>
                        {costStr}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// #448 — Memoized export. areBubblePropsEqual skips re-renders when a bubble is
// stable (same message content, not streaming, no error change). During streaming,
// only the actively-streaming bubble's isStreaming/content props change — all peer
// bubbles see equal props and skip re-render entirely.
export const MessageBubble = memo(MessageBubbleBase, areBubblePropsEqual);
