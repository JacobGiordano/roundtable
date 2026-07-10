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
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

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
}

export function Lightbox({ src, alt, filename, onClose, returnFocusRef }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

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
   * Queries the live DOM at keydown time so future additions (e.g. a download
   * button) are automatically included without updating this handler.
   *
   * Escape: closes the lightbox. Focus returns to trigger via the useEffect
   * cleanup (returnFocusRef).
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
      {/* Dialog panel — contains the image and close button.
          onKeyDown lives here so the focus trap captures keyboard events anywhere
          inside the dialog, not just when a specific element is focused.
          stopPropagation prevents backdrop onClick from firing when clicking
          inside the panel. */}
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

        {/* Close button — positioned absolute top-right of the dialog panel.
            Primary (and only) interactive element; receives focus on mount.
            bg-black/60 + text-white: readable against any image content.
            focus-visible ring uses ring-focus token for design-system consistency.
            ring-offset-1 creates a visible gap between the button and the ring
            so it remains visible against both dark and light image backgrounds (WCAG 1.4.11). */}
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
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
          ].join(' ')}
        >
          {/* × glyph — straightforward close affordance, no SVG import needed. */}
          <span aria-hidden="true" className="text-[20px] leading-none select-none">
            ×
          </span>
        </button>
      </div>
    </div>,
    document.body,
  );
}
