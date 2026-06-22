/**
 * SidebarChrome — small presentational components for the sidebar.
 *
 * Extracted from Sidebar.tsx (#146) to improve maintainability.
 * Contains: ArchiveToggle, GroupHeader, ThreadSkeleton.
 * These are small, tightly coupled to the sidebar's structure, and grouped
 * together rather than given individual files to avoid over-fragmentation.
 */

import { RightChevronIcon } from '@/ui/icons';
import type { ArchiveFilter } from '@/ui/sidebarUtils';

// ─── ArchiveToggle ────────────────────────────────────────────────────────────

export interface ArchiveToggleProps {
  value: ArchiveFilter;
  onChange: (value: ArchiveFilter) => void;
}

export function ArchiveToggle({ value, onChange }: ArchiveToggleProps) {
  return (
    <div className="flex items-center mx-3 my-1.5 rounded-md overflow-hidden border border-border text-[11px] font-medium">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={[
          'flex-1 h-8 text-center transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          value === 'active'
            ? 'bg-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary hover:bg-hover/40',
        ].join(' ')}
        aria-pressed={value === 'active'}
      >
        Active
      </button>
      <button
        type="button"
        onClick={() => onChange('archived')}
        className={[
          'flex-1 h-8 text-center transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
          value === 'archived'
            ? 'bg-hover text-text-primary'
            : 'text-text-muted hover:text-text-secondary hover:bg-hover/40',
        ].join(' ')}
        aria-pressed={value === 'archived'}
      >
        Archived
      </button>
    </div>
  );
}

// ─── GroupHeader ──────────────────────────────────────────────────────────────

export interface GroupHeaderProps {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
}

export function GroupHeader({ label, isOpen, onToggle }: GroupHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      className={[
        'w-full flex items-center gap-1.5 h-8 px-4',
        'text-left cursor-pointer select-none',
        'text-text-muted hover:text-text-secondary',
        'hover:bg-hover/40 transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset',
      ].join(' ')}
    >
      {/* Right-chevron rotates to indicate open/closed state — shared icon (#147) */}
      <RightChevronIcon isOpen={isOpen} />
      <span className="text-[11px] font-semibold uppercase tracking-wide truncate">
        {label}
      </span>
    </button>
  );
}

// ─── ThreadSkeleton ───────────────────────────────────────────────────────────

export function ThreadSkeleton() {
  return (
    <div className="h-16 flex flex-col justify-center pl-[14px] pr-4 gap-2 opacity-40">
      <div className="h-2.5 w-3/4 rounded bg-border animate-pulse motion-reduce:animate-none" />
      <div className="h-2 w-1/2 rounded bg-border animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
