import { useState, useCallback, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import type { Message, ModelConfig, ModelError, ModelId, TokenCountVisibility } from '@/types';
// #357: formatCost shared util — displays per-message estimated cost in the bubble footer.
import { formatCost } from './utils/formatCost';
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

/** Clipboard icon — 14×14 SVG, consistent with other icon buttons in the app.
 *  Two <rect> elements with stroke outlines. Page interiors are filled with a
 *  var(--nameplate-tint) bubble-accent tint over the surface-card base, matching the
 *  nameplate background exactly on all 7 themes without hardcoded colors or masking.
 *  Back page sits upper-right; front page overlaps lower-left.
 */
function CopyIcon() {
  const pageFill = 'color-mix(in srgb, var(--bubble-accent) var(--nameplate-tint), var(--surface-card))';
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* back page — upper-right */}
      <rect
        x="4" y="1" width="8" height="10" rx="1.5"
        fill={pageFill}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      {/* front page — lower-left */}
      <rect
        x="2" y="3" width="8" height="10" rx="1.5"
        fill={pageFill}
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

interface MessageBubbleProps {
  message: Message;
  modelConfig?: ModelConfig;
  /** Shown when the model returned an error for this message. */
  error?: ModelError;
  /** Called when the user clicks Retry on an errored bubble. Atlas wires the actual retry. */
  onRetry?: () => void;
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

/** Shared rehype plugin array for both the streaming and done ReactMarkdown instances. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [rehypeHighlight, [rehypeSanitize, sanitizeSchema]];

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
  // Blockquote
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-border pl-3 my-2 text-text-secondary italic">
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
    // User messages: plain text, preserve whitespace (no markdown rendering).
    // User messages do not stream, so chunk fade-in is not applied here.
    return (
      <div
        className="text-[15px] font-normal leading-[1.6] text-text-primary whitespace-pre-wrap break-words"
        aria-live="off"
      >
        {content}
        {isStreaming && !hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>
    );
  }

  // When an error is present on a non-streaming message and the content is the
  // synthesized sentinel 'Error' (set by useStreamingMessages guard path when no
  // priming chunk created an accumulator entry), suppress the body text entirely.
  // The error section in MessageBubble already renders the full error detail.
  // Real partial-content + error messages (where the model streamed real text
  // before erroring) have non-sentinel content and are NOT suppressed here.
  if (hasError && !isStreaming && content === 'Error') {
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
        {stableContent && (
          <ReactMarkdown
            rehypePlugins={rehypePlugins}
            components={markdownComponents}
          >
            {stableContent}
          </ReactMarkdown>
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

  // Streaming done (or never streaming) — render full content via react-markdown.
  return (
    <div
      className="text-[15px] font-normal leading-[1.6] text-text-primary break-words"
      aria-live="off"
    >
      <ReactMarkdown
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ─── MessageBubble ─────────────────────────────────────────────────────────────

export function MessageBubble({
  message,
  modelConfig,
  error,
  onRetry,
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
    if (!message.content || copyState === 'copied') return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    }).catch(() => {
      // Clipboard write failed (e.g. insecure context) — fail silently.
    });
  }, [message.content, copyState]);

  // Entrance animation stagger via inline style
  const entranceDelay = `${entranceIndex * 100}ms`;

  // Resolve accent color for this model — used for both the nameplate (--bubble-accent)
  // and any directed-reply button color.
  const accentColor = modelConfig?.color ?? 'accent-other';

  // Token count: shown when visibility is not 'never' and tokenUsage is present.
  const showTokenCount = tokenCountVisibility !== 'never' && !!message.tokenUsage;

  // Row opacity: 'always' → always visible; 'active'/'never' → hover-controlled.
  const rowVisible = tokenCountVisibility === 'always' ? true : isHovered;

  // ─── Nameplate copy button factory ──────────────────────────────────────
  // Returns a copy button styled for nameplate flow (not absolute-positioned).
  // Used in both assistant and user nameplates.
  // additionalClassName: pass 'ml-4' on the first button after a name/dot to add breathing room.

  function NameplateCopyButton({ additionalClassName = '' }: { additionalClassName?: string }) {
    if (!message.content || (hasError && message.content === 'Error')) return null;
    return (
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copyState === 'copied' ? 'Copied!' : 'Copy message'}
        className={[
          additionalClassName,
          'p-0.5 rounded flex items-center justify-center shrink-0',
          'text-text-secondary',
          copyState === 'copied'
            ? 'text-success'
            : 'hover:bg-hover hover:text-text-primary',
          'transition-opacity transition-colors duration-fast',
          isHovered || copyState === 'copied' ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
        ].join(' ')}
      >
        {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
      </button>
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
        onMouseEnter={() => setIsHovered(true)}
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

          {/* Warning icon — error state only, between dot and model name.
              Plain text ⚠ is sufficient; no SVG import needed at this size. */}
          {hasError && (
            <span aria-hidden="true" className="text-error text-[12px] select-none leading-none shrink-0">
              &#9888;
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

          {/* Right group: copy + timestamp — always flush-right as a unit.
              ml-auto on the group pushes everything right; gap-2 spaces copy from timestamp.
              This keeps the copy button at a consistent position regardless of name length. */}
          <div className="ml-auto flex items-center gap-2">
            <NameplateCopyButton />
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-[11px] text-text-muted shrink-0"
            >
              {formatRelativeTime(message.timestamp)}
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

          {/* Error detail — rendered in the body zone below any partial content.
              The divider (border-t) is only shown when there is visible body content.
              When content is the synthesized sentinel 'Error', MessageContent returns
              null and no body is rendered — so the divider is suppressed.
              The warning icon is in the nameplate; the body shows the message text only. */}
          {hasError && (
            <div className={message.content && message.content !== 'Error' ? 'mt-3 pt-2 border-t border-border-subtle' : 'mt-1'}>
              <p className="text-[13px] text-error italic">
                Error: {error!.message}
              </p>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-1.5 text-[12px] text-text-secondary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Bottom row: directed-reply button (left) + token count (right).
              Only shown on completed assistant messages.
              A11y: aria-hidden must NOT be placed on this container — the Reply button
              is interactive and must remain in the accessibility tree at all times.
              Token count is non-interactive and carries aria-hidden when not visible. */}
          {showBottomRow && (
            <div
              className={[
                'mt-2 flex items-center justify-between',
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
                    'text-[11px] font-medium',
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
                  for undefined/zero, so the · separator only renders with real data). */}
              {showTokenCount && (() => {
                const costStr = formatCost(message.tokenUsage!.estimatedCost);
                return (
                  /* #360: aria-label is prohibited on role="generic" (ARIA 1.2 §6.2.6).
                     Interpunct is hidden from AT via aria-hidden; cost is prefixed with
                     an sr-only comma-phrase so screen readers announce it cleanly. */
                  <div
                    className="text-[11px] text-text-muted text-right"
                    title={`Input: ${message.tokenUsage!.inputTokens.toLocaleString()} · Output: ${message.tokenUsage!.outputTokens.toLocaleString()}`}
                    aria-hidden={!rowVisible}
                  >
                    {message.tokenUsage!.totalTokens.toLocaleString()} tokens
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
      onMouseEnter={() => setIsHovered(true)}
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
                  'p-0.5 rounded flex items-center justify-center shrink-0',
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

            {/* Timestamp — always rightmost in the group */}
            <time
              dateTime={new Date(message.timestamp).toISOString()}
              className="text-[11px] text-text-muted shrink-0"
            >
              {formatRelativeTime(message.timestamp)}
            </time>
          </div>
        </div>

        {/* Body zone — same structure as model bubble body zone. */}
        <div className="px-4 pt-2 pb-3 bg-card">
          {/* Attachment thumbnail strip — rendered above message text for user messages
              that carry image attachments (Phase 5, issue #361).
              base64 content has no data-URL prefix per the Attachment contract —
              we prepend "data:{mimeType};base64," here at render time.
              role="group" + aria-label is ARIA-compliant (group role allows an accessible
              name from author); individual <img> alt text uses the filename when present,
              and a numbered fallback for anonymous attachments in multi-image strips.
              Thumbnails are purely visual — no interactive affordance in Phase 5. */}
          {message.attachments && message.attachments.length > 0 && (
            <div
              role="group"
              aria-label="Attached images"
              className="mb-2 flex flex-wrap gap-2"
            >
              {message.attachments.map((attachment, idx) => (
                <img
                  key={attachment.id}
                  src={`data:${attachment.mimeType};base64,${attachment.base64}`}
                  alt={
                    attachment.filename
                      ? attachment.filename
                      : message.attachments!.length > 1
                        ? `Attached image ${idx + 1}`
                        : 'Attached image'
                  }
                  className="w-16 h-16 object-cover rounded"
                />
              ))}
            </div>
          )}

          {/* Message body — plain whitespace-preserving text for user messages. */}
          <MessageContent
            message={message}
            isStreaming={isStreaming}
            hasError={false}
          />

          {/* Directed-to label — shown on user messages that have a targetModelId.
              Subtle indicator so the thread stays readable after the fact.
              Color is read from targetModelConfig — modelId passed for custom provider
              CSS var routing. (#286) */}
          {targetModelConfig && (
            <div
              className="mt-1.5 flex items-center gap-1 text-[11px] font-medium"
              style={{ color: resolveAccentCssColor(targetModelConfig.color ?? 'accent-other', targetModelConfig.modelId) }}
              aria-label={`Directed to ${targetModelConfig.name}`}
            >
              <span aria-hidden="true">→</span>
              <span>{targetModelConfig.name}</span>
            </div>
          )}

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
                    title={`Input: ${message.tokenUsage!.inputTokens.toLocaleString()} · Output: ${message.tokenUsage!.outputTokens.toLocaleString()}`}
                    aria-hidden={!rowVisible}
                  >
                    {message.tokenUsage!.totalTokens.toLocaleString()} tokens
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
