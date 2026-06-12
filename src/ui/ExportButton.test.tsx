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
 * Component interface (from ExportButton.tsx):
 *   onExport: (format: ExportFormat) => void
 *   disabled?: boolean
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportButton } from './ExportButton';

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
    // Simulate a pointerdown event outside the component.
    fireEvent.pointerDown(document.body);
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

  it('clicking "Download as Markdown" calls onExport with "markdown"', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as markdown/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith('markdown');
  });

  it('clicking "Download as HTML" calls onExport with "html"', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as html/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onExport).toHaveBeenCalledWith('html');
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
    fireEvent.pointerDown(document.body);
    expect(onExport).not.toHaveBeenCalled();
  });

  it('onExport is called once per format selection (not double-fired)', async () => {
    const { onExport } = renderButton();
    await userEvent.click(getExportButton());
    await userEvent.click(screen.getByRole('menuitem', { name: /download as html/i }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });
});
