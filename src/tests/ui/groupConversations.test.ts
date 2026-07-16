/**
 * Unit tests: groupConversations() — closes #473
 *
 * groupConversations() is a pure function extracted from Sidebar.tsx into
 * src/ui/groupConversations.ts specifically to be testable without triggering
 * the react-refresh/only-export-components lint rule.
 *
 * Contract:
 *   - Conversations with no groupId land in `ungrouped` (rendered without a header)
 *   - Conversations with a groupId land in `named` Map under the correct key
 *   - Named groups are sorted alphabetically in the returned Map
 *   - Mixed scenarios (some grouped, some not) work correctly
 *   - Empty input returns empty ungrouped array and empty named Map
 *
 * Source: src/ui/groupConversations.ts (Aria owns)
 * This test file lives in src/tests/ui/ (Scout owns)
 */

import { describe, it, expect } from 'vitest';
import { groupConversations } from '@/ui/groupConversations';
import { makeConversation } from '../fixtures/conversations';

describe('groupConversations — ungrouped conversations', () => {
  it('conversations with no groupId land in the ungrouped array', () => {
    const convA = makeConversation({ groupId: undefined });
    const convB = makeConversation({ groupId: undefined });
    const { ungrouped, named } = groupConversations([convA, convB]);

    expect(ungrouped).toHaveLength(2);
    expect(ungrouped[0].id).toBe(convA.id);
    expect(ungrouped[1].id).toBe(convB.id);
    expect(named.size).toBe(0);
  });

  it('ungrouped conversations preserve their original order', () => {
    const conv1 = makeConversation({ groupId: undefined });
    const conv2 = makeConversation({ groupId: undefined });
    const conv3 = makeConversation({ groupId: undefined });
    const { ungrouped } = groupConversations([conv1, conv2, conv3]);

    const ids = ungrouped.map((c) => c.id);
    expect(ids).toEqual([conv1.id, conv2.id, conv3.id]);
  });
});

describe('groupConversations — grouped conversations', () => {
  it('conversations with a groupId appear in the named Map under the correct key', () => {
    const conv = makeConversation({ groupId: 'work' });
    const { named, ungrouped } = groupConversations([conv]);

    expect(named.has('work')).toBe(true);
    expect(named.get('work')).toHaveLength(1);
    expect(named.get('work')![0].id).toBe(conv.id);
    expect(ungrouped).toHaveLength(0);
  });

  it('multiple conversations with the same groupId are all in the same group', () => {
    const conv1 = makeConversation({ groupId: 'team' });
    const conv2 = makeConversation({ groupId: 'team' });
    const conv3 = makeConversation({ groupId: 'team' });
    const { named } = groupConversations([conv1, conv2, conv3]);

    expect(named.has('team')).toBe(true);
    const group = named.get('team')!;
    expect(group).toHaveLength(3);
    const groupIds = group.map((c) => c.id);
    expect(groupIds).toContain(conv1.id);
    expect(groupIds).toContain(conv2.id);
    expect(groupIds).toContain(conv3.id);
  });

  it('distinct groupIds produce distinct Map entries', () => {
    const conv1 = makeConversation({ groupId: 'alpha' });
    const conv2 = makeConversation({ groupId: 'beta' });
    const { named } = groupConversations([conv1, conv2]);

    expect(named.size).toBe(2);
    expect(named.get('alpha')![0].id).toBe(conv1.id);
    expect(named.get('beta')![0].id).toBe(conv2.id);
  });
});

describe('groupConversations — alphabetical ordering of named groups', () => {
  it('named groups are sorted alphabetically in the returned Map', () => {
    const convZ = makeConversation({ groupId: 'Zebra' });
    const convA = makeConversation({ groupId: 'Apple' });
    const convM = makeConversation({ groupId: 'Mango' });
    const { named } = groupConversations([convZ, convA, convM]);

    const keys = Array.from(named.keys());
    // localeCompare order: Apple < Mango < Zebra
    expect(keys).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('alphabetical ordering is case-sensitive via localeCompare', () => {
    // lowercase letters sort after uppercase in default locale
    const convA = makeConversation({ groupId: 'alpha' });
    const convB = makeConversation({ groupId: 'Beta' });
    const { named } = groupConversations([convA, convB]);

    const keys = Array.from(named.keys());
    // Both present — order is localeCompare(a, b) which puts 'Beta' before 'alpha'
    expect(keys).toHaveLength(2);
    expect(keys).toContain('alpha');
    expect(keys).toContain('Beta');
    // Verify the Map key order matches localeCompare
    const expected = ['alpha', 'Beta'].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(expected);
  });
});

describe('groupConversations — mixed scenarios', () => {
  it('correctly separates grouped and ungrouped conversations in a mixed array', () => {
    const grouped1 = makeConversation({ groupId: 'work' });
    const grouped2 = makeConversation({ groupId: 'personal' });
    const ungrouped1 = makeConversation({ groupId: undefined });
    const ungrouped2 = makeConversation({ groupId: undefined });
    const grouped3 = makeConversation({ groupId: 'work' });

    const { named, ungrouped } = groupConversations([
      grouped1,
      ungrouped1,
      grouped2,
      ungrouped2,
      grouped3,
    ]);

    // Ungrouped: 2 conversations
    expect(ungrouped).toHaveLength(2);
    expect(ungrouped.map((c) => c.id)).toContain(ungrouped1.id);
    expect(ungrouped.map((c) => c.id)).toContain(ungrouped2.id);

    // Named: 2 groups — 'personal' and 'work' (alphabetical: personal < work)
    expect(named.size).toBe(2);
    const keys = Array.from(named.keys());
    expect(keys).toEqual(['personal', 'work']);

    expect(named.get('work')).toHaveLength(2);
    expect(named.get('personal')).toHaveLength(1);
  });
});

describe('groupConversations — edge case: empty input', () => {
  it('returns empty ungrouped array and empty named Map for empty input', () => {
    const { named, ungrouped } = groupConversations([]);

    expect(ungrouped).toHaveLength(0);
    expect(named.size).toBe(0);
  });
});
