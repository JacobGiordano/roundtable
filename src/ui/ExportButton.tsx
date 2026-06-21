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
 *  - Enter/Space on a focused menuitem → activates it.
 */
export function ExportButton({ onExport, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const closeAndReturn = useCallback(() => {
    close();
    buttonRef.current?.focus();
  }, [close]);

  const handleToggle = () => {
    if (!disabled) setIsOpen((prev) => !prev);
  };

  const handleSelect = (format: ExportFormat) => {
    onExport(format);
    close();
  };

  // Close on outside click — shared hook (#149).
  useClickOutside([containerRef], close, isOpen);

  // When the menu opens, move focus to the first menuitem (WCAG 2.4.3 — focus order).
  // Double-rAF ensures the menu has mounted before .focus() fires.
  useEffect(() => {
    if (!isOpen) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
        first?.focus();
      });
    });
  }, [isOpen]);

  // Arrow-key / Tab / Escape handler on the menu container.
  // WAI-ARIA menu pattern: arrow keys move within the menu; Tab closes it.
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
      );
      const focused = document.activeElement as HTMLElement;
      const currentIndex = items.indexOf(focused);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = items[(currentIndex + 1) % items.length];
        next?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = items[(currentIndex - 1 + items.length) % items.length];
        prev?.focus();
      } else if (e.key === 'Tab' || e.key === 'Escape') {
        // Tab and Escape both close the menu and return focus to the trigger.
        e.preventDefault();
        closeAndReturn();
      }
    },
    [closeAndReturn],
  );

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
          onKeyDown={handleMenuKeyDown}
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
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus focus-visible:bg-hover',
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
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus focus-visible:bg-hover',
            ].join(' ')}
          >
            Download as HTML
          </button>
        </div>
      )}
    </div>
  );
}
