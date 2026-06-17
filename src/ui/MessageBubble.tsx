import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import type { Message, ModelConfig, ModelError, ModelId, TokenCountVisibility } from '@/types';

/** Clipboard icon — 14×14 SVG, consistent with other icon buttons in the app. */
function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* Page being copied (back) */}
      <rect x="4" y="1" width="8" height="10" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      {/* Page in front */}
      <rect x="1" y="3.5" width="8" height="10" rx="1.2" fill="var(--surface-card, #fff)" stroke="currentColor" strokeWidth="1.3" />
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
}

/** Maps a ModelId to the data-model attribute value for streaming shimmer CSS targeting. */
function getModelDataAttr(modelId: string | undefined): string {
  return modelId ?? 'other';
}

// ─── Markdown component renderers ─────────────────────────────────────────────

/**
 * Custom renderers for react-markdown. All styles use registered Tailwind tokens.
 * Code syntax highlighting is deferred to a future issue — blocks are rendered in
 * <pre><code> with bg-sidebar (sidebar surface) as the background. The sidebar
 * token is the most semantically neutral "slightly offset from card" surface in
 * the token system.
 *
 * Links: external links open in a new tab with rel="noopener noreferrer" for
 * security. Color uses text-prose-link — the semantic link token shipped by Luma
 * in #193, WCAG AA-compliant across all 7 themes. Underline provides the
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
  // Color: text-prose-link — the semantic link token shipped by Luma in #193.
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
        className="text-prose-link underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded-sm"
      >
        {children}
        {isExternal && <span className="sr-only"> (opens in new tab)</span>}
      </a>
    );
  },
  // Inline code
  code({ children, className }) {
    // react-markdown passes className="language-*" for fenced code blocks.
    // When no className, this is an inline code span.
    const isBlock = !!className;
    if (isBlock) {
      // Fenced code blocks are handled by the `pre` renderer below.
      // This branch renders the inner <code> inside <pre>.
      return (
        <code className="text-[13px] font-mono leading-[1.6] text-text-primary block overflow-x-auto">
          {children}
        </code>
      );
    }
    // Inline code
    return (
      <code className="bg-sidebar text-text-primary text-[13px] font-mono px-1 py-0.5 rounded-sm border border-border-subtle">
        {children}
      </code>
    );
  },
  // Code blocks: rendered as <pre><code> with sidebar surface background.
  // Syntax highlighting is explicitly deferred — no highlighter library added here.
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
  if (message.role === 'user') {
    // User messages: plain text, preserve whitespace (no markdown rendering)
    return (
      <div
        className="text-[15px] font-normal leading-[1.6] text-text-primary whitespace-pre-wrap break-words"
        aria-live="off"
      >
        {message.content}
        {isStreaming && !hasError && (
          <span className="cursor-blink select-none" aria-hidden="true">|</span>
        )}
      </div>
    );
  }

  // Assistant messages: render with react-markdown + rehype-sanitize
  return (
    <div
      className="text-[15px] font-normal leading-[1.6] text-text-primary break-words"
      aria-live={isStreaming ? 'polite' : 'off'}
      aria-atomic={isStreaming ? 'false' : undefined}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={markdownComponents}
      >
        {message.content ?? ''}
      </ReactMarkdown>
      {isStreaming && !hasError && (
        <span className="cursor-blink select-none" aria-hidden="true">|</span>
      )}
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
}: MessageBubbleProps) {
  const isStreaming = message.isStreaming ?? false;
  const hasError    = !!error;
  // Token count and directed-reply affordance are hidden by default; revealed on hover.
  const [isHovered, setIsHovered] = useState(false);
  // Copy-to-clipboard state: 'idle' | 'copied'. Reverts to 'idle' after 1.5s.
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

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

  // Left border color: read from ModelConfig.color (CSS custom property), error overrides.
  // accent-other is only used when modelConfig is genuinely absent/unknown.
  const accentColor = modelConfig?.color ?? 'accent-other';
  const borderLeftColor = hasError ? 'var(--error)' : `var(--${accentColor})`;

  // Only assistant messages from a model show the name header
  const showHeader = message.role === 'assistant' && modelConfig;

  // "Reply to [Model]" affordance: only on completed assistant messages with a known modelId
  const canDirectReply =
    !!onDirectedReply &&
    message.role === 'assistant' &&
    !!message.modelId &&
    !isStreaming;

  // Determine whether to render the token count element and whether it needs
  // opacity control. 'never' removes it from the DOM entirely (accessibility tree included).
  const showTokenCount = tokenCountVisibility !== 'never' && !!message.tokenUsage;

  // The bottom row hosts both the reply button and the token count. It is
  // rendered when at least one of the two is applicable AND the message is done.
  // With 'never', the token count is suppressed but the reply button can still appear.
  const showBottomRow = !isStreaming && (canDirectReply || showTokenCount);

  // Opacity of the bottom row:
  //   'always'  — always visible (1) when row is rendered
  //   'active'  — hover-controlled
  //   'never'   — token count already excluded; reply button uses same hover logic
  const rowVisible = tokenCountVisibility === 'always' ? true : isHovered;

  return (
    <div
      className={[
        'relative w-full bg-card rounded-md shadow-sm hover:shadow-md',
        'border-l-[3px]',
        'px-4 py-3',
        'transition-shadow duration-fast',
        'bubble-entering',
        isStreaming ? 'streaming-shimmer' : '',
      ].join(' ')}
      style={{ animationDelay: entranceDelay, borderLeftColor }}
      data-model={getModelDataAttr(message.modelId)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-busy={isStreaming && message.role === 'assistant' ? true : undefined}
    >
      {/* Copy-to-clipboard button — top-right corner, revealed on hover or focus.
          Available on all messages (user and assistant) as long as there is content to copy.
          aria-label switches between "Copy message" and "Copied!" to announce the state
          change to screen readers without requiring a live region. The button stays in the
          accessibility tree at all times so keyboard users can reach it via Tab — only its
          visual opacity is toggled, never its DOM presence. */}
      {message.content && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyState === 'copied' ? 'Copied!' : 'Copy message'}
          className={[
            'absolute top-2 right-2',
            'w-6 h-6 rounded flex items-center justify-center',
            'text-text-secondary',
            copyState === 'copied'
              ? 'opacity-100 text-semantic-success'
              : 'hover:bg-hover hover:text-text-primary',
            'transition-opacity transition-colors duration-fast',
            isHovered || copyState === 'copied' ? 'opacity-100' : 'opacity-0 focus-visible:opacity-100',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
          ].join(' ')}
        >
          {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
        </button>
      )}

      {/* Model name header — assistant messages only */}
      {showHeader && (
        <div
          className="mb-2 text-[12px] font-semibold text-text-secondary uppercase tracking-[0.04em]"
        >
          {modelConfig.name}
        </div>
      )}

      {/* Message body
          User messages: plain whitespace-preserving text.
          Assistant messages: rendered via react-markdown with rehype-sanitize XSS protection.
          aria-live/aria-atomic handling is encapsulated in MessageContent. */}
      <MessageContent
        message={message}
        isStreaming={isStreaming}
        hasError={hasError}
      />

      {/* Directed-to label — shown on user messages that have a targetModelId.
          Subtle indicator so the thread stays readable after the fact.
          Color is read from targetModelConfig.color — no modelId switch needed. */}
      {targetModelConfig && message.role === 'user' && (
        <div
          className="mt-1.5 flex items-center gap-1 text-[11px] font-medium"
          style={{ color: `var(--${targetModelConfig.color ?? 'accent-other'})` }}
          aria-label={`Directed to ${targetModelConfig.name}`}
        >
          <span aria-hidden="true">→</span>
          <span>{targetModelConfig.name}</span>
        </div>
      )}

      {/* Error state — terminal indicator rendered after any partial streamed content. */}
      {hasError && (
        <div className={message.content ? 'mt-3 pt-2 border-t border-border-subtle' : 'mt-1'}>
          <p className="flex items-start gap-1.5 text-[13px] text-error">
            <span aria-hidden="true" className="select-none shrink-0">&#9888;</span>
            <span>{error!.message}</span>
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

      {/* Bottom row: token count (right) and directed-reply affordance (left).
          Visibility is driven by tokenCountVisibility:
            'always' — row always visible on completed messages
            'active' — reveal on hover (progressive disclosure, default)
            'never'  — token count excluded from DOM; reply button still hover-reveals

          A11y: aria-hidden must NOT be placed on this container. The Reply button
          is interactive and must remain in the accessibility tree at all times so
          keyboard users can reach it. The row becomes visible on hover OR on
          focus-within (WAI-ARIA Authoring Practices: hover-reveal controls must
          also be reachable by keyboard). The token count is non-interactive and
          carries aria-hidden when the row is not visible — it is only supplementary
          information already conveyed through other means (title tooltip). */}
      {showBottomRow && (
        <div
          className={[
            'mt-2 flex items-center justify-between',
            'transition-opacity duration-fast',
            rowVisible ? 'opacity-100' : 'opacity-0 focus-within:opacity-100',
          ].join(' ')}
        >
          {/* "Reply to [Model]" — left side, only for assistant bubbles.
              Color is read from modelConfig.color — no modelId switch needed.
              The button is always in the accessibility tree (no aria-hidden); it
              is opacity-0 at rest but becomes visible on hover OR keyboard focus
              via focus-within on the parent container. */}
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
              style={{ color: `var(--${accentColor})` }}
              aria-label={`Reply to ${modelConfig?.name ?? message.modelId}`}
            >
              Reply to {modelConfig?.name ?? message.modelId}
            </button>
          ) : (
            // spacer so token count stays right-aligned even when no reply button
            <span />
          )}

          {/* Token count — right side.
              'never': excluded from DOM entirely (not here due to showTokenCount guard).
              'always'/'active': rendered; aria-hidden when row is not visible since
              this element is non-interactive (keyboard users cannot act on it) and
              the data is supplementary — already conveyed via the title tooltip. */}
          {showTokenCount && (
            <div
              className="text-[11px] text-text-muted text-right"
              title={`Input: ${message.tokenUsage!.inputTokens.toLocaleString()} · Output: ${message.tokenUsage!.outputTokens.toLocaleString()}`}
              aria-hidden={!rowVisible}
            >
              {message.tokenUsage!.totalTokens.toLocaleString()} tokens
            </div>
          )}
        </div>
      )}
    </div>
  );
}
