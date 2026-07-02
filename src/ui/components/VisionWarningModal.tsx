/**
 * VisionWarningModal — pre-send warning shown when pending attachments exist
 * but at least one active model lacks vision capability (issue #285).
 *
 * Dialog contract (WCAG 2.1 AA):
 *   - role="dialog" aria-modal="true" aria-labelledby pointing to title
 *   - Focus lands on "Send anyway" (primary action) on open via double-rAF
 *   - Tab/Shift+Tab cycle between the two buttons only (focus trap)
 *   - Escape = Cancel; Enter on focused button = activate (native button behaviour)
 *   - Focus restores to the caller-supplied `returnFocusRef` on close (double-rAF)
 *
 * Keyboard confirm sub-state contract (HANDOFF gotcha):
 *   - Both confirm buttons carry data-confirm="true" so the keydown handler can
 *     query them; the Tab handler cycles between them without closing the dialog.
 *   - Escape closes; Left/Right arrow keys are not wired (only two buttons, Tab suffices).
 */

import { useEffect, useRef, useId } from 'react';

interface VisionWarningModalProps {
  /** Names of active models that lack vision support — listed in the modal body. */
  nonVisionModelNames: string[];
  /** Called when the user confirms they want to send despite missing vision support. */
  onSendAnyway: () => void;
  /** Called when the user cancels — modal closes, send is aborted. */
  onCancel: () => void;
  /** Element to restore focus to after the modal unmounts (double-rAF). */
  returnFocusRef: React.RefObject<HTMLElement | null>;
}

export function VisionWarningModal({
  nonVisionModelNames,
  onSendAnyway,
  onCancel,
  returnFocusRef,
}: VisionWarningModalProps) {
  const titleId = useId();
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus "Send anyway" when the modal mounts (WCAG 2.4.3).
  // Double-rAF ensures the DOM has settled after React's render cycle.
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => sendButtonRef.current?.focus());
    });

    // Capture returnFocusRef.current at effect-run time (not cleanup time), as the
    // lint rule correctly notes: the ref value may have changed by cleanup time.
    // We want to restore focus to the element that was active when the modal opened,
    // which is what was stored in the ref at mount time.
    const returnTarget = returnFocusRef.current;
    return () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          returnTarget?.focus();
        });
      });
    };
  }, [returnFocusRef]);

  /** Focus-trap keydown handler for the dialog container. */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      // Cycle between the two confirm buttons (Tab and Shift+Tab toggle).
      if (document.activeElement === sendButtonRef.current) {
        cancelButtonRef.current?.focus();
      } else {
        sendButtonRef.current?.focus();
      }
    }
  };

  const modelList =
    nonVisionModelNames.length === 1
      ? nonVisionModelNames[0]
      : `${nonVisionModelNames.slice(0, -1).join(', ')} and ${nonVisionModelNames[nonVisionModelNames.length - 1]}`;

  return (
    /* Backdrop — clicking outside the dialog panel = Cancel */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      aria-hidden="false"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      {/* Dialog panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={[
          'bg-card border border-border rounded-lg shadow-lg',
          'max-w-sm w-full mx-4 p-6',
          'flex flex-col gap-4',
        ].join(' ')}
        onKeyDown={handleKeyDown}
        // Prevent backdrop click from also firing when clicking inside panel
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-[15px] font-semibold text-text-primary leading-snug"
        >
          Some models can't see images
        </h2>

        <p className="text-[14px] text-text-secondary leading-relaxed">
          <span className="font-medium text-text-primary">{modelList}</span>{' '}
          {nonVisionModelNames.length === 1 ? 'will receive' : 'will receive'} this
          message without the attached images.
        </p>

        {/* Actions row — Cancel (secondary) + Send anyway (primary) */}
        <div className="flex gap-3 justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            data-confirm="true"
            onClick={onCancel}
            className={[
              'px-4 py-2 rounded-md text-[13px] font-medium',
              'bg-hover text-text-primary',
              'hover:brightness-95 active:brightness-90',
              'transition-[filter] duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
            ].join(' ')}
          >
            Cancel
          </button>
          <button
            ref={sendButtonRef}
            type="button"
            data-confirm="true"
            onClick={onSendAnyway}
            className={[
              'px-4 py-2 rounded-md text-[13px] font-medium',
              'bg-accent-claude text-text-inverse',
              'hover:brightness-110 active:brightness-90 active:scale-[0.97]',
              'transition-[filter,transform] duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
            ].join(' ')}
          >
            Send anyway
          </button>
        </div>
      </div>
    </div>
  );
}
