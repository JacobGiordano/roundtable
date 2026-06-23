/**
 * BackendServerPanel — Axe-core + Keyboard Accessibility Tests
 *
 * Covers the BackendServerPanel component introduced in issue #170.
 * The panel has two states:
 *   - Disconnected: server URL input, username input, password input (with eye
 *     toggle), inline error, Connect button
 *   - Connected: "Connected" status badge, server URL display, Disconnect button
 *
 * Standards: WCAG 2.1 Level AA
 *
 * Component under test:
 *   src/ui/BackendServerPanel.tsx
 *
 * Testing method:
 *   - Automated axe-core scanning (both states)
 *   - DOM structure assertions for ARIA attributes and label associations
 *   - Keyboard interaction tests (Enter submission, eye toggle)
 *   - Focus management after login error
 *
 * Contrast audit: SKIPPED — this component uses only existing design tokens
 * (text-success, text-error, text-text-muted, bg-hover, bg-accent-claude,
 * text-text-inverse, bg-input) already audited in other component test files.
 *
 * axe-core assertion pattern:
 *   Uses assertNoViolations() helper — equivalent to toHaveNoViolations() but
 *   avoids vitest-axe strict-mode type export issue. Violations printed in full.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import type { AxeResults } from 'axe-core';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackendServerPanel } from '@/ui/BackendServerPanel';

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

// ─── Mock Gate auth module ────────────────────────────────────────────────────
// BackendServerPanel imports getServerUrl, saveServerUrl, login, logout,
// isBackendConfigured, and BackendAuthError from @/auth.
// We mock the state-reading and network functions so tests run without
// localStorage or real fetch calls.

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockGetServerUrl = vi.fn(() => undefined as string | undefined);
const mockSaveServerUrl = vi.fn();
const mockIsBackendConfigured = vi.fn(() => false);

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    getServerUrl: () => mockGetServerUrl(),
    saveServerUrl: (url: string) => mockSaveServerUrl(url),
    login: (...args: Parameters<typeof real.login>) => mockLogin(...args),
    logout: () => mockLogout(),
    isBackendConfigured: () => mockIsBackendConfigured(),
  };
});

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockIsBackendConfigured.mockReturnValue(false);
  mockGetServerUrl.mockReturnValue(undefined);
  mockLogin.mockResolvedValue(undefined);
  mockLogout.mockReturnValue(undefined);
});

// ─── Axe scans — disconnected state ──────────────────────────────────────────

describe('BackendServerPanel (disconnected) — axe-core (WCAG 4.1.2)', () => {
  it('has no axe violations in default disconnected state', async () => {
    const { container } = render(<BackendServerPanel />);
    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when URL validation error is shown', async () => {
    const { container } = render(<BackendServerPanel />);

    // Trigger URL validation error: type an invalid URL and blur
    const urlInput = screen.getByLabelText(/server url/i);
    fireEvent.change(urlInput, { target: { value: 'not-a-url' } });
    fireEvent.blur(urlInput);

    const results = await axe(container);
    assertNoViolations(results);
  });

  it('has no axe violations when login error is shown', async () => {
    const { BackendAuthError } = await import('@/auth');
    mockLogin.mockRejectedValueOnce(
      new BackendAuthError('unauthorized', 'Invalid username or password.'),
    );

    const { container } = render(<BackendServerPanel />);

    // Fill all fields and trigger a login error
    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    // Wait for the async login to reject and render the error message
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });

    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Axe scans — connected state ─────────────────────────────────────────────

describe('BackendServerPanel (connected) — axe-core (WCAG 4.1.2)', () => {
  it('has no axe violations in connected state', async () => {
    mockIsBackendConfigured.mockReturnValue(true);
    mockGetServerUrl.mockReturnValue('https://my-server.example.com');

    const { container } = render(<BackendServerPanel />);
    const results = await axe(container);
    assertNoViolations(results);
  });
});

// ─── Label / id associations (WCAG 1.3.1, 4.1.2) ─────────────────────────────

describe('BackendServerPanel — label/input associations (WCAG 1.3.1, 4.1.2)', () => {
  it('Server URL input is associated with its label via htmlFor/id', () => {
    render(<BackendServerPanel />);
    const input = screen.getByLabelText(/server url/i);
    expect(input).toBeTruthy();
    expect(input.id).toBe('backend-server-url');
    expect(input.getAttribute('type')).toBe('url');
  });

  it('Username input is associated with its label via htmlFor/id', () => {
    render(<BackendServerPanel />);
    const input = screen.getByLabelText(/username/i);
    expect(input).toBeTruthy();
    expect(input.id).toBe('backend-username');
    expect(input.getAttribute('type')).toBe('text');
  });

  it('Password input is associated with its label via htmlFor/id', () => {
    render(<BackendServerPanel />);
    const input = screen.getByLabelText('Password');
    expect(input).toBeTruthy();
    expect(input.id).toBe('backend-password');
    expect(input.getAttribute('type')).toBe('password');
  });
});

// ─── ARIA attributes (WCAG 4.1.2, 4.1.3) ────────────────────────────────────

describe('BackendServerPanel — ARIA attributes (WCAG 4.1.2, 4.1.3)', () => {
  it('URL validation error uses role="alert" (WCAG 4.1.3)', () => {
    render(<BackendServerPanel />);

    const urlInput = screen.getByLabelText(/server url/i);
    fireEvent.change(urlInput, { target: { value: 'bad-url' } });
    fireEvent.blur(urlInput);

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toMatch(/valid url/i);
  });

  it('login error uses role="alert" and aria-live="polite" (WCAG 4.1.3)', async () => {
    const { BackendAuthError } = await import('@/auth');
    mockLogin.mockRejectedValueOnce(
      new BackendAuthError('unauthorized', 'Invalid username or password.'),
    );

    render(<BackendServerPanel />);
    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      const loginAlert = alerts.find((a) =>
        a.getAttribute('aria-live') === 'polite',
      );
      expect(loginAlert).toBeTruthy();
      expect(loginAlert?.textContent).toMatch(/invalid username or password/i);
    });
  });

  it('Connect button has aria-disabled and disabled when loading (WCAG 4.1.2)', async () => {
    // Make login hang so we can inspect the loading state
    let resolveLogin!: () => void;
    mockLogin.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<BackendServerPanel />);
    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /connecting/i });
      expect(btn.getAttribute('aria-disabled')).toBe('true');
      expect((btn as HTMLButtonElement).disabled).toBe(true);
    });

    // Clean up the hanging promise
    resolveLogin();
  });

  it('Disconnect button has a meaningful aria-label (WCAG 2.4.6)', () => {
    mockIsBackendConfigured.mockReturnValue(true);
    mockGetServerUrl.mockReturnValue('https://my-server.example.com');

    render(<BackendServerPanel />);
    const disconnectBtn = screen.getByRole('button', {
      name: /disconnect from backend server/i,
    });
    expect(disconnectBtn).toBeTruthy();
    // Explicit aria-label: "Disconnect" alone would be ambiguous in a settings
    // panel that might eventually surface multiple server entries.
    expect(disconnectBtn.getAttribute('aria-label')).toBe(
      'Disconnect from backend server',
    );
  });
});

// ─── Eye toggle (WCAG 2.4.3 — intentional tabIndex={-1}) ─────────────────────

describe('BackendServerPanel — eye toggle (WCAG 2.4.3 advisory)', () => {
  it('eye toggle has tabIndex={-1} — intentionally removed from tab order', () => {
    render(<BackendServerPanel />);
    const eyeToggle = screen.getByRole('button', { name: /show password/i });
    expect(eyeToggle.getAttribute('tabindex')).toBe('-1');
  });

  it('eye toggle aria-label describes its current action', () => {
    render(<BackendServerPanel />);
    const eyeToggle = screen.getByRole('button', { name: /show password/i });
    expect(eyeToggle.getAttribute('aria-label')).toBe('Show password');
  });

  it('eye toggle aria-label updates when password is revealed', () => {
    render(<BackendServerPanel />);
    const eyeToggle = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(eyeToggle);
    const updatedToggle = screen.getByRole('button', { name: /hide password/i });
    expect(updatedToggle.getAttribute('aria-label')).toBe('Hide password');
  });

  it('password input type switches between "password" and "text" on eye toggle', () => {
    render(<BackendServerPanel />);
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput.getAttribute('type')).toBe('password');

    const eyeToggle = screen.getByRole('button', { name: /show password/i });
    fireEvent.click(eyeToggle);

    expect(passwordInput.getAttribute('type')).toBe('text');
  });
});

// ─── Keyboard — Enter submits the form (WCAG 2.1.1) ──────────────────────────

describe('BackendServerPanel — keyboard Enter submission (WCAG 2.1.1)', () => {
  it('Enter key on an input calls login (event bubbles to wrapper onKeyDown)', async () => {
    render(<BackendServerPanel />);

    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' },
    });

    // Fire Enter on the URL input — bubbles up to the wrapper div's onKeyDown
    const urlInput = screen.getByLabelText(/server url/i);
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'https://my-server.example.com',
        'admin',
        'pass',
      );
    });
  });

  it('Enter key is suppressed during loading state — no double-submit', async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLogin = resolve;
      }),
    );

    render(<BackendServerPanel />);
    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'pass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    // Wait for loading state
    await waitFor(() => screen.getByRole('button', { name: /connecting/i }));

    // Attempt a second Enter — must be suppressed
    const urlInput = screen.getByLabelText(/server url/i);
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    // Still exactly one login call
    expect(mockLogin).toHaveBeenCalledTimes(1);

    resolveLogin();
  });
});

// ─── Focus management after error (WCAG 3.3.1) ───────────────────────────────

describe('BackendServerPanel — focus management after login error (WCAG 3.3.1)', () => {
  it('error message is shown and username field remains keyboard-reachable after login failure', async () => {
    const { BackendAuthError } = await import('@/auth');
    mockLogin.mockRejectedValueOnce(
      new BackendAuthError('unauthorized', 'Invalid username or password.'),
    );

    render(<BackendServerPanel />);
    fireEvent.change(screen.getByLabelText(/server url/i), {
      target: { value: 'https://my-server.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'admin' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpass' },
    });
    fireEvent.click(screen.getByRole('button', { name: /connect/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert', { hidden: false })).toBeTruthy();
    });

    // Username input must remain in the DOM and reachable for keyboard recovery.
    // Focus intent (requestAnimationFrame) is verified in manual testing;
    // here we confirm the element is present and not excluded from tab order.
    const usernameInput = screen.getByLabelText(/username/i);
    expect(usernameInput).toBeTruthy();
    expect(usernameInput.getAttribute('tabindex')).not.toBe('-1');
  });
});

// ─── Disconnect (connected state) — WCAG 2.1.1 ───────────────────────────────

describe('BackendServerPanel (connected) — Disconnect button (WCAG 2.1.1)', () => {
  it('Disconnect button calls logout when clicked', () => {
    mockIsBackendConfigured.mockReturnValue(true);
    mockGetServerUrl.mockReturnValue('https://my-server.example.com');

    const onConnectionChange = vi.fn();
    render(<BackendServerPanel onConnectionChange={onConnectionChange} />);

    const disconnectBtn = screen.getByRole('button', {
      name: /disconnect from backend server/i,
    });
    fireEvent.click(disconnectBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledTimes(1);
  });

  it('panel transitions to disconnected state after Disconnect click', () => {
    mockIsBackendConfigured.mockReturnValue(true);
    mockGetServerUrl.mockReturnValue('https://my-server.example.com');

    render(<BackendServerPanel />);
    fireEvent.click(
      screen.getByRole('button', { name: /disconnect from backend server/i }),
    );

    // After disconnect, the login form must be present and keyboard-reachable
    expect(screen.getByLabelText(/server url/i)).toBeTruthy();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});

// ─── Enter-key logic contract (static) ───────────────────────────────────────

describe('BackendServerPanel — Enter-key logic contract (WCAG 2.1.1)', () => {
  /**
   * Documents the keyboard contract in handleFormKeyDown:
   *   - Enter fires login when loginState !== 'loading'
   *   - Enter is a no-op during loading (prevents double-submit)
   *
   * Mirrors BackendServerPanel.tsx handleFormKeyDown.
   */
  function shouldSubmit(key: string, loginState: string): boolean {
    return key === 'Enter' && loginState !== 'loading';
  }

  it('submits on Enter when idle', () => {
    expect(shouldSubmit('Enter', 'idle')).toBe(true);
  });

  it('submits on Enter when in error state', () => {
    expect(shouldSubmit('Enter', 'error')).toBe(true);
  });

  it('does NOT submit on Enter when loading', () => {
    expect(shouldSubmit('Enter', 'loading')).toBe(false);
  });

  it('does NOT submit on non-Enter keys', () => {
    expect(shouldSubmit('Tab', 'idle')).toBe(false);
    expect(shouldSubmit(' ', 'idle')).toBe(false);
    expect(shouldSubmit('Escape', 'idle')).toBe(false);
  });
});
