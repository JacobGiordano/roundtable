/**
 * Tests for ExportButton.tsx (Aria)
 *
 * Covers:
 *   Render:
 *     - Renders without crashing
 *     - Button has correct aria-label ("Export conversation")
 *     - Button is not disabled by default
 *     - Button is disabled when disabled=true
 *     - Popover is closed (not in DOM) on initial render
 *
 *   Popover open/close:
 *     - Clicking the button opens the format popover
 *     - aria-expanded reflects the open/closed state
 *     - Clicking the button again (toggle) closes the popover
 *     - Clicking outside closes the popover
 *     - Pressing Escape closes the popover
 *     - Disabled button does not open the popover on click
 *
 *   Format selection:
 *     - Clicking "Download as Markdown" calls onExport('markdown')
 *     - Clicking "Download as HTML" calls onExport('html')
 *     - Selecting a format closes the popover
 *     - onExport is not called when the popover closes via Escape
 *     - onExport is not called when the popover closes via outside click
 *
 *   Keyboard navigation (#281 — WAI-ARIA menu pattern):
 *     - Escape returns focus to the trigger button
 *     - ArrowDown moves focus to the next menu item
 *     - ArrowDown wraps from last to first item
 *     - ArrowUp moves focus to the previous menu item
 *     - ArrowUp wraps from first to last item
 *
 * Component interface (from ExportButton.tsx):
 *   onExport: (format: ExportFormat) => void
 *   disabled?: boolean
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from './ExportButton';
import type { ExportOptions } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderButton(props: { onExport?: ReturnType<typeof vi.fn>; disabled?: boolean } = {}) {
  const onExport = props.onExport ?? vi.fn();
  const { unmount } = render(
    <ExportButton onExport={onExport} disabled={props.disabled} />,
  );
  return { onExport, unmount };
}

function getExportButton() {
  return screen.getByRole('button', { name: /export conversation/i });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Render ───────────────────────────────────────────────────────────────────

describe('ExportButton — render', () => {
  it('renders without crashing', () => {
    expect(() => renderButton()).not.toThrow();
  });

  it('renders a button with aria-label "Export conversation"', () => {
    renderButton();
    expect(getExportButton()).toBeDefined();
  });

  it('button is not disabled by default', () => {
    renderButton();
    expect((getExportButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('button is disabled when disabled prop is true', () => {
    renderButton({ disabled: true });
    expect((getExportButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('popover menu is not visible on initial render', () => {
    renderButton();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('button has aria-haspopup="menu"', () => {
    renderButton();
    expect(getExportButton().getAttribute('aria-haspopup')).toBe('menu');
  });

  it('button has aria-expanded="false" when popover is closed', () => {
    renderButton();
    expect(getExportButton().getAttribute('aria-expanded')).toBe('false');
  });
});

// ─── Popover open/close ───────────────────────────────────────────────────────

describe('ExportButton — popover open/close', () => {
  it('clicking the button opens the format popover', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('aria-expanded becomes "true" when the popover is open', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(getExportButton().getAttribute('aria-expanded')).toBe('true');
  });

  it('clicking the button again closes the popover (toggle behavior)', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menu')).toBeDefined();
    await userEvent.click(getExportButton());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('pressing Escape closes the popover', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menu')).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('clicking outside the popover closes it', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menu')).toBeDefined();
    // Simulate a mousedown event outside the component (hook uses mousedown, #149).
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('disabled button does not open the popover on click', async () => {
    renderButton({ disabled: true });
    await userEvent.click(getExportButton());
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('aria-expanded stays "false" when disabled button is clicked', async () => {
    renderButton({ disabled: true });
    await userEvent.click(getExportButton());
    expect(getExportButton().getAttribute('aria-expanded')).toBe('false');
  });
});

// ─── Format selection ─────────────────────────────────────────────────────────

describe('ExportButton — format selection', () => {
  it('popover contains "Download as Markdown" and "Download as HTML" options', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menuitem', { name: /download as markdown/i })).toBeDefined();
    expect(screen.getByRole('menuitem', { name: /download as html/i })).toBeDefined();
  });

  it('clicking "Download as Markdown" calls onExport with "markdown" and default options', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as markdown/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const expectedOptions: ExportOptions = { includeGeneratedImages: false };
    expect(onExport).toHaveBeenCalledWith('markdown', expectedOptions);
  });

  it('clicking "Download as HTML" calls onExport with "html" and default options', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as html/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const expectedOptions: ExportOptions = { includeGeneratedImages: false };
    expect(onExport).toHaveBeenCalledWith('html', expectedOptions);
  });

  it('clicking "Download as Markdown" with includeGeneratedImages on passes options', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    // Enable the generated-images toggle.
    const checkbox = screen.getByRole('checkbox', { name: /include generated images/i });
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole('menuitem', { name: /download as markdown/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    const expectedOptions: ExportOptions = { includeGeneratedImages: true };
    expect(onExport).toHaveBeenCalledWith('markdown', expectedOptions);
  });

  it('selecting a format closes the popover', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as markdown/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closing with Escape does not call onExport', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.keyboard('{Escape}');
    expect(onExport).not.toHaveBeenCalled();
  });

  it('closing via outside click does not call onExport', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    fireEvent.mouseDown(document.body);
    expect(onExport).not.toHaveBeenCalled();
  });

  it('onExport is called once per format selection (not double-fired)', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as html/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});

// ─── Keyboard navigation (#281 — WAI-ARIA menu pattern) ───────────────────────

describe('ExportButton — keyboard navigation', () => {
  // Helper: open the menu, then explicitly focus the given menuitem index.
  // The document-level capture listener fires regardless of current focus, so
  // these tests don't depend on the double-rAF completing before key dispatch.
  async function openAndFocusItem(itemIndex: number) {
    await userEvent.click(getExportButton());
    const items = screen.getAllByRole('menuitem');
    act(() => items[itemIndex].focus());
    return items;
  }

  it('pressing Escape closes the popover', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    expect(screen.getByRole('menu')).toBeDefined();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('pressing Escape returns focus to the trigger button', async () => {
    renderButton();
    await userEvent.click(getExportButton());
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(getExportButton());
  });

  it('ArrowDown moves focus to the next menu item', async () => {
    renderButton();
    const items = await openAndFocusItem(0);
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
  });

  it('ArrowDown wraps focus from the last item to the first', async () => {
    renderButton();
    const items = await openAndFocusItem(1); // last item (index 1 of 2)
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp moves focus to the previous menu item', async () => {
    renderButton();
    const items = await openAndFocusItem(1);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('ArrowUp wraps focus from the first item to the last', async () => {
    renderButton();
    const items = await openAndFocusItem(0);
    fireEvent.keyDown(document, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[items.length - 1]);
  });

  it('ArrowDown on an unfocused menu still moves focus to the first item', async () => {
    // Cover the case where the rAF has not yet fired when ArrowDown is pressed.
    // currentIdx will be -1 (focus is on the trigger), so nextIndex = 0.
    renderButton();
    await userEvent.click(getExportButton());
    // Do NOT focus any item — mimic the state before the double-rAF completes.
    fireEvent.keyDown(document, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(document.activeElement).toBe(items[0]);
  });

  it('Enter on a focused menu item activates it', async () => {
    const { onExport } = renderButton();
    const items = await openAndFocusItem(0); // "Download as Markdown"
    // Native button behaviour: Enter on a focused button fires its click handler.
    fireEvent.keyDown(items[0], { key: 'Enter' });
    fireEvent.click(items[0]);
    const expectedOptions: ExportOptions = { includeGeneratedImages: false };
    expect(onExport).toHaveBeenCalledWith('markdown', expectedOptions);
  });

  it('keyboard navigation keys do not fire when the menu is closed', () => {
    renderButton();
    // Menu is closed — document listener is not attached.
    // ArrowDown should not throw or cause any state change.
    expect(() => {
      fireEvent.keyDown(document, { key: 'ArrowDown' });
      fireEvent.keyDown(document, { key: 'ArrowUp' });
      fireEvent.keyDown(document, { key: 'Escape' });
    }).not.toThrow();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
