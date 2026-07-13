/**
 * Lightbox — full-size image viewer for attachment thumbnails (issue #369).
 *
 * A11y contract (WCAG 2.1 AA):
 *   - role="dialog" aria-modal="true" aria-label describes the open image
 *   - Focus lands on the close button on mount (double-rAF, WCAG 2.4.3)
 *   - Tab/Shift+Tab cycle within the dialog's focusable elements (focus trap)
 *   - Escape closes the lightbox (WCAG 2.1.2)
 *   - Overlay click closes the lightbox
 *   - Focus restores to the trigger button on close (returnFocusRef, WCAG 2.4.3)
 *
 * Rendering: portal to document.body so the overlay covers the full viewport
 * regardless of z-index stacking context in the component tree.
 *
 * No external lightbox library — implemented inline per issue #369 spec.
 *
 * #390: Added download, copy-to-clipboard (PNG-only), and info toggle controls.
 *   - generatedImage prop: when present, enables download/copy/info controls
 *   - Download derives file extension from mimeType — never hardcodes .png
 *   - Copy is PNG-only (ClipboardItem JPEG/WebP support is inconsistent)
 *   - Info toggle shows altText when present; Escape still closes lightbox
 *   - DOM order: download → info → copy → close (Tab cycles logically)
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GeneratedImage } from '@/types';
import { downloadImage, copyImageToClipboard } from '@/ui/utils/imageActions';

// ─── SVG icons — 20×20, private to this file ─────────────────────────────────
// These icons are single-use in the lightbox overlay and do not belong in the
// shared icon system (icons/index.tsx) which uses a different fixed-size contract.
// react-refresh/only-export-components: all exports from this file are components,
// so the eslint rule is satisfied. Utilities are imported from @/ui/utils/imageActions.
//
// CopyIcon uses the same two-rect clipboard silhouette as MessageBubble's CopyIcon
// (ImageCopyButton and NameplateCopyButton) — unified icon vocabulary across all
// copy affordances in the app (#400–#404 polish pass).

/** Download arrow-into-tray icon — 20×20. */
function DownloadIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M10 3v9m0 0l-3-3m3 3l3-3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14v1a2 2 0 002 2h8a2 2 0 002-2v-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Two-page copy icon — 20×20, stroke-only.
 * Matches the two-rect clipboard silhouette used in MessageBubble's CopyIcon
 * (ImageCopyButton and NameplateCopyButton) — same shape vocabulary, scaled to 20×20
 * for the lightbox overlay context. Fill is transparent (fill="none") so the icon
 * reads cleanly against the dark overlay without themed CSS vars.
 */
function CopyIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      {/* back page — upper-right */}
      <rect
        x="6" y="2" width="11" height="14" rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* front page — lower-left */}
      <rect
        x="3" y="4" width="11" height="14" rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Checkmark icon — 20×20, confirms successful copy. */
function CheckIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <path
        d="M4 10.5l4.5 4.5 7.5-8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Info circle icon — 20×20, toggles the alt-text info panel. */
function InfoIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="flex-shrink-0"
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10 9v5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="10" cy="6.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

// ─── LightboxProps ────────────────────────────────────────────────────────────

interface LightboxProps {
  /** data-URL src string (e.g. "data:image/jpeg;base64,..."). */
  src: string;
  /** Alt text for the image. Never empty — caller is responsible for a meaningful fallback. */
  alt: string;
  /** Optional filename — used in the dialog aria-label. */
  filename?: string;
  /** Called when the user dismisses the lightbox (Escape, overlay click, or close button). */
  onClose: () => void;
  /**
   * Ref to the trigger element that opened this lightbox. Focus is restored here on close.
   * Must be set to the trigger button's DOM node before opening the lightbox.
   */
  returnFocusRef: React.RefObject<HTMLElement | null>;
  /**
   * When present, enables the download, copy-to-clipboard, and info-toggle controls (#390).
   * Reads GeneratedImage.base64 (raw base64 without prefix) and GeneratedImage.mimeType
   * directly from this object, per the types contract in /src/types/index.ts.
   *
   * Absence = attachment thumbnails (user-uploaded images in user messages).
   * In the attachment case, no download control is rendered — the user already has the file.
   */
  generatedImage?: GeneratedImage;
  /**
   * 0-based index of this image in a multi-image strip.
   * When provided alongside imageTotal, the download button aria-label includes
   * "{n} of {total}" position context (spec: "#390 download aria-label variants").
   */
  imageIndex?: number;
  /** Total number of images in the strip. See imageIndex. */
  imageTotal?: number;
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

export function Lightbox({
  src,
  alt,
  filename,
  onClose,
  returnFocusRef,
  generatedImage,
  imageIndex,
  imageTotal,
}: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Info panel state — toggled by the info button when altText is present.
  // Escape closes the LIGHTBOX (not just the panel) — see handleKeyDown.
  const [infoOpen, setInfoOpen] = useState(false);

  // Copy state — 'idle' | 'copied' | 'error'. Reverts to 'idle' after 1.5s / 2s.
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  // Copy-to-clipboard — PNG-only gate enforced at render time (button not shown for non-PNG).
  const handleCopy = async () => {
    if (!generatedImage || copyState !== 'idle') return;
    try {
      await copyImageToClipboard(generatedImage);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 1500);
    } catch {
      // DOMException: user denied permission or ClipboardItem API unavailable — fail gracefully.
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2000);
    }
  };

  // Focus close button on mount (WCAG 2.4.3). Double-rAF ensures the DOM has
  // settled after React's render cycle before we attempt to focus.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    });

    // Capture returnFocusRef.current at mount time — the ref value may change
    // by cleanup time, and we want to return focus to the element that opened
    // this lightbox, not whatever the ref happens to point to when it closes.
    const returnTarget = returnFocusRef.current;
    return () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => returnTarget?.focus());
      });
    };
  }, [returnFocusRef]);

  /**
   * Focus-trap keydown handler (WCAG 2.1.2 + 2.4.3).
   *
   * Tab/Shift+Tab: cycle between all focusable elements inside the dialog.
   * Queries the live DOM at keydown time so download/copy/info buttons are
   * automatically included without updating this handler.
   *
   * Escape: closes the lightbox — even when the info panel is open.
   * The info panel is not a nested dialog; Escape always closes the lightbox.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }

    if (e.key === 'Tab') {
      const dialog = e.currentTarget;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (el) =>
          !el.hasAttribute('disabled') &&
          // The `button` part of the selector matches <button tabindex="-1"> even
          // though the [tabindex]:not([-1]) clause doesn't exclude it — that clause
          // only applies to non-natively-focusable elements. Explicitly exclude any
          // element with tabindex="-1" so programmatic-only buttons never corrupt
          // first/last boundary detection. (Gauge review — focus trap correctness.)
          el.getAttribute('tabindex') !== '-1' &&
          // Visually hidden elements appear in querySelectorAll results but cannot
          // receive focus — Tab skips them, so they would produce incorrect boundaries.
          (el.offsetWidth > 0 || el.offsetHeight > 0),
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  // Dialog aria-label: "Full size: {filename}" when filename is present,
  // "Full size image" as fallback.
  const dialogLabel = filename ? `Full size: ${filename}` : 'Full size image';

  // Whether to show the PNG copy button — only for PNG generated images.
  const showCopyButton =
    generatedImage !== undefined && generatedImage.mimeType === 'image/png';

  // Whether to show the info toggle — only when altText is present on the image.
  const hasAltText =
    generatedImage?.altText !== undefined && generatedImage.altText.length > 0;

  // ── Download button aria-label (#390 spec) ────────────────────────────────
  // Four variants based on altText presence and single vs. multi-image strip:
  //   "Download generated image"                          // no altText, single
  //   "Download: {altText}"                               // altText, single (~60 chars)
  //   "Download generated image {n} of {total}"          // no altText, multi
  //   "Download: {altText} (image {n} of {total})"       // altText, multi
  const isMultiImage =
    imageTotal !== undefined && imageTotal > 1 && imageIndex !== undefined;
  const downloadAriaLabel = (() => {
    if (!generatedImage) return 'Download generated image';
    const altSnippet = generatedImage.altText?.slice(0, 60);
    if (altSnippet && isMultiImage) {
      return `Download: ${altSnippet} (image ${imageIndex! + 1} of ${imageTotal})`;
    }
    if (altSnippet) {
      return `Download: ${altSnippet}`;
    }
    if (isMultiImage) {
      return `Download generated image ${imageIndex! + 1} of ${imageTotal}`;
    }
    return 'Download generated image';
  })();

  return createPortal(
    /* Backdrop — dark semi-transparent overlay covering the full viewport.
       Clicking directly on the backdrop (not the dialog panel) closes the lightbox.
       z-50 matches the z-index used by VisionWarningModal and ProxyOnboardingModal. */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
      onClick={(e) => {
        // Only fire when the click lands on the backdrop itself, not on the
        // dialog panel or its children (stopPropagation on the panel handles that).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Dialog panel — contains the image and controls.
          onKeyDown lives here so the focus trap captures keyboard events anywhere
          inside the dialog, not just when a specific element is focused.
          stopPropagation prevents backdrop onClick from firing when clicking
          inside the panel.

          DOM order for Tab cycling (#390 spec):
            download button (bottom-left, Tab 1)
            info button (bottom-left, Tab 2 — only when altText present)
            copy button (bottom-right, Tab 3 — only when PNG)
            close button (top-right, Tab 4 — initial focus target)

          The focus trap queries live DOM, so all visible buttons are automatically
          included regardless of conditional rendering. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        className="relative flex items-center justify-center"
        style={{ maxWidth: '90vw', maxHeight: '90vh' }}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Full-size image.
            max-w-full / max-h-[90vh] / object-contain: preserves aspect ratio,
            never exceeds the viewport. rounded-md matches app aesthetic. */}
        <img
          src={src}
          alt={alt}
          className="max-w-full max-h-[90vh] object-contain rounded-md"
        />

        {/* ── Bottom-left controls: Download + Info (Tab 1 and Tab 2) ─────────
            Only rendered when generatedImage is present.
            Download: always shown for generated images; derives ext from mimeType.
            Info toggle: only shown when altText is present on the image. */}
        {generatedImage && (
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            {/* Download button — Tab 1 */}
            <button
              type="button"
              onClick={() => downloadImage(generatedImage)}
              aria-label={downloadAriaLabel}
              className={[
                'w-9 h-9 rounded-full',
                'flex items-center justify-center',
                'bg-black/60 hover:bg-black/80',
                'text-white',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
              ].join(' ')}
            >
              <DownloadIcon />
            </button>

            {/* Info toggle — Tab 2 (only when altText present) */}
            {hasAltText && (
              <button
                type="button"
                onClick={() => setInfoOpen((v) => !v)}
                aria-label={infoOpen ? 'Hide image description' : 'Show image description'}
                aria-expanded={infoOpen}
                className={[
                  'w-9 h-9 rounded-full',
                  'flex items-center justify-center',
                  infoOpen ? 'bg-black/80' : 'bg-black/60 hover:bg-black/80',
                  'text-white',
                  'transition-colors duration-fast',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
                ].join(' ')}
              >
                <InfoIcon />
              </button>
            )}
          </div>
        )}

        {/* ── Copy status live region — WCAG 4.1.3 Status Messages (#390, Ada WARN-2) ──
            `role="status"` (implicit aria-live="polite") announces copy outcome to screen
            readers. This is needed because the copy button is `disabled` during non-idle
            states — disabled buttons may suppress aria-label change announcements in
            VoiceOver and other screen readers. The live region guarantees the announcement
            regardless of focus position or button disabled state.
            Always rendered when showCopyButton is true so the live region is pre-mounted
            (conditional mounting on first status change can miss the first announcement). */}
        {showCopyButton && (
          <span
            role="status"
            aria-live="polite"
            className="sr-only"
          >
            {copyState === 'copied'
              ? 'Image copied to clipboard.'
              : copyState === 'error'
                ? 'Copy failed. Permission denied.'
                : ''}
          </span>
        )}

        {/* ── Copy button — bottom-right, Tab 3 (PNG-only) ─────────────────────
            Only rendered when generatedImage is present and mimeType is image/png.
            PNG-only gate: ClipboardItem JPEG/WebP support is inconsistent across browsers.
            disabled during non-idle copy states to prevent double-clicks.
            The aria-label still updates for focus context; the live region above
            handles the status announcement for screen readers (Ada WARN-2). */}
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            disabled={copyState !== 'idle'}
            aria-label={
              copyState === 'copied'
                ? 'Copied to clipboard!'
                : copyState === 'error'
                  ? 'Copy failed — permission denied'
                  : 'Copy image to clipboard'
            }
            className={[
              'absolute bottom-4 right-4',
              'w-9 h-9 rounded-full',
              'flex items-center justify-center',
              copyState === 'copied'
                ? 'bg-green-700/80'
                : copyState === 'error'
                  ? 'bg-red-700/80'
                  : 'bg-black/60 hover:bg-black/80',
              'text-white',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
            ].join(' ')}
          >
            {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
          </button>
        )}

        {/* ── Close button — top-right, Tab 4, initial focus target ────────────
            Receives focus on mount via double-rAF in useEffect (WCAG 2.4.3).
            bg-black/60 + text-white: readable against any image content.
            focus-visible ring uses ring-white so it's visible against dark overlay.
            ring-offset-1 creates a visible gap between button and ring (WCAG 1.4.11). */}
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className={[
            'absolute top-2 right-2',
            'w-9 h-9 rounded-full',
            'flex items-center justify-center',
            'bg-black/60 hover:bg-black/80',
            'text-white',
            'transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1',
          ].join(' ')}
        >
          {/* × glyph — straightforward close affordance, no SVG import needed. */}
          <span aria-hidden="true" className="text-[20px] leading-none select-none">
            ×
          </span>
        </button>

        {/* ── Info panel — collapsible alt-text overlay ─────────────────────────
            Shown when infoOpen is true and altText is present.
            max-h-32 / overflow-y-auto: prevents the panel from dominating the view.
            bg-black/70: translucent treatment consistent with other overlay controls.
            Not a nested dialog — Escape closes the lightbox, not just this panel.
            Positioned above the bottom controls (bottom-16) to avoid overlap. */}
        {infoOpen && hasAltText && (
          <div
            className={[
              'absolute bottom-16 left-4 right-4',
              'max-h-32 overflow-y-auto',
              'bg-black/70 rounded-md',
              'px-3 py-2',
              'text-white text-[13px] leading-[1.5]',
            ].join(' ')}
          >
            {generatedImage!.altText}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
