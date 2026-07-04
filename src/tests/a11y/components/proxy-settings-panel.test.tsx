/**
 * ProxySettingsPanel — Axe-core + Keyboard + ARIA Accessibility Tests (issue #332)
 *
 * Component under test:
 *   src/ui/ProxySettingsPanel.tsx
 *
 * Standards: WCAG 2.1 Level AA
 *
 * States under test:
 *   - Idle / empty input (default)
 *   - URL entered (Save + Clear visible, Test enabled)
 *   - Test status: success (role="status", "Connected" text)
 *   - Test status: failed  (role="alert", "Failed" text)
 *   - Saved flash (Save button shows "Saved")
 *
 * Testing method:
 *   - Automated axe-core scanning of all four states
 *   - DOM assertions for ARIA attributes and accessible names
 *   - Keyboard operability checks (disabled state, focus-visible classes)
 *
 * Contrast audit: SKIPPED — all tokens (bg-input, bg-hover, bg-accent-claude,
 * text-success, text-error, border-success/30, ring-focus) are existing tokens
 * already audited in prior Ada sessions. No novel color choices introduced.
 *
 * Touch target audit: Save button uses h-7 (28px height). Below WCAG 2.5.5 AAA
 * (44px) but above WCAG 2.5.8 WCAG 2.2 AA (24px). Advisory only — WCAG 2.5.5
 * is AAA. Not a blocker. See advisory note in the audit report.
 *
 * fetch mocking: vi.stubGlobal('fetch', ...) per project convention (see
 * credentialTest.test.ts). Stubs are cleared after each test via
 * vi.unstubAllGlobals() to prevent cross-test contamination.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxySettingsPanel } from '@/ui/ProxySettingsPanel';

// ─── Axe assertion helper ─────────────────────────────────────────────────────

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

// ─── Mock Gate auth module ────────────────────────────────────────────────────
// ProxySettingsPanel imports getProxyConfig, saveProxyConfig, clearProxyConfig.
// We mock all three so tests never touch localStorage.

const mockGetProxyConfig = vi.fn(() => null as { url: string } | null);
const mockSaveProxyConfig = vi.fn();
const mockClearProxyConfig = vi.fn();

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    getProxyConfig: () => mockGetProxyConfig(),
    saveProxyConfig: (config: { url: string }) => mockSaveProxyConfig(config),
    clearProxyConfig: () => mockClearProxyConfig(),
  };
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProxyConfig.mockReturnValue(null);
});

// Unstub any fetch stubs between tests to prevent cross-test contamination.
afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Helper: type a URL into the proxy input ──────────────────────────────────

function typeProxyUrl(url = 'https://my-proxy.workers.dev'): void {
  fireEvent.change(screen.getByLabelText('Proxy URL'), {
    target: { value: url },
  });
}

// ─── Axe scans — all four states (WCAG 4.1.2) ────────────────────────────────

describe('ProxySettingsPanel — axe-core (WCAG 4.1.2)', () => {
  it('has no axe violations in default empty state', async () => {
    const { container } = render(<ProxySettingsPanel />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when URL is entered (Save + Clear visible)', async () => {
    const { container } = render(<ProxySettingsPanel />);
    typeProxyUrl();
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when test status is success (Connected shown)', async () => {
    // Mock fetch to return a 2xx response — handleTest calls fetch({url}/anthropic).
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));

    const { container } = render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeTruthy();
    });

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when test status is failed (Failed shown)', async () => {
    // Mock fetch to reject — rejects trigger the catch path that sets 'failed'.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { container } = render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed/i)).toBeTruthy();
    });

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Input accessible name (WCAG 1.3.1, 4.1.2) ───────────────────────────────

describe('ProxySettingsPanel — input accessible name (WCAG 1.3.1, 4.1.2)', () => {
  it('URL input has aria-label="Proxy URL" (accessible name via aria-label)', () => {
    render(<ProxySettingsPanel />);
    // getByLabelText finds elements by their accessible name — aria-label, htmlFor, or
    // aria-labelledby. Passing here confirms the input has a valid accessible name.
    const input = screen.getByLabelText('Proxy URL');
    expect(input).toBeTruthy();
    expect(input.tagName.toLowerCase()).toBe('input');
    expect(input.getAttribute('type')).toBe('url');
  });

  it('URL input has id="proxy-url-input"', () => {
    render(<ProxySettingsPanel />);
    const input = screen.getByLabelText('Proxy URL');
    expect(input.id).toBe('proxy-url-input');
  });
});

// ─── Test button state (WCAG 4.1.2) ──────────────────────────────────────────

describe('ProxySettingsPanel — Test button disabled state (WCAG 4.1.2)', () => {
  it('Test button is disabled with aria-disabled when input is empty', () => {
    render(<ProxySettingsPanel />);
    const testBtn = screen.getByRole('button', { name: /test/i });
    expect((testBtn as HTMLButtonElement).disabled).toBe(true);
    expect(testBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('Test button is enabled (not disabled, not aria-disabled) when URL is entered', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    const testBtn = screen.getByRole('button', { name: /test/i });
    expect((testBtn as HTMLButtonElement).disabled).toBe(false);
    // aria-disabled should be false or absent — either is valid
    const ariaDisabled = testBtn.getAttribute('aria-disabled');
    expect(ariaDisabled === null || ariaDisabled === 'false').toBe(true);
  });

  it('Test button shows "Testing…" and becomes disabled while request is in flight', async () => {
    let resolveTest!: () => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<{ status: number }>((resolve) => {
          resolveTest = () => resolve({ status: 200 });
        }),
      ),
    );

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    // Immediately after click, the button should show "Testing…"
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /testing/i })).toBeTruthy();
    });
    const testingBtn = screen.getByRole('button', { name: /testing/i });
    expect((testingBtn as HTMLButtonElement).disabled).toBe(true);
    expect(testingBtn.getAttribute('aria-disabled')).toBe('true');

    resolveTest();
  });
});

// ─── Test status live regions (WCAG 4.1.3) ───────────────────────────────────

describe('ProxySettingsPanel — test status live regions (WCAG 4.1.3)', () => {
  it('success indicator uses role="status" (polite — does not interrupt)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      // role="status" is the ARIA pattern for polite live regions.
      const status = screen.getByRole('status');
      expect(status.textContent).toMatch(/connected/i);
    });
  });

  it('failure indicator uses role="alert" (assertive — interrupts the user)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toMatch(/failed/i);
    });
  });

  it('success status has id="proxy-test-status" (referenced by aria-describedby)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status.id).toBe('proxy-test-status');
    });
  });

  it('failure alert has id="proxy-test-status" (referenced by aria-describedby)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.id).toBe('proxy-test-status');
    });
  });
});

// ─── aria-describedby wiring on URL input (WCAG 1.3.1) ───────────────────────

describe('ProxySettingsPanel — aria-describedby on URL input (WCAG 1.3.1)', () => {
  it('aria-describedby is absent on URL input when testStatus is idle', () => {
    render(<ProxySettingsPanel />);
    const input = screen.getByLabelText('Proxy URL');
    // No test result shown — input should not reference any description yet.
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('aria-describedby is set to "proxy-test-status" after a successful test', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 200 }));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
    });

    const input = screen.getByLabelText('Proxy URL');
    expect(input.getAttribute('aria-describedby')).toBe('proxy-test-status');
  });

  it('aria-describedby is set to "proxy-test-status" after a failed test', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /test/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const input = screen.getByLabelText('Proxy URL');
    expect(input.getAttribute('aria-describedby')).toBe('proxy-test-status');
  });
});

// ─── Save and Clear buttons (WCAG 2.1.1, 4.1.2) ──────────────────────────────

describe('ProxySettingsPanel — Save and Clear buttons (WCAG 2.1.1, 4.1.2)', () => {
  it('Save button is not visible when input is empty (conditional rendering)', () => {
    render(<ProxySettingsPanel />);
    // Save and Clear are only rendered when hasInput is true.
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /clear/i })).toBeNull();
  });

  it('Save and Clear buttons appear when URL is typed', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^clear$/i })).toBeTruthy();
  });

  it('Save button calls saveProxyConfig with the trimmed URL', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl('  https://my-proxy.workers.dev  ');
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(mockSaveProxyConfig).toHaveBeenCalledTimes(1);
    expect(mockSaveProxyConfig).toHaveBeenCalledWith({
      url: 'https://my-proxy.workers.dev',
    });
  });

  it('Save button text changes to "Saved" after clicking (accessible state change)', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // The text change from "Save" to "Saved" is the accessible state change
    // communicated to screen readers — no separate aria-live needed.
    expect(screen.getByRole('button', { name: /^saved$/i })).toBeTruthy();
  });

  it('Clear button calls clearProxyConfig and resets input', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }));
    expect(mockClearProxyConfig).toHaveBeenCalledTimes(1);
    // After clear, input should be empty and Save/Clear should be hidden.
    const input = screen.getByLabelText('Proxy URL') as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.queryByRole('button', { name: /^save$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^clear$/i })).toBeNull();
  });
});

// ─── Focus visibility (WCAG 2.4.7) ───────────────────────────────────────────

describe('ProxySettingsPanel — focus-visible ring classes (WCAG 2.4.7)', () => {
  it('Test button has focus-visible:ring-2 class', () => {
    render(<ProxySettingsPanel />);
    const testBtn = screen.getByRole('button', { name: /test/i });
    expect(testBtn.className).toContain('focus-visible:ring-2');
  });

  it('Save button has focus-visible:ring-2 class', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    const saveBtn = screen.getByRole('button', { name: /^save$/i });
    expect(saveBtn.className).toContain('focus-visible:ring-2');
  });

  it('Clear button has focus-visible:ring-2 class', () => {
    render(<ProxySettingsPanel />);
    typeProxyUrl();
    const clearBtn = screen.getByRole('button', { name: /^clear$/i });
    expect(clearBtn.className).toContain('focus-visible:ring-2');
  });

  it('URL input has focus-visible:ring-2 class', () => {
    render(<ProxySettingsPanel />);
    const input = screen.getByLabelText('Proxy URL');
    expect(input.className).toContain('focus-visible:ring-2');
  });
});

// ─── Pre-populated from Gate storage (WCAG 4.1.2) ────────────────────────────

describe('ProxySettingsPanel — pre-populated state from Gate storage', () => {
  it('has no axe violations when pre-populated with a saved proxy URL', async () => {
    mockGetProxyConfig.mockReturnValue({ url: 'https://saved-proxy.workers.dev' });
    const { container } = render(<ProxySettingsPanel />);

    // With a pre-populated URL, Save + Clear are visible from the start.
    expect(screen.getByRole('button', { name: /^save$/i })).toBeTruthy();

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('input is pre-filled with the saved URL', () => {
    mockGetProxyConfig.mockReturnValue({ url: 'https://saved-proxy.workers.dev' });
    render(<ProxySettingsPanel />);
    const input = screen.getByLabelText('Proxy URL') as HTMLInputElement;
    expect(input.value).toBe('https://saved-proxy.workers.dev');
  });
});
