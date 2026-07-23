import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExportFormat, ExportOptions } from '@/types';
// #149: shared click-outside hook replaces the inline document.addEventListener pattern.
import { useClickOutside } from './hooks/useClickOutside';
// #147: shared DownloadIcon replaces the local copy.
import { DownloadIcon } from './icons';

interface ExportButtonProps {
  /**
   * Called when the user picks a format. Receives the format and the export
   * options (including `includeGeneratedImages`). Parent handles the async
   * export + download.
   */
  onExport: (format: ExportFormat, options: ExportOptions) => void;
  /** Disabled when there is no active conversation or it has no messages. */
  disabled?: boolean;
}

/**
 * Export button with an inline format picker popover.
 *
 * Behaviour:
 *  - Click the button → opens a small popover with "Download as Markdown"
 *    and "Download as HTML" options.
 *  - Selecting an option calls `onExport(format)` and closes the popover.
 *  - Clicking outside or pressing Escape closes the popover without exporting.
 *  - Disabled when `disabled` prop is true (no active conversation / no messages).
 *
 * Keyboard contract (WAI-ARIA menu pattern):
 *  - Enter/Space on trigger → opens menu, focuses first menuitem (WCAG 2.4.3).
 *  - ArrowDown / ArrowUp → move focus between menuitems (wrap at ends).
 *  - Escape → closes menu, returns focus to trigger.
 *  - Tab → closes menu, lets focus move naturally past the trigger (no focus trap).
 *  - Enter/Space on a focused menuitem → activates it (native button behaviour).
 *
 * Generated-image disclosure (#453 / Vera privacy audit):
 *  - An `includeGeneratedImages` checkbox is rendered inside the popover.
 *  - When checked, a visible info banner appears before the download options
 *    informing the user that the export may be large.
 *  - The `includeGeneratedImages` value is passed to `onExport` via ExportOptions.
 */
export function ExportButton({ onExport, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  // #453: Controls whether generated-image blobs are embedded in the export.
  // Default false — opt-in, per the ExportOptions contract.
  const [includeGeneratedImages, setIncludeGeneratedImages] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // #281: Track active focus index without triggering a re-render per keypress.
  // A ref is the correct tool — focus state is ephemeral and does not drive rendering.
  const activeFocusIndexRef = useRef<number>(-1);

  const close = useCallback(() => setIsOpen(false), []);

  const closeAndReturn = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  const handleToggle = () => {
    if (!disabled) setIsOpen((prev) => !prev);
  };

  const handleSelect = (format: ExportFormat) => {
    // #453: Pass ExportOptions so Vault can embed (or omit) generated images.
    onExport(format, { includeGeneratedImages });
    // closeAndReturn rather than bare setIsOpen: when the focused menuitem
    // unmounts the browser moves focus to document.body. Explicitly returning
    // focus to the trigger before unmount satisfies WCAG 2.4.3 — Focus Order.
    closeAndReturn();
  };

  /** Returns the list of focusable menuitems from the menu container. */
  const getMenuItems = useCallback((): HTMLElement[] => {
    if (!menuRef.current) return [];
    return Array.from(menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }, []);

  // Close on outside click — shared hook (#149).
  useClickOutside([containerRef], close, isOpen);

  // #281: WAI-ARIA Menu Button keyboard contract — document-level capture listener.
  //
  // Why capture phase, not bubble-phase onKeyDown on the menu container?
  // After the trigger is clicked, focus sits on the trigger button while the
  // double-rAF that moves focus to the first menuitem is still queued. A
  // bubble-phase handler on the menu div never sees keys fired from the trigger.
  // A capture-phase document listener fires first, regardless of where focus is.
  //
  // The same effect handles initial focus (double-rAF) so both concerns share
  // a single cleanup path.
  useEffect(() => {
    if (!isOpen) {
      activeFocusIndexRef.current = -1;
      return;
    }

    // Focus first menuitem. Double-rAF needed for inline conditional render:
    // React commits the menu to the DOM on the first frame, making items
    // queryable on the second frame.
    let raf2Id = 0;
    let cancelled = false;

    const raf1Id = requestAnimationFrame(() => {
      raf2Id = requestAnimationFrame(() => {
        if (cancelled) return;
        const items = getMenuItems();
        if (items.length > 0) {
          activeFocusIndexRef.current = 0;
          items[0].focus();
        }
      });
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getMenuItems();
      if (items.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          // Determine current position from live focus, not just the ref — handles
          // the case where focus moved into the menu via means other than arrow keys.
          const currentIdx = items.indexOf(document.activeElement as HTMLElement);
          const nextIndex = (currentIdx + 1) % items.length;
          activeFocusIndexRef.current = nextIndex;
          items[nextIndex].focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const currentIdx = items.indexOf(document.activeElement as HTMLElement);
          const prevIndex = (currentIdx - 1 + items.length) % items.length;
          activeFocusIndexRef.current = prevIndex;
          items[prevIndex].focus();
          break;
        }
        case 'Tab': {
          // Tab closes the menu without preventing default — let Tab move
          // focus naturally past the trigger. Unlike Escape, focus is not
          // explicitly returned to the trigger button.
          close();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          closeAndReturn();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1Id);
      cancelAnimationFrame(raf2Id);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, getMenuItems, close, closeAndReturn]);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        aria-label="Export conversation"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={[
          'w-8 h-8 rounded-md flex items-center justify-center',
          'transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
          disabled
            ? 'text-text-muted opacity-40 cursor-not-allowed'
            : 'text-text-secondary hover:bg-hover cursor-pointer',
        ].join(' ')}
      >
        <DownloadIcon className="flex-shrink-0" />
      </button>

      {isOpen && (
        // #455: Outer popup wrapper — rounded card shared by the toggle, disclosure,
        // and menu. The menu (role="menu") contains only menuitem children per
        // ARIA required-children; all other elements sit outside the menu.
        <div
          className={[
            'absolute right-0 top-full mt-1 z-50',
            'min-w-[220px]',
            'bg-card border border-border rounded-md',
            'shadow-md',
          ].join(' ')}
        >
          {/* #453: Generated-image opt-in toggle — sits above the format menu.
              Outside role="menu" so the interactive checkbox does not violate
              ARIA required-children on the menu container. The label is
              explicitly associated via htmlFor/id for WCAG 1.3.1 (label
              association) and 4.1.2 (name/role/value). */}
          <div className="px-3 pt-2.5 pb-2">
            {/* min-h-[24px] ensures the label click target meets the WCAG 2.2
                2.5.8 24px pointer target minimum via the label wrapper. */}
            <label
              htmlFor="export-include-images"
              className="flex items-center gap-2 min-h-[24px] cursor-pointer select-none"
            >
              <input
                id="export-include-images"
                type="checkbox"
                checked={includeGeneratedImages}
                onChange={(e) => setIncludeGeneratedImages(e.target.checked)}
                className={[
                  'w-3.5 h-3.5 rounded-sm',
                  'accent-focus',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
                  'cursor-pointer',
                ].join(' ')}
              />
              <span className="text-[12px] text-text-secondary leading-snug">
                Include generated images
              </span>
            </label>

            {/* #453: Pre-download disclosure notice — visible only when the
                toggle is on. Appears before the format buttons so the user
                sees it before initiating the download (Vera audit requirement).
                Uses the info semantic token (text-info) for a calm, non-alarming
                visual treatment matching the warning banner pattern in
                ModelSelectorPanel. The notice is static text — no live region
                needed because it appears in direct response to a synchronous
                checkbox interaction that the user themselves triggered. */}
            {includeGeneratedImages && (
              <div
                className={[
                  'mt-2 px-2.5 py-2 rounded-sm',
                  'border border-info/30 bg-info/10',
                  'border-l-[3px] border-l-info',
                ].join(' ')}
                role="note"
                aria-label="Export size notice"
              >
                <p className="text-[11px] leading-[1.4] text-info">
                  This export will include model-generated images as embedded
                  data. Export file size may be large.
                </p>
              </div>
            )}
          </div>

          <div
            ref={menuRef}
            role="menu"
            aria-label="Export format"
            className="border-t border-border-subtle py-1"
          >
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => handleSelect('markdown')}
              className={[
                'w-full text-left px-3 py-2',
                'text-[13px] text-text-primary',
                'hover:bg-hover',
                'transition-colors duration-fast',
                // tabIndex={-1}: programmatic focus target only — not in Tab order.
                // Use focus:bg-hover (not focus-visible:ring) per the tabIndex={-1} rule.
                'focus:outline-none focus:bg-hover',
              ].join(' ')}
            >
              Download as Markdown
            </button>
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={() => handleSelect('html')}
              className={[
                'w-full text-left px-3 py-2',
                'text-[13px] text-text-primary',
                'hover:bg-hover',
                'transition-colors duration-fast',
                // tabIndex={-1}: programmatic focus target only — not in Tab order.
                // Use focus:bg-hover (not focus-visible:ring) per the tabIndex={-1} rule.
                'focus:outline-none focus:bg-hover',
              ].join(' ')}
            >
              Download as HTML
            </button>
          </div>

          {/* Static footer note — sits outside role="menu" (ARIA required-children
              constraint). Informs users that attached user images are omitted. */}
          <p
            className={[
              'px-3 pt-1.5 pb-2.5',
              'text-[11px] leading-[1.4] text-text-muted',
              'border-t border-border-subtle',
            ].join(' ')}
          >
            User-attached images are not included in exports.
          </p>
        </div>
      )}
    </div>
  );
}
