/**
 * BulkActionBar — bulk selection action controls for the sidebar.
 *
 * Extracted from Sidebar.tsx (#146) to improve maintainability.
 * Handles the select-all checkbox, archive-selected, and delete-selected
 * (with inline delete confirmation).
 */

import { useState, useRef, useEffect, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BulkBarState = 'idle' | 'confirm-delete';

export interface BulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkArchive: () => void;
  onBulkDelete: () => void;
}

// ─── BulkActionBar ────────────────────────────────────────────────────────────

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBulkArchive,
  onBulkDelete,
}: BulkActionBarProps) {
  const [barState, setBarState] = useState<BulkBarState>('idle');
  const allSelected = selectedCount === totalCount && totalCount > 0;

  // Refs for focus management (WCAG 2.4.3 — focus order on state transition).
  // confirmCancelRef: the "Cancel" button in the confirm-delete state — receives
  // focus when the confirm UI opens so keyboard users land on the safe default
  // action (Cancel) rather than the destructive Delete button.
  // deleteSelectedRef: the "Delete selected" trigger — receives focus when the
  // confirm state is dismissed (cancel or confirmed) to restore focus position.
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const deleteSelectedRef = useRef<HTMLButtonElement>(null);

  // Move focus to the Cancel button when entering confirm-delete state (WCAG 2.4.3).
  // Cancel is the safe default for a destructive action — initial focus must not
  // land on the Delete button.
  useEffect(() => {
    if (barState === 'confirm-delete') {
      confirmCancelRef.current?.focus();
    }
  }, [barState]);

  const handleCancelConfirm = useCallback(() => {
    setBarState('idle');
    // Return focus to the "Delete selected" trigger on cancel (WCAG 2.4.3).
    // Deferred to next tick so the button is visible before focus is applied.
    setTimeout(() => deleteSelectedRef.current?.focus(), 0);
  }, []);

  const handleBulkDeleteConfirm = useCallback(() => {
    onBulkDelete();
    setBarState('idle');
    // Return focus to "Delete selected" trigger after confirmation.
    // The button re-renders when barState returns to idle; next tick ensures
    // the DOM has updated before focus is applied.
    setTimeout(() => deleteSelectedRef.current?.focus(), 0);
  }, [onBulkDelete]);

  return (
    <div className="flex-shrink-0 border-b border-border bg-hover/30">
      {/* Header row: select-all + deselect */}
      <div className="flex items-center px-3 py-1.5 gap-2">
        <input
          type="checkbox"
          aria-label={allSelected ? 'Deselect all' : 'Select all'}
          checked={allSelected}
          onChange={allSelected ? onDeselectAll : onSelectAll}
          className="w-3.5 h-3.5 rounded accent-[var(--accent-claude)] cursor-pointer"
        />
        <span className="flex-1 text-[11px] text-text-secondary">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={onDeselectAll}
          className={[
            'text-[11px] text-text-muted hover:text-text-secondary transition-colors duration-fast',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded',
          ].join(' ')}
        >
          Clear
        </button>
      </div>

      {/* Action row */}
      {barState === 'idle' ? (
        <div className="flex items-center px-3 pb-1.5 gap-2">
          <button
            type="button"
            onClick={onBulkArchive}
            className={[
              'flex-1 py-1 rounded text-[11px] text-center',
              'text-text-secondary bg-hover hover:bg-hover/80',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Archive selected
          </button>
          <button
            ref={deleteSelectedRef}
            type="button"
            onClick={() => setBarState('confirm-delete')}
            className={[
              'flex-1 py-1 rounded text-[11px] text-center',
              'text-error bg-hover hover:bg-hover/80',
              'transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
            ].join(' ')}
          >
            Delete selected
          </button>
        </div>
      ) : (
        /* Inline delete confirmation */
        <div className="px-3 pb-1.5">
          <p className="text-[11px] text-text-secondary mb-1.5">
            Delete {selectedCount} conversation{selectedCount !== 1 ? 's' : ''}?
          </p>
          <div className="flex gap-2">
            <button
              ref={confirmCancelRef}
              type="button"
              onClick={handleCancelConfirm}
              className={[
                'flex-1 py-1 rounded text-[11px] text-text-secondary bg-hover hover:bg-hover/80 transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkDeleteConfirm}
              className={[
                'flex-1 py-1 rounded text-[11px] text-white bg-error-bg hover:opacity-90 transition-opacity duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
