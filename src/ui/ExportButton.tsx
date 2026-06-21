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
 */
export function ExportButton({ onExport, disabled = false }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  const handleToggle = () => {
    if (!disabled) setIsOpen((prev) => !prev);
  };

  const handleSelect = (format: ExportFormat) => {
    onExport(format);
    close();
  };

  // Close on outside click — shared hook (#149).
  useClickOutside([containerRef], close, isOpen);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

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
