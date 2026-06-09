/**
 * Unit tests for archive/delete/group management logic — issue #18.
 *
 * Coverage:
 *   filterByArchiveStatus()
 *     - 'active' filter returns only conversations without archivedAt
 *     - 'archived' filter returns only conversations with archivedAt
 *     - empty list returns empty list for both filters
 *     - archivedAt = 0 (falsy timestamp) still counts as archived
 *
 *   deriveExistingGroups()
 *     - empty list → empty array
 *     - conversations without groupId → empty array
 *     - unique group names returned (no duplicates)
 *     - group names sorted alphabetically
 *     - groupId = '' (empty string) is not included
 *     - mixed: some with groupId, some without
 *
 *   resolveGroupInput()
 *     - blank string → undefined (clears group)
 *     - whitespace-only string → undefined
 *     - non-empty string → trimmed string
 *     - already-trimmed string → unchanged
 *     - leading/trailing whitespace stripped
 *
 *   isAllSelected()
 *     - empty available list → false (even with non-empty selected set)
 *     - all conversations selected → true
 *     - some conversations selected → false
 *     - no conversations selected → false
 *     - selected set contains IDs not in available list → still evaluates available only
 *
 * ThreadActionMenu state transitions (menu → confirm-delete, menu → group-input,
 * cancel → menu, outside-click → closed) are NOT tested here. Those states live
 * inside component-local useState; extracting them would require restructuring the
 * component into a reducer, which is out of scope for this session. Testing requires
 * @testing-library/react which is not in devDependencies.
 * Skipped tests below mark the boundary explicitly.
 *
 * BulkActionBar barState transitions (idle → confirm-delete, confirm → idle,
 * cancel → idle) are also component-local useState. Same constraint applies.
 */

import { describe, it, expect, test } from 'vitest';
import {
  filterByArchiveStatus,
  deriveExistingGroups,
  resolveGroupInput,
  isAllSelected,
} from './sidebarUtils';
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
  const id = `mgmt-conv-${++_nextId}`;
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

// ─── filterByArchiveStatus ────────────────────────────────────────────────────

describe('filterByArchiveStatus', () => {
  it('empty list returns empty list for active filter', () => {
    expect(filterByArchiveStatus([], 'active')).toHaveLength(0);
  });

  it('empty list returns empty list for archived filter', () => {
    expect(filterByArchiveStatus([], 'archived')).toHaveLength(0);
  });

  it('active filter returns only conversations without archivedAt', () => {
    const active1 = makeConversation();
    const active2 = makeConversation();
    const archived = makeConversation({ archivedAt: Date.now() });

    const result = filterByArchiveStatus([active1, archived, active2], 'active');
    expect(result).toHaveLength(2);
    expect(result).toContain(active1);
    expect(result).toContain(active2);
    expect(result).not.toContain(archived);
  });

  it('archived filter returns only conversations with archivedAt', () => {
    const active = makeConversation();
    const archived1 = makeConversation({ archivedAt: Date.now() - 1000 });
    const archived2 = makeConversation({ archivedAt: Date.now() - 5000 });

    const result = filterByArchiveStatus([active, archived1, archived2], 'archived');
    expect(result).toHaveLength(2);
    expect(result).toContain(archived1);
    expect(result).toContain(archived2);
    expect(result).not.toContain(active);
  });

  it('active filter with all-active list returns all', () => {
    const convs = [makeConversation(), makeConversation(), makeConversation()];
    expect(filterByArchiveStatus(convs, 'active')).toHaveLength(3);
  });

  it('active filter with all-archived list returns empty', () => {
    const convs = [
      makeConversation({ archivedAt: 1 }),
      makeConversation({ archivedAt: 2 }),
    ];
    expect(filterByArchiveStatus(convs, 'active')).toHaveLength(0);
  });

  it('archived filter with all-active list returns empty', () => {
    const convs = [makeConversation(), makeConversation()];
    expect(filterByArchiveStatus(convs, 'archived')).toHaveLength(0);
  });

  it('archivedAt = 0 (falsy timestamp) still counts as archived', () => {
    // timestamp 0 is a valid epoch value; the check is !== undefined, not truthiness
    const conv = makeConversation({ archivedAt: 0 });
    const activeResult = filterByArchiveStatus([conv], 'active');
    const archivedResult = filterByArchiveStatus([conv], 'archived');
    expect(activeResult).toHaveLength(0);
    expect(archivedResult).toHaveLength(1);
  });

  it('preserves original array order', () => {
    const a = makeConversation();
    const b = makeConversation();
    const c = makeConversation();
    const result = filterByArchiveStatus([a, b, c], 'active');
    expect(result).toEqual([a, b, c]);
  });
});

// ─── deriveExistingGroups ─────────────────────────────────────────────────────

describe('deriveExistingGroups', () => {
  it('empty list returns empty array', () => {
    expect(deriveExistingGroups([])).toEqual([]);
  });

  it('conversations without groupId return empty array', () => {
    const convs = [makeConversation(), makeConversation()];
    expect(deriveExistingGroups(convs)).toEqual([]);
  });

  it('unique group names — no duplicates', () => {
    const convs = [
      makeConversation({ groupId: 'work' }),
      makeConversation({ groupId: 'work' }),
      makeConversation({ groupId: 'personal' }),
    ];
    const result = deriveExistingGroups(convs);
    expect(result).toHaveLength(2);
    expect(result).toContain('work');
    expect(result).toContain('personal');
  });

  it('group names sorted alphabetically', () => {
    const convs = [
      makeConversation({ groupId: 'zzz' }),
      makeConversation({ groupId: 'aaa' }),
      makeConversation({ groupId: 'mmm' }),
    ];
    expect(deriveExistingGroups(convs)).toEqual(['aaa', 'mmm', 'zzz']);
  });

  it('mixed: some with groupId, some without', () => {
    const convs = [
      makeConversation({ groupId: 'work' }),
      makeConversation(),
      makeConversation({ groupId: 'personal' }),
      makeConversation(),
    ];
    const result = deriveExistingGroups(convs);
    expect(result).toHaveLength(2);
    expect(result).toEqual(['personal', 'work']);
  });

  it('empty-string groupId is excluded', () => {
    // Empty string is falsy — treated same as absent
    const convs = [makeConversation({ groupId: '' }), makeConversation({ groupId: 'real' })];
    const result = deriveExistingGroups(convs);
    expect(result).toEqual(['real']);
  });

  it('single conversation with groupId returns array of one', () => {
    const result = deriveExistingGroups([makeConversation({ groupId: 'solo' })]);
    expect(result).toEqual(['solo']);
  });

  it('does not mutate the input array', () => {
    const convs = [makeConversation({ groupId: 'grp' })];
    const before = convs.length;
    deriveExistingGroups(convs);
    expect(convs).toHaveLength(before);
  });
});

// ─── resolveGroupInput ────────────────────────────────────────────────────────

describe('resolveGroupInput', () => {
  it('blank string → undefined (clears group)', () => {
    expect(resolveGroupInput('')).toBeUndefined();
  });

  it('whitespace-only string → undefined', () => {
    expect(resolveGroupInput('   ')).toBeUndefined();
    expect(resolveGroupInput('\t')).toBeUndefined();
    expect(resolveGroupInput('\n')).toBeUndefined();
  });

  it('non-empty string → returns trimmed string', () => {
    expect(resolveGroupInput('work')).toBe('work');
  });

  it('leading whitespace stripped', () => {
    expect(resolveGroupInput('  work')).toBe('work');
  });

  it('trailing whitespace stripped', () => {
    expect(resolveGroupInput('work  ')).toBe('work');
  });

  it('surrounding whitespace stripped', () => {
    expect(resolveGroupInput('  my group  ')).toBe('my group');
  });

  it('already-trimmed string returned unchanged', () => {
    expect(resolveGroupInput('my group')).toBe('my group');
  });

  it('internal whitespace is preserved (only edges are trimmed)', () => {
    expect(resolveGroupInput('  my great group  ')).toBe('my great group');
  });
});

// ─── isAllSelected ────────────────────────────────────────────────────────────

describe('isAllSelected', () => {
  it('empty available list → false (even with non-empty selected set)', () => {
    const selected = new Set(['a', 'b', 'c']);
    expect(isAllSelected(selected, [])).toBe(false);
  });

  it('empty selected set, non-empty available → false', () => {
    const available = [makeConversation(), makeConversation()];
    expect(isAllSelected(new Set(), available)).toBe(false);
  });

  it('all conversations selected → true', () => {
    const a = makeConversation();
    const b = makeConversation();
    const c = makeConversation();
    const selected = new Set([a.id, b.id, c.id]);
    expect(isAllSelected(selected, [a, b, c])).toBe(true);
  });

  it('some conversations selected → false', () => {
    const a = makeConversation();
    const b = makeConversation();
    const c = makeConversation();
    const selected = new Set([a.id, b.id]);
    expect(isAllSelected(selected, [a, b, c])).toBe(false);
  });

  it('only one of many selected → false', () => {
    const convs = [makeConversation(), makeConversation(), makeConversation()];
    const selected = new Set([convs[0].id]);
    expect(isAllSelected(selected, convs)).toBe(false);
  });

  it('single available conversation selected → true', () => {
    const conv = makeConversation();
    expect(isAllSelected(new Set([conv.id]), [conv])).toBe(true);
  });

  it('selected set contains extra IDs not in available — counts only available', () => {
    const conv = makeConversation();
    // selected has conv.id plus some other IDs not in available
    const selected = new Set([conv.id, 'ghost-1', 'ghost-2']);
    expect(isAllSelected(selected, [conv])).toBe(true);
  });
});

// ─── Skipped: component state machine tests ───────────────────────────────────

describe('ThreadActionMenu state transitions', () => {
  test.skip('menu → confirm-delete on Delete click', () => {
    // Requires @testing-library/react (not in devDependencies) and jsdom.
    // menuState is component-local useState; cannot be tested without rendering.
    // To test without RTL: refactor ThreadActionMenu to accept state+dispatch as
    // props (or extract a useReducer with an exported reducer function), then test
    // the reducer directly. That refactor is deferred — out of scope for #18 tests.
  });

  test.skip('menu → group-input on "Move to group" click', () => {
    // Same constraint as above.
  });

  test.skip('cancel in confirm-delete returns to menu state', () => {
    // Same constraint as above.
  });

  test.skip('outside click closes menu (calls onClose)', () => {
    // Requires document.addEventListener simulation — needs jsdom.
  });
});

describe('BulkActionBar barState transitions', () => {
  test.skip('idle → confirm-delete on "Delete selected" click', () => {
    // barState is component-local useState inside BulkActionBar.
    // Testing requires @testing-library/react (not in devDependencies) and jsdom.
    // To test without RTL: extract a bulkBarReducer function and test it directly.
    // Deferred — out of scope for #18 tests.
  });

  test.skip('confirm-delete → idle on Cancel click', () => {
    // Same constraint as above.
  });

  test.skip('confirm-delete → idle after Delete confirmed (calls onBulkDelete)', () => {
    // Same constraint as above.
  });
});
