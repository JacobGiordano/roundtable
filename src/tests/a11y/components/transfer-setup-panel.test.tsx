/**
 * TransferSetupPanel — Axe-core and Manual Accessibility Tests (#305)
 *
 * Audit scope (narrow — no novel color tokens):
 *   1. Keyboard operability — interactive elements in each state
 *   2. ARIA attributes — live region, aria-disabled, error list, role="status"
 *   3. Focus management — Cancel button on confirm open; success/error headings
 *      on result; Import button on dismiss
 *
 * Standards: WCAG 2.1 Level AA
 *
 * WCAG criteria verified:
 *   - 1.3.1 Info and Relationships — error list has aria-label; live region present
 *   - 2.1.1 Keyboard — all interactive elements reachable; aria-disabled (not disabled) on reading button
 *   - 2.4.3 Focus Order — focus lands on Cancel when confirm opens; focus lands
 *       on result heading on success/error; focus returns to Import button on dismiss
 *   - 4.1.2 Name, Role, Value — all buttons have accessible names; aria-disabled correct
 *   - 4.1.3 Status Messages — live region announced via role="status" (implicit aria-live=polite)
 */

import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { TransferSetupPanel } from '@/ui/TransferSetupPanel';

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

// ─── Mocks ───────────────────────────────────────────────────────────────────
// TransferSetupPanel imports from @/auth (exportSetup, importSetup) and
// @/storage (downloadJSON, readJSONFile). Mock both so tests run without
// localStorage and without triggering real file I/O.

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    exportSetup: vi.fn(() => ({
      schemaVersion: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      credentials: {},
      customProviders: [],
      preferences: {},
    })),
    importSetup: vi.fn(() => ({ ok: true })),
  };
});

vi.mock('@/storage', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/storage')>();
  return {
    ...real,
    downloadJSON: vi.fn(),
    readJSONFile: vi.fn(() => Promise.resolve(null)), // default: user cancels picker
  };
});

// ─── Shared props ─────────────────────────────────────────────────────────────

const noop = vi.fn();

// ─── Cleanup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Idle state ───────────────────────────────────────────────────────────────

describe('TransferSetupPanel — idle state (axe, WCAG 4.1.2)', () => {
  it('has no axe violations in idle state', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('Export setup button has accessible text content', () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    const btn = container.querySelector('button') as HTMLButtonElement | null;
    expect(btn).not.toBeNull();
    expect(btn?.textContent?.trim()).toBe('Export setup');
    expect(btn?.type).toBe('button');
  });

  it('Import setup button has accessible text content', () => {
    render(<TransferSetupPanel onRosterRefresh={noop} />);
    // There are two buttons in idle state: Export setup and Import setup.
    const buttons = document.querySelectorAll('button');
    const importBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Import setup',
    );
    expect(importBtn).not.toBeNull();
    expect(importBtn?.type).toBe('button');
  });

  it('live region is present with role="status" and aria-atomic="true"', () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region).not.toBeNull();
    // Idle: live region content is empty (no announcement needed).
    expect(region?.textContent?.trim()).toBe('');
  });

  it('Import button does not have aria-disabled in idle state', () => {
    render(<TransferSetupPanel onRosterRefresh={noop} />);
    const buttons = document.querySelectorAll('button');
    const importBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Import setup',
    );
    expect(importBtn?.getAttribute('aria-disabled')).toBeNull();
  });
});

// ─── Export confirm state ─────────────────────────────────────────────────────

describe('TransferSetupPanel — export confirm state (axe, WCAG 2.4.3 / 4.1.2 / 4.1.3)', () => {
  it('has no axe violations in export confirm state', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    // Click Export setup to enter confirm state.
    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    expect(exportBtn).not.toBeNull();
    fireEvent.click(exportBtn!);

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('Cancel button is present in confirm state with correct text (WCAG 4.1.2)', () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    fireEvent.click(exportBtn!);

    const buttons = container.querySelectorAll('button');
    const cancelBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Cancel',
    );
    expect(cancelBtn).not.toBeNull();
  });

  it('Confirm download button is present in confirm state (WCAG 4.1.2)', () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    fireEvent.click(exportBtn!);

    const buttons = container.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Confirm download',
    );
    expect(confirmBtn).not.toBeNull();
    expect((confirmBtn as HTMLButtonElement | undefined)?.type).toBe('button');
  });

  it('Cancel button receives programmatic focus when confirm state opens (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    fireEvent.click(exportBtn!);

    // Wait for the requestAnimationFrame focus call to fire.
    await new Promise((r) => requestAnimationFrame(r));

    const activeEl = document.activeElement;
    expect(activeEl?.tagName.toLowerCase()).toBe('button');
    expect(activeEl?.textContent?.trim()).toBe('Cancel');
  });

  it('live region announces security warning in confirm state (WCAG 4.1.3)', () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    fireEvent.click(exportBtn!);

    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region?.textContent).toContain('Security warning');
  });

  it('clicking Cancel returns to idle and restores Export button (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const exportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    ) as HTMLButtonElement | null;
    fireEvent.click(exportBtn!);
    await new Promise((r) => requestAnimationFrame(r));

    const cancelBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Cancel',
    ) as HTMLButtonElement | null;
    expect(cancelBtn).not.toBeNull();
    fireEvent.click(cancelBtn!);

    // Wait for rAF focus return.
    await new Promise((r) => requestAnimationFrame(r));

    // Export button should be back and focused.
    const restoredExportBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Export setup',
    );
    expect(restoredExportBtn).not.toBeNull();
    expect(document.activeElement?.textContent?.trim()).toBe('Export setup');
  });
});

// ─── Import reading state (aria-disabled) ────────────────────────────────────

describe('TransferSetupPanel — import reading state (WCAG 2.1.1 / 4.1.2)', () => {
  it('Import button has aria-disabled="true" while reading (WCAG 4.1.2)', async () => {
    const { readJSONFile } = await import('@/storage');
    // Simulate a slow file read: promise that never resolves during the test.
    vi.mocked(readJSONFile).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import setup'),
    ) as HTMLButtonElement | null;
    expect(importBtn).not.toBeNull();
    fireEvent.click(importBtn!);

    // After click, importPhase = 'reading'; button label changes and aria-disabled is set.
    const readingBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Reading file'),
    ) as HTMLButtonElement | null;
    expect(readingBtn).not.toBeNull();
    expect(readingBtn?.getAttribute('aria-disabled')).toBe('true');
  });

  it('Import button does not carry native disabled attribute while reading (keyboard reachable, WCAG 2.1.1)', async () => {
    const { readJSONFile } = await import('@/storage');
    vi.mocked(readJSONFile).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import setup'),
    ) as HTMLButtonElement | null;
    fireEvent.click(importBtn!);

    const readingBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Reading file'),
    ) as HTMLButtonElement | null;
    // No native disabled — button stays in tab order for keyboard discoverability.
    expect(readingBtn?.disabled).toBe(false);
  });
});

// ─── Import success state ─────────────────────────────────────────────────────

describe('TransferSetupPanel — import success state (axe, WCAG 2.4.3 / 4.1.2 / 4.1.3)', () => {
  async function triggerSuccess(container: HTMLElement) {
    const { readJSONFile, importSetup } = await import('@/storage').then(
      async () => {
        const s = await import('@/storage');
        const a = await import('@/auth');
        return { readJSONFile: s.readJSONFile, importSetup: a.importSetup };
      },
    );

    vi.mocked(readJSONFile).mockResolvedValue({
      schemaVersion: 1,
      exportedAt: '2026-07-01T00:00:00.000Z',
      credentials: {},
      customProviders: [],
      preferences: {},
    });
    vi.mocked(importSetup).mockReturnValue({ ok: true, errors: [] });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import setup'),
    ) as HTMLButtonElement | null;
    expect(importBtn).not.toBeNull();
    fireEvent.click(importBtn!);

    // Wait for async readJSONFile + importSetup + rAF focus.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
  }

  it('has no axe violations in success state', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerSuccess(container);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('success heading receives programmatic focus (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerSuccess(container);

    const activeEl = document.activeElement;
    expect(activeEl).not.toBeNull();
    expect(activeEl?.textContent?.trim()).toBe('Setup imported.');
    // It's a paragraph with tabIndex=-1, not a button.
    expect(activeEl?.tagName.toLowerCase()).toBe('p');
    expect(activeEl?.getAttribute('tabindex')).toBe('-1');
  });

  it('Dismiss button is present and interactive in success state (WCAG 4.1.2)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerSuccess(container);

    const buttons = container.querySelectorAll('button');
    const dismissBtn = Array.from(buttons).find(
      (b) => b.textContent?.trim() === 'Dismiss',
    );
    expect(dismissBtn).not.toBeNull();
    expect((dismissBtn as HTMLButtonElement).type).toBe('button');
  });

  it('live region announces success in success state (WCAG 4.1.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerSuccess(container);

    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region?.textContent).toContain('Setup imported successfully');
  });

  it('clicking Dismiss returns focus to Import button (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerSuccess(container);

    const dismissBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Dismiss',
    ) as HTMLButtonElement | null;
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn!);

    await new Promise((r) => requestAnimationFrame(r));

    // Focus should return to the Import button.
    const activeEl = document.activeElement;
    expect(activeEl?.tagName.toLowerCase()).toBe('button');
    expect(activeEl?.textContent?.trim()).toBe('Import setup');
  });
});

// ─── Import error state ───────────────────────────────────────────────────────

describe('TransferSetupPanel — import error state (axe, WCAG 1.3.1 / 2.4.3 / 4.1.2 / 4.1.3)', () => {
  async function triggerError(container: HTMLElement, errors = ['Invalid schema version.']) {
    const { readJSONFile } = await import('@/storage');
    const { importSetup } = await import('@/auth');

    vi.mocked(readJSONFile).mockResolvedValue({ schemaVersion: 99 });
    vi.mocked(importSetup).mockReturnValue({ ok: false, errors });

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import setup'),
    ) as HTMLButtonElement | null;
    expect(importBtn).not.toBeNull();
    fireEvent.click(importBtn!);

    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => requestAnimationFrame(r));
  }

  it('has no axe violations in error state', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('error heading receives programmatic focus (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container);

    const activeEl = document.activeElement;
    expect(activeEl).not.toBeNull();
    expect(activeEl?.textContent?.trim()).toBe('Import failed.');
    expect(activeEl?.tagName.toLowerCase()).toBe('p');
    expect(activeEl?.getAttribute('tabindex')).toBe('-1');
  });

  it('error list has role="list" and aria-label="Import errors" (WCAG 1.3.1)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container, ['Schema version mismatch.', 'Missing credentials key.']);

    const list = container.querySelector('[role="list"][aria-label="Import errors"]');
    expect(list).not.toBeNull();
    // List should contain two items.
    const items = list?.querySelectorAll('[role="listitem"]') ?? [];
    expect(items.length).toBe(2);
  });

  it('error bullet spans are aria-hidden (WCAG 1.1.1)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container);

    // The decorative bullet dots must be aria-hidden so screen readers only read the error text.
    // At least one aria-hidden span (the bullet) should exist inside the error list.
    const list = container.querySelector('[role="list"][aria-label="Import errors"]');
    const hiddenInList = Array.from(list?.querySelectorAll('[aria-hidden="true"]') ?? []);
    expect(hiddenInList.length).toBeGreaterThan(0);
  });

  it('live region announces error count in error state (WCAG 4.1.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container, ['Bad version.', 'Missing key.']);

    const region = container.querySelector('[role="status"][aria-atomic="true"]');
    expect(region?.textContent).toContain('Import failed');
    expect(region?.textContent).toContain('2 error');
  });

  it('clicking Dismiss returns focus to Import button (WCAG 2.4.3)', async () => {
    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);
    await triggerError(container);

    const dismissBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Dismiss',
    ) as HTMLButtonElement | null;
    expect(dismissBtn).not.toBeNull();
    fireEvent.click(dismissBtn!);

    await new Promise((r) => requestAnimationFrame(r));

    const activeEl = document.activeElement;
    expect(activeEl?.tagName.toLowerCase()).toBe('button');
    expect(activeEl?.textContent?.trim()).toBe('Import setup');
  });
});

// ─── File-picker cancellation (no-op path) ───────────────────────────────────

describe('TransferSetupPanel — file-picker cancellation (WCAG 2.1.1)', () => {
  it('returns to idle without error when file picker is cancelled (data === null)', async () => {
    const { readJSONFile } = await import('@/storage');
    vi.mocked(readJSONFile).mockResolvedValue(null);

    const { container } = render(<TransferSetupPanel onRosterRefresh={noop} />);

    const importBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Import setup'),
    ) as HTMLButtonElement | null;
    fireEvent.click(importBtn!);

    await new Promise((r) => setTimeout(r, 0));

    // After null resolve, importPhase returns to idle — no success or error notice.
    const successEl = container.querySelector('[tabindex="-1"]');
    // success/error headings have tabIndex={-1} — should not exist in idle.
    expect(successEl).toBeNull();

    // Import button should be back to idle label with no aria-disabled.
    const idleBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Import setup',
    );
    expect(idleBtn).not.toBeNull();
    expect((idleBtn as HTMLButtonElement | undefined)?.getAttribute('aria-disabled')).toBeNull();
  });
});
