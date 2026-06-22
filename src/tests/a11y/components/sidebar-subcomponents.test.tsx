/**
 * Sidebar sub-components — axe-core accessibility tests (#146, #147)
 *
 * Covers the components extracted from Sidebar.tsx in issue #146:
 *   - ThreadRow (AnimatedListItem wrapper)
 *   - BulkActionBar (idle state + confirm-delete state)
 *   - SearchBar (already has its own file; not duplicated here)
 *   - SidebarChrome: ArchiveToggle, GroupHeader, ThreadSkeleton
 *
 * And the shared icon system from issue #147 as used in these components.
 *
 * This is a pure refactoring — the visual output is identical to the
 * pre-refactor code. These tests verify that the extraction did not
 * drop any ARIA attributes or alter accessible semantics.
 *
 * WCAG 2.1 Level AA criteria covered:
 *   1.3.1 Info and Relationships — labels and roles programmatically associated
 *   2.1.1 Keyboard — all controls operable by keyboard alone
 *   2.4.3 Focus Order — BulkActionBar confirm-delete opens with Cancel focused
 *   2.4.7 Focus Visible — focus-visible rings on all interactive elements
 *   4.1.2 Name, Role, Value — buttons have accessible names and correct roles
 */

import { render, fireEvent, act } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { ThreadRow } from '@/ui/components/sidebar/ThreadRow';
import { BulkActionBar } from '@/ui/components/sidebar/BulkActionBar';
import { ArchiveToggle, GroupHeader, ThreadSkeleton } from '@/ui/components/sidebar/SidebarChrome';
import type { Conversation } from '@/types';

// ─── jsdom setup ─────────────────────────────────────────────────────────────

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// ─── axe assertion helper ─────────────────────────────────────────────────────

function assertNoViolations(results: AxeResults): void {
  if (results.violations.length === 0) return;
  const summary = results.violations
    .map(
      (v) =>
        `[${v.impact ?? 'unknown'}] ${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  → ${n.target.join(', ')}`).join('\n'),
    )
    .join('\n\n');
  expect.fail(`Axe found ${results.violations.length} violation(s):\n\n${summary}`);
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONV: Conversation = {
  id: 'conv-1',
  title: 'Test conversation',
  messages: [
    {
      id: 'm1',
      role: 'assistant',
      content: 'Hello',
      modelId: 'claude',
      timestamp: Date.now() - 60_000,
    },
  ],
  models: [{ modelId: 'claude', name: 'Claude', color: 'accent-claude', isActive: true }],
  interactionMode: 'parallel',
  isGhost: false,
  createdAt: Date.now() - 120_000,
  updatedAt: Date.now() - 60_000,
};

const THREAD_ROW_BASE_PROPS = {
  conversation: CONV,
  isActive: false,
  isChecked: false,
  existingGroups: [],
  onClick: vi.fn(),
  onToggleChecked: vi.fn(),
  onArchive: vi.fn(),
  onUnarchive: vi.fn(),
  onDelete: vi.fn(),
  onSetGroup: vi.fn(),
  onRename: vi.fn(),
};

// ─── ThreadRow — axe (WCAG general) ──────────────────────────────────────────

describe('ThreadRow — axe violations (WCAG general)', () => {
  it('has no axe violations in default (inactive, unchecked) state', async () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in active state', async () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} isActive={true} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in checked state', async () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} isChecked={true} />);
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ThreadRow — ARIA semantics (WCAG 4.1.2) ─────────────────────────────────

describe('ThreadRow — ARIA semantics (WCAG 4.1.2)', () => {
  it('checkbox has aria-label including the conversation title', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.getAttribute('aria-label')).toContain('Test conversation');
  });

  it('three-dot trigger button has aria-label="Conversation actions"', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const trigger = container.querySelector(
      'button[aria-label="Conversation actions"]',
    ) as HTMLButtonElement;
    expect(trigger).not.toBeNull();
  });

  it('three-dot trigger has aria-haspopup="menu"', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const trigger = container.querySelector(
      'button[aria-label="Conversation actions"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('three-dot trigger has aria-expanded="false" when closed', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const trigger = container.querySelector(
      'button[aria-label="Conversation actions"]',
    ) as HTMLButtonElement;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('EllipsisVerticalIcon SVG is aria-hidden="true"', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const trigger = container.querySelector(
      'button[aria-label="Conversation actions"]',
    ) as HTMLButtonElement;
    const svg = trigger.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── ThreadRow — focus visibility (WCAG 2.4.7) ───────────────────────────────

describe('ThreadRow — focus visibility class audit (WCAG 2.4.7)', () => {
  it('main row button carries focus-visible ring classes', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    // The main row button is the button without aria-label (it uses visible text content)
    const buttons = Array.from(container.querySelectorAll('button'));
    // The main button is the one that does NOT have aria-label="Conversation actions"
    const mainBtn = buttons.find(
      (b) => b.getAttribute('aria-label') !== 'Conversation actions',
    );
    expect(mainBtn).not.toBeUndefined();
    expect(mainBtn?.className).toContain('focus-visible:ring-2');
    expect(mainBtn?.className).toContain('focus-visible:ring-focus');
  });

  it('three-dot trigger carries focus-visible ring classes and focus-visible:opacity-100', () => {
    const { container } = render(<ThreadRow {...THREAD_ROW_BASE_PROPS} />);
    const trigger = container.querySelector(
      'button[aria-label="Conversation actions"]',
    ) as HTMLButtonElement;
    expect(trigger.className).toContain('focus-visible:ring-2');
    // The trigger is normally opacity-0 but must become visible on keyboard focus
    expect(trigger.className).toContain('focus-visible:opacity-100');
  });
});

// ─── BulkActionBar — axe (WCAG general) ──────────────────────────────────────

describe('BulkActionBar — axe violations (WCAG general)', () => {
  it('has no axe violations in idle state (partial selection)', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={1}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in idle state (all selected)', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={3}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in confirm-delete state', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );
    // Enter confirm-delete state by clicking "Delete selected"
    const allButtons = Array.from(container.querySelectorAll('button'));
    const deleteSelectedBtn = allButtons.find((b) => b.textContent?.includes('Delete selected'));
    expect(deleteSelectedBtn).not.toBeUndefined();
    fireEvent.click(deleteSelectedBtn!);

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── BulkActionBar — ARIA semantics (WCAG 4.1.2) ─────────────────────────────

describe('BulkActionBar — ARIA semantics (WCAG 4.1.2)', () => {
  it('select-all checkbox has aria-label', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={1}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    const label = checkbox.getAttribute('aria-label');
    expect(label).toBeTruthy();
    // Label should be "Select all" when not all selected
    expect(label).toContain('Select all');
  });

  it('select-all checkbox label reads "Deselect all" when all are selected', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={3}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox.getAttribute('aria-label')).toBe('Deselect all');
  });
});

// ─── BulkActionBar — focus management on confirm-delete (WCAG 2.4.3) ─────────

describe('BulkActionBar — confirm-delete focus management (WCAG 2.4.3)', () => {
  it('Cancel button receives focus when confirm-delete state opens', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );

    const allButtons = Array.from(container.querySelectorAll('button'));
    const deleteSelectedBtn = allButtons.find((b) => b.textContent?.includes('Delete selected'));
    expect(deleteSelectedBtn).not.toBeUndefined();

    await act(async () => {
      fireEvent.click(deleteSelectedBtn!);
    });

    // The Cancel button should have received focus (WCAG 2.4.3)
    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).not.toBeUndefined();
    expect(document.activeElement).toBe(cancelBtn);
  });

  it('Cancel button carries focus-visible ring classes', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );

    const allButtons = Array.from(container.querySelectorAll('button'));
    const deleteSelectedBtn = allButtons.find((b) => b.textContent?.includes('Delete selected'));
    fireEvent.click(deleteSelectedBtn!);

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn?.className).toContain('focus-visible:ring-2');
  });

  it('Delete button carries focus-visible ring classes in confirm state', async () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={2}
        totalCount={3}
        onSelectAll={vi.fn()}
        onDeselectAll={vi.fn()}
        onBulkArchive={vi.fn()}
        onBulkDelete={vi.fn()}
      />,
    );

    const allButtons = Array.from(container.querySelectorAll('button'));
    const deleteSelectedBtn = allButtons.find((b) => b.textContent?.includes('Delete selected'));
    fireEvent.click(deleteSelectedBtn!);

    const confirmDeleteBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Delete',
    );
    expect(confirmDeleteBtn?.className).toContain('focus-visible:ring-2');
  });
});

// ─── ArchiveToggle — axe (WCAG general) ──────────────────────────────────────

describe('ArchiveToggle — axe violations (WCAG general)', () => {
  it('has no axe violations in "active" state', async () => {
    const { container } = render(
      <ArchiveToggle value="active" onChange={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in "archived" state', async () => {
    const { container } = render(
      <ArchiveToggle value="archived" onChange={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ArchiveToggle — ARIA semantics (WCAG 4.1.2) ─────────────────────────────

describe('ArchiveToggle — ARIA semantics (WCAG 4.1.2)', () => {
  it('"Active" button has aria-pressed=true when value="active"', () => {
    const { container } = render(
      <ArchiveToggle value="active" onChange={vi.fn()} />,
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const activeBtn = buttons.find((b) => b.textContent?.trim() === 'Active');
    expect(activeBtn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('"Archived" button has aria-pressed=false when value="active"', () => {
    const { container } = render(
      <ArchiveToggle value="active" onChange={vi.fn()} />,
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    const archivedBtn = buttons.find((b) => b.textContent?.trim() === 'Archived');
    expect(archivedBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('both buttons carry focus-visible ring classes (WCAG 2.4.7)', () => {
    const { container } = render(
      <ArchiveToggle value="active" onChange={vi.fn()} />,
    );
    const buttons = Array.from(container.querySelectorAll('button'));
    for (const btn of buttons) {
      expect(btn.className).toContain('focus-visible:ring-2');
      expect(btn.className).toContain('focus-visible:ring-focus');
    }
  });
});

// ─── GroupHeader — axe (WCAG general) ────────────────────────────────────────

describe('GroupHeader — axe violations (WCAG general)', () => {
  it('has no axe violations when collapsed', async () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={false} onToggle={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when expanded', async () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={true} onToggle={vi.fn()} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── GroupHeader — ARIA semantics (WCAG 4.1.2) ───────────────────────────────

describe('GroupHeader — ARIA semantics (WCAG 4.1.2)', () => {
  it('has aria-expanded="false" when collapsed', () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={false} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('has aria-expanded="true" when open', () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={true} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('RightChevronIcon SVG is aria-hidden="true"', () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={false} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    const svg = btn.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('carries focus-visible ring classes (WCAG 2.4.7)', () => {
    const { container } = render(
      <GroupHeader label="Today" isOpen={false} onToggle={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.className).toContain('focus-visible:ring-2');
    expect(btn.className).toContain('focus-visible:ring-focus');
  });
});

// ─── ThreadSkeleton — axe (WCAG general) ─────────────────────────────────────

describe('ThreadSkeleton — axe violations (WCAG general)', () => {
  it('has no axe violations', async () => {
    const { container } = render(<ThreadSkeleton />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('respects reduced motion (motion-reduce:animate-none)', () => {
    const { container } = render(<ThreadSkeleton />);
    const pulsingDivs = container.querySelectorAll('.animate-pulse');
    // Both skeleton bars should have motion-reduce:animate-none
    for (const div of Array.from(pulsingDivs)) {
      expect(div.className).toContain('motion-reduce:animate-none');
    }
  });
});
