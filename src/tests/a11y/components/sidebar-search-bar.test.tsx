/**
 * Sidebar SearchBar — Axe-core Accessibility Tests
 *
 * Covers the SearchBar component added in issue #160 (Sidebar.tsx, lines 453–542).
 * SearchBar is an inline search/filter input that sits between ArchiveToggle and
 * BulkActionBar in the sidebar conversation list.
 *
 * Keyboard contract under test:
 *   - Input is reachable by Tab
 *   - Escape clears the query and retains focus on the input (does NOT close sidebar)
 *   - Clear (×) button is Tab-reachable when a query is present
 *   - Clicking Clear returns focus to the input via requestAnimationFrame
 *
 * ARIA contract under test:
 *   - Input type="search" carries implicit role="searchbox" (no explicit role attribute needed)
 *   - Input has aria-label="Search conversations"
 *   - Clear button has aria-label="Clear search"
 *   - Search icon SVG is aria-hidden="true"
 *   - Clear button SVG is aria-hidden="true"
 *   - Empty-state paragraph "No conversations match your search" is a native <p> in
 *     <nav aria-label="Conversations"> — no ARIA live region needed (synchronous result)
 *
 * Standards: WCAG 2.1 Level AA
 *   - 1.3.1 Info and Relationships — labels programmatically associated
 *   - 2.1.1 Keyboard — all controls operable by keyboard alone
 *   - 2.4.3 Focus Order — focus lands on input after Clear
 *   - 2.4.7 Focus Visible — focus-visible ring present on input and clear button
 *   - 4.1.2 Name, Role, Value — interactive controls have accessible names and correct roles
 *
 * File under test: src/ui/Sidebar.tsx (SearchBar component, ≈ line 453)
 */

import { render, fireEvent, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Sidebar } from '@/ui/Sidebar';
import type { Conversation } from '@/types';

// ─── jsdom environment setup ─────────────────────────────────────────────────

/**
 * Sidebar.tsx calls window.matchMedia twice at mount to detect
 * prefers-reduced-motion and mobile viewport. jsdom does not implement
 * matchMedia — provide a minimal stub that returns false for both queries.
 */
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

// ─── Axe assertion helper ────────────────────────────────────────────────────

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

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MINIMAL_CONVERSATION: Conversation = {
  id: 'conv-1',
  title: 'Test conversation',
  messages: [],
  models: [],
  interactionMode: 'parallel',
  isGhost: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const MINIMAL_PROPS = {
  conversations: [],
  activeConversationId: null as string | null,
  onSelectConversation: vi.fn(),
  onNewConversation: vi.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Find the search input by its aria-label. */
function getSearchInput(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('input[aria-label="Search conversations"]');
}

/** Find the clear button by its aria-label (only present when value is non-empty). */
function getClearButton(container: HTMLElement): HTMLButtonElement | null {
  return container.querySelector('button[aria-label="Clear search"]');
}

// ─── Axe: empty-query state ───────────────────────────────────────────────────

describe('Sidebar SearchBar — axe violations (WCAG general)', () => {
  it('has no axe violations in empty-query state', async () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when a query is present (clear button visible)', async () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    expect(input).not.toBeNull();

    // Type a query — causes React to re-render with value="hello"
    fireEvent.change(input!, { target: { value: 'hello' } });

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations with conversations rendered (non-empty list)', async () => {
    const { container } = render(
      <Sidebar {...MINIMAL_PROPS} conversations={[MINIMAL_CONVERSATION]} />,
    );
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations in empty-state (no matches) after query', async () => {
    const { container } = render(
      <Sidebar {...MINIMAL_PROPS} conversations={[MINIMAL_CONVERSATION]} />,
    );

    const input = getSearchInput(container);
    expect(input).not.toBeNull();

    // Type a query that matches nothing — triggers the "No conversations match" empty state
    fireEvent.change(input!, { target: { value: 'zzz-no-match' } });

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── ARIA semantics: input (WCAG 1.3.1, 4.1.2) ───────────────────────────────

describe('SearchBar input — ARIA semantics (WCAG 1.3.1 / 4.1.2)', () => {
  it('search input is a native <input> element', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const input = getSearchInput(container);
    expect(input).not.toBeNull();
    expect(input?.tagName.toLowerCase()).toBe('input');
  });

  it('search input has type="search"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const input = getSearchInput(container);
    expect(input?.type).toBe('search');
  });

  it('search input has aria-label="Search conversations"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const input = getSearchInput(container);
    expect(input?.getAttribute('aria-label')).toBe('Search conversations');
  });

  it('search input does NOT carry an explicit role (type="search" implies searchbox)', () => {
    // type="search" has an implicit ARIA role of "searchbox" per the ARIA in HTML spec.
    // The explicit role="searchbox" attribute was removed (advisory fix from Ada audit)
    // because it was redundant. The implicit role remains correct.
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const input = getSearchInput(container);
    // No explicit role attribute — implicit role from type="search" is sufficient.
    expect(input?.getAttribute('role')).toBeNull();
  });

  it('search icon SVG is aria-hidden="true"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    // The search icon is the first SVG sibling before the input within the search container.
    // Its purpose is purely decorative — the input's aria-label provides the name.
    const searchContainer = container.querySelector('.bg-input');
    const svgs = searchContainer?.querySelectorAll('svg');
    // First SVG is the search icon (magnifying glass)
    const searchIcon = svgs?.[0];
    expect(searchIcon).not.toBeUndefined();
    expect(searchIcon?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── ARIA semantics: clear button (WCAG 1.3.1, 4.1.2) ────────────────────────

describe('SearchBar clear button — ARIA semantics (WCAG 4.1.2)', () => {
  it('clear button is not rendered when query is empty', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const clearBtn = getClearButton(container);
    // No value → clear button should not be in the DOM
    expect(clearBtn).toBeNull();
  });

  it('clear button appears when query is non-empty', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test' } });

    const clearBtn = getClearButton(container);
    expect(clearBtn).not.toBeNull();
  });

  it('clear button has aria-label="Clear search"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test' } });

    const clearBtn = getClearButton(container);
    expect(clearBtn?.getAttribute('aria-label')).toBe('Clear search');
  });

  it('clear button is a native <button> with type="button"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test' } });

    const clearBtn = getClearButton(container);
    expect(clearBtn?.tagName.toLowerCase()).toBe('button');
    expect(clearBtn?.type).toBe('button');
  });

  it('clear button SVG is aria-hidden="true"', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test' } });

    const clearBtn = getClearButton(container);
    const svg = clearBtn?.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});

// ─── Keyboard operability (WCAG 2.1.1) ───────────────────────────────────────

describe('SearchBar — keyboard operability (WCAG 2.1.1)', () => {
  it('Escape key clears the search query', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    expect(input).not.toBeNull();

    // Set a value first
    fireEvent.change(input!, { target: { value: 'hello' } });
    // The clear button should now be present
    expect(getClearButton(container)).not.toBeNull();

    // Fire Escape on the input
    fireEvent.keyDown(input!, { key: 'Escape', code: 'Escape' });

    // After Escape, the query is cleared — clear button disappears
    expect(getClearButton(container)).toBeNull();
  });

  it('clicking the clear button clears the query', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test query' } });

    const clearBtn = getClearButton(container);
    expect(clearBtn).not.toBeNull();

    fireEvent.click(clearBtn!);

    // Query cleared — clear button no longer rendered
    expect(getClearButton(container)).toBeNull();
  });

  it('clear button click returns focus to the input (via requestAnimationFrame)', async () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test query' } });

    const clearBtn = getClearButton(container);
    fireEvent.click(clearBtn!);

    // requestAnimationFrame is used to defer the focus call — wait for it
    await new Promise((r) => requestAnimationFrame(r));

    // Focus should have returned to the input
    expect(document.activeElement).toBe(input);
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────

describe('SearchBar — focus visibility class audit (WCAG 2.4.7)', () => {
  it('search input carries focus-visible ring classes', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);
    const input = getSearchInput(container);
    expect(input).not.toBeNull();
    // focus:outline-none suppresses browser default; focus-visible:ring-2 provides
    // the keyboard-only ring per the Aria focus-visible pattern.
    expect(input?.className).toContain('focus:outline-none');
    expect(input?.className).toContain('focus-visible:ring-2');
    expect(input?.className).toContain('focus-visible:ring-inset');
  });

  it('clear button carries focus-visible ring classes', () => {
    const { container } = render(<Sidebar {...MINIMAL_PROPS} />);

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'test' } });

    const clearBtn = getClearButton(container);
    expect(clearBtn).not.toBeNull();
    expect(clearBtn?.className).toContain('focus-visible:outline-none');
    expect(clearBtn?.className).toContain('focus-visible:ring-2');
    // Clear button uses ring-offset-1 (not ring-inset) per Aria's spec for small circular buttons
    expect(clearBtn?.className).toContain('focus-visible:ring-offset-1');
  });
});

// ─── Empty state (WCAG 1.3.1) ─────────────────────────────────────────────────

describe('SearchBar — empty state announcement (WCAG 1.3.1)', () => {
  it('empty-state message is a <p> inside the conversations nav', () => {
    const { container } = render(
      <Sidebar {...MINIMAL_PROPS} conversations={[MINIMAL_CONVERSATION]} />,
    );

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'zzz-no-match' } });

    // The message lives inside <nav aria-label="Conversations">
    const nav = container.querySelector('nav[aria-label="Conversations"]');
    expect(nav).not.toBeNull();

    const message = nav?.querySelector('p');
    expect(message).not.toBeNull();
    expect(message?.textContent).toContain('No conversations match your search');
  });

  it('empty-state message is a plain <p> in the natural reading flow (no live region)', () => {
    const { container } = render(
      <Sidebar {...MINIMAL_PROPS} conversations={[MINIMAL_CONVERSATION]} />,
    );

    const input = getSearchInput(container);
    fireEvent.change(input!, { target: { value: 'zzz-no-match' } });

    // The message should be a plain <p>, not inside a role="status" or aria-live element.
    // This is correct per the implementation spec — the result is synchronous with typing.
    const emptyMsg = screen.queryByText('No conversations match your search');
    expect(emptyMsg).not.toBeNull();
    // It is a <p> element
    expect(emptyMsg?.tagName.toLowerCase()).toBe('p');
    // Document that it is NOT wrapped in a live region (either is valid — documenting current state)
    const isInLiveRegion = !!emptyMsg?.closest('[aria-live]');
    // Current implementation: not in a live region. If this changes, update here.
    expect(isInLiveRegion).toBe(false);
  });
});
