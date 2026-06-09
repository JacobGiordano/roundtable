/**
 * Unit tests for Sidebar.tsx
 *
 * Coverage:
 *   groupConversations()
 *     - empty array → empty named map, empty ungrouped
 *     - all conversations without groupId → empty named, all ungrouped
 *     - all conversations with groupId → all named, empty ungrouped
 *     - mixed: some with groupId, some without → correct split
 *     - multiple conversations sharing the same groupId → grouped together
 *     - named groups sorted alphabetically
 *     - groupId = undefined and groupId absent both land in ungrouped
 *
 * Render-state tests (isLoading, storageError, normal state) are deferred:
 * @testing-library/react is not in devDependencies. Vitest's default environment
 * is "node", and jsdom is not configured in this project. RTL would need to be
 * added as a devDependency before those tests can be written. The groupConversations
 * unit tests are the high-value targets flagged in the session report.
 */

import { describe, it, expect } from 'vitest';
import { groupConversations } from './groupConversations';
import type { Conversation, ModelConfig } from '@/types/index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

let _nextId = 0;
function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  const id = `conv-${++_nextId}`;
  return {
    id,
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ─── groupConversations ───────────────────────────────────────────────────────

describe('groupConversations', () => {
  it('empty array → empty named map, empty ungrouped', () => {
    const { named, ungrouped } = groupConversations([]);
    expect(named.size).toBe(0);
    expect(ungrouped).toHaveLength(0);
  });

  it('all conversations without groupId → empty named map, all in ungrouped', () => {
    const convs = [
      makeConversation(),
      makeConversation(),
      makeConversation(),
    ];
    const { named, ungrouped } = groupConversations(convs);
    expect(named.size).toBe(0);
    expect(ungrouped).toHaveLength(3);
    expect(ungrouped).toEqual(convs);
  });

  it('all conversations with groupId → all in named map, empty ungrouped', () => {
    const convs = [
      makeConversation({ groupId: 'work' }),
      makeConversation({ groupId: 'work' }),
      makeConversation({ groupId: 'personal' }),
    ];
    const { named, ungrouped } = groupConversations(convs);
    expect(ungrouped).toHaveLength(0);
    expect(named.size).toBe(2);
    expect(named.get('work')).toHaveLength(2);
    expect(named.get('personal')).toHaveLength(1);
  });

  it('mixed: some with groupId, some without → correct split', () => {
    const withGroup = makeConversation({ groupId: 'work' });
    const withoutGroup1 = makeConversation();
    const withoutGroup2 = makeConversation({ groupId: undefined });

    const { named, ungrouped } = groupConversations([withGroup, withoutGroup1, withoutGroup2]);

    expect(named.size).toBe(1);
    expect(named.get('work')).toEqual([withGroup]);
    expect(ungrouped).toHaveLength(2);
    expect(ungrouped).toContain(withoutGroup1);
    expect(ungrouped).toContain(withoutGroup2);
  });

  it('multiple conversations sharing the same groupId → grouped together', () => {
    const a = makeConversation({ groupId: 'shared' });
    const b = makeConversation({ groupId: 'shared' });
    const c = makeConversation({ groupId: 'shared' });

    const { named, ungrouped } = groupConversations([a, b, c]);

    expect(ungrouped).toHaveLength(0);
    expect(named.size).toBe(1);
    const group = named.get('shared');
    expect(group).toHaveLength(3);
    expect(group).toEqual([a, b, c]);
  });

  it('named groups sorted alphabetically', () => {
    const convs = [
      makeConversation({ groupId: 'zzz' }),
      makeConversation({ groupId: 'aaa' }),
      makeConversation({ groupId: 'work' }),
      makeConversation({ groupId: 'mno' }),
    ];

    const { named } = groupConversations(convs);
    const keys = [...named.keys()];
    expect(keys).toEqual(['aaa', 'mno', 'work', 'zzz']);
  });

  it('groupId = undefined lands in ungrouped', () => {
    const conv = makeConversation({ groupId: undefined });
    const { named, ungrouped } = groupConversations([conv]);
    expect(named.size).toBe(0);
    expect(ungrouped).toHaveLength(1);
    expect(ungrouped[0]).toBe(conv);
  });

  it('groupId absent (not set at all) lands in ungrouped', () => {
    // makeConversation without groupId key at all (spread does not include it)
    const base = makeConversation();
    // Ensure the key is genuinely absent (not just undefined)
    delete (base as Partial<Conversation>).groupId;
    const { named, ungrouped } = groupConversations([base]);
    expect(named.size).toBe(0);
    expect(ungrouped).toHaveLength(1);
  });

  it('preserves insertion order within a single group', () => {
    const a = makeConversation({ groupId: 'grp' });
    const b = makeConversation({ groupId: 'grp' });
    const c = makeConversation({ groupId: 'grp' });

    const { named } = groupConversations([a, b, c]);
    expect(named.get('grp')).toEqual([a, b, c]);
  });

  it('single conversation with a groupId creates a group of size 1', () => {
    const conv = makeConversation({ groupId: 'solo' });
    const { named, ungrouped } = groupConversations([conv]);
    expect(named.size).toBe(1);
    expect(named.get('solo')).toEqual([conv]);
    expect(ungrouped).toHaveLength(0);
  });
});
