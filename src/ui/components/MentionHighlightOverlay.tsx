/**
 * MentionHighlightOverlay — renders an absolutely-positioned mirror div
 * over a textarea to visually highlight an @ModelName mention token.
 *
 * Why this approach: textareas do not support per-character styling. The
 * standard technique is to overlay a div with matching typography that shows
 * only the highlight background, while the textarea's own text remains visible
 * underneath. The overlay text is color: transparent so only the highlight
 * background bleeds through.
 *
 * Luma spec (at-mention.md §Q2): the highlight applies `background: color-mix(...)`
 * and `color: var(--accent-{modelId})`. We implement the color-mix() background
 * inline; the overlay text is transparent so the textarea text shows through.
 *
 * The overlay must match the textarea's font, padding, line-height, and scroll
 * position exactly. Any mismatch causes the highlight to misalign.
 *
 * Issue #382.
 */

import { useEffect, useRef } from 'react';
import type { ModelConfig } from '@/types';
import { resolveAccentCssColor } from '../utils/modelColor';

interface MentionHighlightOverlayProps {
  /** Full current value of the textarea. */
  value: string;
  /** The model whose @mention is currently in the value. */
  model: ModelConfig;
  /**
   * Ref to the textarea element — used to sync scroll position and
   * read computed styles for exact font matching.
   */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * Escapes HTML special characters in a plain-text string for safe insertion
 * into dangerouslySetInnerHTML. Only used for text nodes in the overlay —
 * the overlay renders our own content, not user input rendered as markup.
 * The escape is needed to avoid the `<span>` wrapping the mention from
 * being corrupted by `<`, `>`, or `&` in the surrounding text.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts plain text with embedded newlines to HTML, preserving line breaks
 * as <br/> elements. Spaces at line ends need &nbsp; to avoid collapsing.
 * Also converts runs of spaces to non-collapsing sequences so the overlay
 * aligns with the textarea exactly.
 */
function textToHtml(text: string): string {
  return escapeHtml(text)
    .replace(/ /g, '&nbsp;')
    .replace(/\n/g, '<br/>');
}

export function MentionHighlightOverlay({
  value,
  model,
  textareaRef,
}: MentionHighlightOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const mentionToken = `@${model.name}`;
  const mentionStart = value.indexOf(mentionToken);

  // Sync scroll position with the textarea so the highlight tracks when the
  // user scrolls a multi-line message. Attached via useEffect to manage cleanup.
  useEffect(() => {
    const textarea = textareaRef.current;
    const overlay = overlayRef.current;
    if (!textarea || !overlay) return;

    const syncScroll = () => { overlay.scrollTop = textarea.scrollTop; };
    textarea.addEventListener('scroll', syncScroll);
    return () => textarea.removeEventListener('scroll', syncScroll);
  }, [textareaRef]);

  // If the mention token is not in the value, nothing to highlight.
  if (mentionStart < 0) return null;

  const before = value.slice(0, mentionStart);
  const after = value.slice(mentionStart + mentionToken.length);

  const accentCss = resolveAccentCssColor(model.color, model.modelId);
  const highlightBg = `color-mix(in srgb, ${accentCss} 15%, var(--surface-input))`;

  // Build the overlay HTML: plain text before + highlighted mark + plain text after.
  // Text is color:transparent so the textarea text shows through; only the
  // background on the <mark> element is visible.
  const htmlContent = [
    textToHtml(before),
    `<mark style="background:${highlightBg};color:${accentCss};border-radius:2px;padding:0 1px;">${textToHtml(mentionToken)}</mark>`,
    textToHtml(after),
  ].join('');

  return (
    /* Mirror div — absolutely positioned over the textarea.
       pointer-events:none so all interaction falls through to the textarea.
       The overlay matches the textarea's exact typography and padding:
         font-size: 15px / line-height: 1.5 / py-[3px]
       These values must stay in sync with the textarea's Tailwind classes.
       aria-hidden: this is purely visual — the textarea's own text is the
       semantic content. Screen readers must not read the duplicate content. */
    <div
      ref={overlayRef}
      aria-hidden="true"
      className={[
        'absolute inset-0 pointer-events-none',
        // Match textarea typography exactly
        'text-[15px] font-normal leading-[1.5]',
        // Match textarea padding
        'py-[3px]',
        // Transparent text — only highlight backgrounds show through
        'text-transparent',
        // Same overflow behavior as textarea
        'overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words',
      ].join(' ')}
      style={{ scrollbarWidth: 'none' }}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}
