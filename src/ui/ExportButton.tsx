import { useState, useRef, useEffect, useCallback } from 'react';
import type { ExportFormat } from '@/types';
// #149: shared click-outside hook replaces the inline document.addEventListener pattern.
import { useClickOutside } from './hooks/useClickOutside';
// #147: shared DownloadIcon replaces the local copy.
import { DownloadIcon } from './icons';

interface ExportButtonProps {
  /** Called when the user picks a format. Parent handles the async export + download. */
  onExport: (format: ExportFormat) => void;
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
 *  - Tab → closes menu, returns focus to trigger (Tab must not cycle in a menu).
 *  - Enter/Space on a focused menuitem → activates it (native button behaviour).
 */
export function ExportButton({ onExport, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    onExport(format);
    setIsOpen(false);
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
        <div
          ref={menuRef}
          role="menu"
          aria-label="Export format"
          className={[
            'absolute right-0 top-full mt-1 z-50',
            'min-w-[180px] py-1',
            'bg-card border border-border rounded-md',
            'shadow-md',
          ].join(' ')}
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
      )}
    </div>
  );
}
