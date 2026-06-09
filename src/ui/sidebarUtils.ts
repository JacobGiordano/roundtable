import type { Conversation } from '@/types';

/**
 * Pure utility functions extracted from Sidebar.tsx so they can be unit-tested
 * without a DOM environment or @testing-library/react.
 *
 * These were previously inline useMemo/useCallback expressions. Extracting them
 * does not change component behaviour — each function is a pure transformation
 * of its inputs with no side-effects.
 */

// ─── Archive filter ───────────────────────────────────────────────────────────

export type ArchiveFilter = 'active' | 'archived';

/**
 * Filters a conversation list by archive status.
 *
 * - 'active'   → conversations WITHOUT an archivedAt timestamp
 * - 'archived' → conversations WITH an archivedAt timestamp
 *
 * Mirrors the inline filter previously inside Sidebar's useMemo.
 */
export function filterByArchiveStatus(
  conversations: Conversation[],
  filter: ArchiveFilter,
): Conversation[] {
  return conversations.filter((c) =>
    filter === 'active' ? c.archivedAt === undefined : c.archivedAt !== undefined,
  );
}

// ─── Group suggestions ────────────────────────────────────────────────────────

/**
 * Derives a sorted, deduplicated list of group names from a conversation list.
 *
 * Used by Sidebar to populate the "Move to group" suggestion list in
 * ThreadActionMenu. Only conversations with a non-empty groupId contribute.
 *
 * Mirrors the inline useMemo previously inside Sidebar.
 */
export function deriveExistingGroups(conversations: Conversation[]): string[] {
  const groups = new Set<string>();
  for (const conv of conversations) {
    if (conv.groupId) groups.add(conv.groupId);
  }
  return [...groups].sort((a, b) => a.localeCompare(b));
}

// ─── Group input resolution ───────────────────────────────────────────────────

/**
 * Converts a raw group-input string to the value passed to onSetGroup.
 *
 * - Blank or whitespace-only input → undefined (clears group membership)
 * - Non-empty string → trimmed string (assigns or renames group)
 *
 * Mirrors the logic in ThreadActionMenu.handleGroupConfirm.
 */
export function resolveGroupInput(raw: string): string | undefined {
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

// ─── Bulk select-all predicate ────────────────────────────────────────────────

/**
 * Returns true when every conversation in `available` is present in `selected`.
 *
 * Matches the `allSelected` boolean computed inside BulkActionBar:
 *   selectedCount === totalCount && totalCount > 0
 *
 * Separated here so the edge case (empty available list → false) is explicitly
 * tested rather than inferred from the component's checkbox behaviour.
 */
export function isAllSelected(selected: Set<string>, available: Conversation[]): boolean {
  return available.length > 0 && available.every((c) => selected.has(c.id));
}
