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

// ─── Search filter ────────────────────────────────────────────────────────────

/**
 * Filters a conversation list by a search query.
 *
 * Match criteria (case-insensitive, both must pass):
 *   1. Conversation title (explicit or auto-derived from first user message)
 *   2. Content preview: the text of the first user message
 *
 * An empty or whitespace-only query returns all conversations unchanged.
 *
 * Extracted here (#160) so it can be unit-tested independently of the
 * Sidebar component.
 */
export function filterBySearchQuery(
  conversations: Conversation[],
  query: string,
): Conversation[] {
  const normalised = query.trim().toLowerCase();
  if (!normalised) return conversations;
  return conversations.filter((c) => {
    const title = getThreadTitle(c).toLowerCase();
    const preview = (c.messages.find((m) => m.role === 'user')?.content ?? '').toLowerCase();
    return title.includes(normalised) || preview.includes(normalised);
  });
}

// ─── Thread title derivation ──────────────────────────────────────────────────

/**
 * Derives a display title from conversation data.
 *
 * Priority:
 *   1. Explicit title (user-renamed conversation)
 *   2. First user message, truncated to 40 chars
 *   3. Fallback: "New conversation"
 *
 * Extracted here (#146) so ThreadActionMenu.tsx can export this pure function
 * without triggering the react-refresh/only-export-components lint rule
 * (which flags files that export both components and non-component values).
 */
export function getThreadTitle(conversation: Conversation): string {
  if (conversation.title) return conversation.title;
  const firstUserMsg = conversation.messages.find((m) => m.role === 'user');
  if (firstUserMsg) {
    return firstUserMsg.content.replace(/\n/g, ' ').slice(0, 40);
  }
  return 'New conversation';
}
