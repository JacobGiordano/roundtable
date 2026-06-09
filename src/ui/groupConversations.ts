import type { Conversation } from '@/types';

/**
 * Groups an array of conversations by groupId.
 * Returns:
 *   - `named`: alphabetically-sorted Map of groupId → Conversation[]
 *   - `ungrouped`: conversations with no groupId (rendered last, no header)
 *
 * Extracted from Sidebar.tsx into its own module so it can be unit-tested
 * without triggering the react-refresh/only-export-components lint rule.
 */
export function groupConversations(conversations: Conversation[]): {
  named: Map<string, Conversation[]>;
  ungrouped: Conversation[];
} {
  const named = new Map<string, Conversation[]>();
  const ungrouped: Conversation[] = [];

  for (const conv of conversations) {
    if (conv.groupId) {
      const existing = named.get(conv.groupId);
      if (existing) {
        existing.push(conv);
      } else {
        named.set(conv.groupId, [conv]);
      }
    } else {
      ungrouped.push(conv);
    }
  }

  // Sort group names alphabetically.
  const sorted = new Map(
    [...named.entries()].sort(([a], [b]) => a.localeCompare(b)),
  );

  return { named: sorted, ungrouped };
}
