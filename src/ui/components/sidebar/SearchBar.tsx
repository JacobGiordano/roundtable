/**
 * SearchBar — inline search/filter input for the sidebar conversation list.
 *
 * Extracted from Sidebar.tsx (#146) to improve maintainability.
 *
 * Keyboard contract:
 * - Escape: clears the query and keeps focus on the input (does NOT close
 *   the sidebar or trigger any other Escape handler up the tree — this is
 *   achieved by calling e.stopPropagation() before clearing).
 * - The clear (×) button is focusable via Tab; clicking it clears the query
 *   and returns focus to the text input.
 */

import { useRef, useCallback } from 'react';
// #147: shared icon system — SmallCloseIcon replaces the inline × SVG.
import { SmallCloseIcon } from '@/ui/icons';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = useCallback(() => {
    onChange('');
    // Return focus to the input after clearing so the user can immediately
    // type a new query without re-clicking.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        // Stop propagation so the sidebar settings panel (and any other
        // Escape listeners) are not triggered when the user clears a query.
        e.stopPropagation();
        onChange('');
        // Keep focus on the input after clearing — no blur, no dismiss.
        // (focus is already on the input, so no action needed here)
      }
    },
    [onChange],
  );

  return (
    <div className="flex-shrink-0 px-3 py-2">
      <div
        className={[
          'flex items-center gap-1.5 h-8 rounded-md',
          'bg-input border border-border',
          'transition-colors duration-fast',
          'focus-within:border-border-strong',
        ].join(' ')}
      >
        {/* Search icon */}
        <svg
          className="ml-2 flex-shrink-0 text-text-muted"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 8l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          type="search"
          aria-label="Search conversations"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search"
          className={[
            'flex-1 min-w-0 bg-transparent text-[12px] text-text-primary placeholder:text-text-muted',
            // focus:outline-none suppresses the browser default ring; focus-visible:ring-2
            // provides a keyboard-only ring (WCAG 2.4.7 / Aria focus-visibility rules).
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset rounded-md',
            // Suppress browser default clear button on type="search" — we provide our own.
            '[&::-webkit-search-cancel-button]:appearance-none',
          ].join(' ')}
        />

        {/* Clear button — only visible when there is a query */}
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={handleClear}
            className={[
              'mr-1.5 flex-shrink-0 w-4 h-4 flex items-center justify-center rounded-full',
              'text-text-muted hover:text-text-secondary hover:bg-hover',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            {/* Small close icon — shared icon (#147) */}
            <SmallCloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
