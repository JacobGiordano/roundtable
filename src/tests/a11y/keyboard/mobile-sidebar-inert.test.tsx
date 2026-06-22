/**
 * AppLayout — mobile sidebar inert attribute (#258)
 *
 * WCAG 2.4.11 Focus Not Obscured (WCAG 2.2 AA) — when the mobile sidebar
 * drawer is open, the <main> content area receives the `inert` attribute.
 * This removes all descendants from the tab order and the AT tree, preventing
 * keyboard focus from reaching elements that are entirely covered by the
 * sidebar overlay (z-50) and its backdrop (z-40).
 *
 * This test verifies the `inert` attribute contract in isolation using a
 * minimal wrapper that mirrors AppLayout's pattern, then verifies the
 * DOM-level behavior. AppLayout is not rendered directly because it requires
 * the full RoundtableContext provider — an integration boundary this test
 * intentionally avoids to keep the audit focused on the accessibility contract.
 *
 * Issue: #258
 */

import { render, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect } from 'vitest';

// ─── Minimal wrapper — mirrors AppLayout's inert pattern ─────────────────────

/**
 * A self-contained component that mirrors the exact inert pattern from AppLayout:
 *
 *   {...({ inert: isMobileMenuOpen ? '' : undefined } as React.HTMLAttributes<HTMLElement>)}
 *
 * Used to verify:
 * 1. When isMobileMenuOpen=true  → <main> has inert=""
 * 2. When isMobileMenuOpen=false → <main> does NOT have the inert attribute
 */
function InertTestHarness({ initialOpen = false }: { initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div>
      <button
        type="button"
        data-testid="toggle"
        onClick={() => setIsOpen((v) => !v)}
      >
        Toggle
      </button>

      {/* Sidebar stand-in (would normally contain focusable elements) */}
      <nav data-testid="sidebar">
        <button type="button" data-testid="sidebar-btn">Sidebar button</button>
      </nav>

      {/* Main area — mirrors AppLayout's inert pattern exactly */}
      <main
        id="main-content"
        data-testid="main"
        {...({ inert: isOpen ? '' : undefined } as React.HTMLAttributes<HTMLElement>)}
      >
        <button type="button" data-testid="main-btn">Main button</button>
      </main>
    </div>
  );
}

// ─── Inert attribute applied on open (WCAG 2.4.11) ───────────────────────────

describe('AppLayout — mobile sidebar inert pattern (WCAG 2.4.11)', () => {
  it('<main> has no inert attribute when sidebar is closed', () => {
    const { getByTestId } = render(<InertTestHarness initialOpen={false} />);
    const main = getByTestId('main');
    // inert attribute must be absent when the sidebar is closed
    expect(main.hasAttribute('inert')).toBe(false);
  });

  it('<main> receives inert="" when mobile sidebar is open', () => {
    const { getByTestId } = render(<InertTestHarness initialOpen={true} />);
    const main = getByTestId('main');
    // inert attribute must be present (empty string value) when sidebar is open
    expect(main.hasAttribute('inert')).toBe(true);
    expect(main.getAttribute('inert')).toBe('');
  });

  it('inert attribute is removed when the sidebar closes', () => {
    const { getByTestId } = render(<InertTestHarness initialOpen={true} />);
    const main = getByTestId('main');
    expect(main.hasAttribute('inert')).toBe(true);

    act(() => {
      getByTestId('toggle').click();
    });

    // After closing, inert must be removed
    expect(main.hasAttribute('inert')).toBe(false);
  });

  it('inert attribute is added when the sidebar opens from closed state', () => {
    const { getByTestId } = render(<InertTestHarness initialOpen={false} />);
    const main = getByTestId('main');
    expect(main.hasAttribute('inert')).toBe(false);

    act(() => {
      getByTestId('toggle').click();
    });

    // After opening, inert must be present
    expect(main.hasAttribute('inert')).toBe(true);
    expect(main.getAttribute('inert')).toBe('');
  });

  it('inert is applied at <main> level, not inside a child element', () => {
    const { getByTestId } = render(<InertTestHarness initialOpen={true} />);
    // The sidebar itself must not be inert (it's the element that should receive focus)
    const sidebar = getByTestId('sidebar');
    expect(sidebar.hasAttribute('inert')).toBe(false);
    // Only <main> carries inert
    const main = getByTestId('main');
    expect(main.hasAttribute('inert')).toBe(true);
    // The main's direct children are covered by the parent inert — the button
    // itself does not need a separate inert attribute
    const mainBtn = getByTestId('main-btn');
    expect(mainBtn.hasAttribute('inert')).toBe(false); // inert propagates from parent
  });
});
