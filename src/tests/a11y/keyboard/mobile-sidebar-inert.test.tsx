/**
 * Sidebar — aside inert + Escape key handler (#260)
 *
 * WCAG 2.4.3 Focus Order — when the mobile sidebar drawer is closed and the
 * viewport is mobile (< 768px), the <aside> element receives `inert=""`. This
 * removes all descendants from the tab order and the AT tree, preventing keyboard
 * focus from reaching elements that are visually off-screen (-translate-x-full).
 * On desktop (isMobile=false) the inert attribute must never be applied because
 * the sidebar is always visible.
 *
 * WCAG 2.1.2 No Keyboard Trap (Escape dismiss) — when the mobile drawer is open,
 * pressing Escape calls onMobileClose() and restores focus to the hamburger trigger
 * button (mobileMenuTriggerRef).
 *
 * These tests use a minimal harness that mirrors Sidebar's isMobile useState +
 * inert spread pattern and the Escape useEffect. Sidebar itself requires the full
 * RoundtableContext provider chain — this harness isolates the accessibility
 * contract under test without that integration overhead.
 *
 * Issue: #260
 */

import { render, act, fireEvent } from '@testing-library/react';
import { useState, useEffect, useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';

// ─── Minimal harness — mirrors Sidebar's #260 inert + Escape patterns ─────────

/**
 * SidebarInertHarness mirrors two Sidebar behaviors from #260:
 *
 * 1. Inert on <aside> when isMobile && !isMobileOpen:
 *      {...(isMobile && !isMobileOpen ? ({ inert: '' } as React.HTMLAttributes<HTMLElement>) : {})}
 *
 * 2. Escape key handler on document (when isMobileOpen is true):
 *      calls onMobileClose() and double-rAF focuses mobileMenuTriggerRef.current
 *
 * isMobileOverride allows tests to inject a fixed mobile/desktop state instead
 * of relying on matchMedia (not available in jsdom).
 */
function SidebarInertHarness({
  initialOpen = false,
  isMobileOverride,
  onMobileClose,
  mobileMenuTriggerRef,
}: {
  initialOpen?: boolean;
  isMobileOverride?: boolean;
  onMobileClose?: () => void;
  mobileMenuTriggerRef?: React.RefObject<HTMLButtonElement>;
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(initialOpen);
  // Allow external isMobile override; fall back to matchMedia (always false in jsdom)
  const isMobile =
    isMobileOverride !== undefined
      ? isMobileOverride
      : typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 767px)').matches
        : false;

  // Mirror Sidebar's Escape handler (#260)
  useEffect(() => {
    if (!isMobileOpen) return;

    function handleEscape(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      const close = onMobileClose ?? (() => setIsMobileOpen(false));
      close();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          mobileMenuTriggerRef?.current?.focus();
        });
      });
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMobileOpen, onMobileClose, mobileMenuTriggerRef]);

  return (
    <div>
      {/* Trigger button — focus-return target (stands in for hamburger in AppLayout) */}
      <button
        ref={mobileMenuTriggerRef as React.RefObject<HTMLButtonElement> | undefined}
        type="button"
        data-testid="hamburger"
        onClick={() => setIsMobileOpen(true)}
      >
        Open menu
      </button>

      {/* Aside — mirrors Sidebar's inert spread */}
      <aside
        data-testid="sidebar-aside"
        {...(isMobile && !isMobileOpen ? ({ inert: '' } as React.HTMLAttributes<HTMLElement>) : {})}
      >
        <button type="button" data-testid="sidebar-btn">Sidebar button</button>
        <button type="button" data-testid="close-btn" onClick={() => setIsMobileOpen(false)}>
          Close
        </button>
      </aside>
    </div>
  );
}

// ─── WCAG 2.4.3 — aside inert when mobile drawer is closed (#260) ─────────────

describe('Sidebar — aside inert on mobile when closed (WCAG 2.4.3, #260)', () => {
  it('<aside> has inert="" when isMobile=true and isMobileOpen=false', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={false} isMobileOverride={true} />,
    );
    const aside = getByTestId('sidebar-aside');
    expect(aside.hasAttribute('inert')).toBe(true);
    expect(aside.getAttribute('inert')).toBe('');
  });

  it('<aside> does NOT have inert when isMobile=true and isMobileOpen=true', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={true} isMobileOverride={true} />,
    );
    const aside = getByTestId('sidebar-aside');
    expect(aside.hasAttribute('inert')).toBe(false);
  });

  it('<aside> inert is removed when drawer opens from closed state', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={false} isMobileOverride={true} />,
    );
    const aside = getByTestId('sidebar-aside');
    // Starts inert (closed on mobile)
    expect(aside.hasAttribute('inert')).toBe(true);

    act(() => {
      getByTestId('hamburger').click();
    });

    // After opening, inert must be gone
    expect(aside.hasAttribute('inert')).toBe(false);
  });

  it('<aside> inert is re-applied when drawer closes', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={true} isMobileOverride={true} />,
    );
    const aside = getByTestId('sidebar-aside');
    // Starts without inert (open)
    expect(aside.hasAttribute('inert')).toBe(false);

    act(() => {
      getByTestId('close-btn').click();
    });

    // After closing on mobile, inert must be applied
    expect(aside.hasAttribute('inert')).toBe(true);
    expect(aside.getAttribute('inert')).toBe('');
  });
});

// ─── WCAG 2.4.3 — no inert on desktop (#260) ──────────────────────────────────

describe('Sidebar — no inert on desktop viewport (WCAG 2.4.3, #260)', () => {
  it('<aside> does NOT have inert when isMobile=false and isMobileOpen=false', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={false} isMobileOverride={false} />,
    );
    const aside = getByTestId('sidebar-aside');
    // Desktop: sidebar always visible — inert must never be applied
    expect(aside.hasAttribute('inert')).toBe(false);
  });

  it('<aside> does NOT have inert when isMobile=false and isMobileOpen=true', () => {
    const { getByTestId } = render(
      <SidebarInertHarness initialOpen={true} isMobileOverride={false} />,
    );
    const aside = getByTestId('sidebar-aside');
    expect(aside.hasAttribute('inert')).toBe(false);
  });
});

// ─── WCAG 2.1.2 — Escape closes drawer + restores focus (#260) ───────────────

describe('Sidebar — Escape key closes drawer and restores focus (WCAG 2.1.2, #260)', () => {
  it('Escape calls onMobileClose when the drawer is open', () => {
    const onMobileClose = vi.fn();
    render(
      <SidebarInertHarness
        initialOpen={true}
        isMobileOverride={true}
        onMobileClose={onMobileClose}
      />,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(onMobileClose).toHaveBeenCalledTimes(1);
  });

  it('Escape does NOT call onMobileClose when the drawer is closed', () => {
    const onMobileClose = vi.fn();
    render(
      <SidebarInertHarness
        initialOpen={false}
        isMobileOverride={true}
        onMobileClose={onMobileClose}
      />,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(onMobileClose).not.toHaveBeenCalled();
  });

  it('Escape calls .focus() on mobileMenuTriggerRef.current via double-rAF', async () => {
    // jsdom's requestAnimationFrame uses a real animation frame queue that never
    // fires in a Node.js process (no rendering loop). We verify the contract by
    // spying on the button's focus() method rather than asserting document.activeElement,
    // which would require rAF to actually execute. This is a faithful test of the
    // focus-return contract: the handler must call .focus() on the trigger ref.

    // Render a wrapper that gives us access to the button element before mounting
    let capturedButton: HTMLButtonElement | null = null;

    function HarnessWithSpy() {
      const triggerRef = useRef<HTMLButtonElement>(null);

      // Capture the ref after first render so we can spy on it
      useEffect(() => {
        capturedButton = triggerRef.current;
      }, []);

      return (
        <SidebarInertHarness
          initialOpen={true}
          isMobileOverride={true}
          mobileMenuTriggerRef={triggerRef}
        />
      );
    }

    render(<HarnessWithSpy />);

    // Wait for useEffect to run and capture the button ref
    await act(async () => {});

    expect(capturedButton).not.toBeNull();
    const focusSpy = vi.spyOn(capturedButton!, 'focus');

    // Override rAF to call synchronously so the double-rAF executes immediately
    const originalRaf = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    };

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    window.requestAnimationFrame = originalRaf;

    expect(focusSpy).toHaveBeenCalledTimes(1);
    focusSpy.mockRestore();
  });

  it('non-Escape keys do not trigger onMobileClose', () => {
    const onMobileClose = vi.fn();
    render(
      <SidebarInertHarness
        initialOpen={true}
        isMobileOverride={true}
        onMobileClose={onMobileClose}
      />,
    );

    act(() => {
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Tab' });
      fireEvent.keyDown(document, { key: ' ' });
    });

    expect(onMobileClose).not.toHaveBeenCalled();
  });
});

// ─── AppLayout — mobile sidebar inert attribute (#258) ───────────────────────
//
// The block below is the original #258 test suite. It remains unchanged.
// These 5 tests verify `inert` on <main> (WCAG 2.4.11 Focus Not Obscured).
// The #260 tests above extend this file with the <aside> inert contract and
// the Escape-key / focus-return contract.
// ─────────────────────────────────────────────────────────────────────────────

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
