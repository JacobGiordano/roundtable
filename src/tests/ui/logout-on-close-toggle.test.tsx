/**
 * BackendServerPanel — logoutOnClose toggle (#548)
 *
 * Targeted behavioral coverage for the `role="switch"` toggle added in issue
 * #456. The toggle appears only in the connected state and controls the
 * `logoutOnClose` preference (whether the backend auth token is cleared when
 * the tab closes).
 *
 * Cross-agent contracts exercised:
 *   BackendServerPanel (Aria, src/ui/BackendServerPanel.tsx) — toggle rendering
 *   getLogoutOnClose (Gate, src/auth/logoutOnClose.ts) — reads pref on mount
 *   saveLogoutOnClose (Gate, src/auth/logoutOnClose.ts) — persists pref on toggle
 *
 * Cases:
 *   1. role="switch" is present in the connected state
 *   2. aria-checked is "false" on mount (getLogoutOnClose default → false)
 *   3. Space key activates the toggle and calls saveLogoutOnClose(true)
 *   4. Enter key also activates the toggle
 *   5. saveLogoutOnClose is called with the correct boolean value on each flip
 *   6. Toggle is absent in the disconnected / login-form state
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackendServerPanel } from '@/ui/BackendServerPanel';

// ─── Mock Gate auth module ─────────────────────────────────────────────────────
// We intercept all Gate functions the panel uses so tests run without
// localStorage, real fetch calls, or side effects in the real Gate module.

const mockGetLogoutOnClose = vi.fn(() => false);
const mockSaveLogoutOnClose = vi.fn();
const mockIsBackendConfigured = vi.fn(() => false);
const mockGetServerUrl = vi.fn(() => undefined as string | undefined);
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('@/auth', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/auth')>();
  return {
    ...real,
    getLogoutOnClose: () => mockGetLogoutOnClose(),
    saveLogoutOnClose: (value: boolean) => mockSaveLogoutOnClose(value),
    isBackendConfigured: () => mockIsBackendConfigured(),
    getServerUrl: () => mockGetServerUrl(),
    login: (...args: Parameters<typeof real.login>) => mockLogin(...args),
    logout: () => mockLogout(),
  };
});

// ─── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: connected, no server URL, logoutOnClose off.
  mockIsBackendConfigured.mockReturnValue(false);
  mockGetServerUrl.mockReturnValue(undefined);
  mockGetLogoutOnClose.mockReturnValue(false);
  mockLogin.mockResolvedValue(undefined);
  mockLogout.mockReturnValue(undefined);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render the panel in connected state.
 * Pass a serverUrl to show the URL paragraph (optional — most tests don't need it).
 */
function renderConnected(serverUrl = 'https://my-server.example.com') {
  mockIsBackendConfigured.mockReturnValue(true);
  mockGetServerUrl.mockReturnValue(serverUrl);
  return render(<BackendServerPanel />);
}

/** Render the panel in disconnected / login-form state. */
function renderDisconnected() {
  mockIsBackendConfigured.mockReturnValue(false);
  mockGetServerUrl.mockReturnValue(undefined);
  return render(<BackendServerPanel />);
}

/** Find the logoutOnClose switch — returns null if absent. */
function queryToggle(): HTMLElement | null {
  return screen.queryByRole('switch');
}

// ─── 1. role="switch" present in connected state ───────────────────────────────

describe('logoutOnClose toggle — presence (#548)', () => {
  it('toggle with role="switch" is present in the connected state', () => {
    renderConnected();
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeTruthy();
  });

  it('toggle is absent in the disconnected / login-form state', () => {
    renderDisconnected();
    const toggle = queryToggle();
    expect(toggle).toBeNull();
  });
});

// ─── 2. aria-checked reflects initial pref value ──────────────────────────────

describe('logoutOnClose toggle — initial aria-checked state (#548)', () => {
  it('aria-checked is "false" on mount when getLogoutOnClose returns false (default)', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');
    // aria-checked is set from the React boolean prop; the DOM serialises it as
    // the string "false".
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('aria-checked is "true" on mount when getLogoutOnClose returns true', () => {
    mockGetLogoutOnClose.mockReturnValue(true);
    renderConnected();
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });
});

// ─── 3. Space key activates the toggle ────────────────────────────────────────

describe('logoutOnClose toggle — Space key activation (#548)', () => {
  it('Space key flips aria-checked from "false" to "true"', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.keyDown(toggle, { key: ' ' });

    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('Space key calls saveLogoutOnClose(true) when toggling from false', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');

    fireEvent.keyDown(toggle, { key: ' ' });

    expect(mockSaveLogoutOnClose).toHaveBeenCalledTimes(1);
    expect(mockSaveLogoutOnClose).toHaveBeenCalledWith(true);
  });

  it('Space key calls saveLogoutOnClose(false) when toggling from true', () => {
    mockGetLogoutOnClose.mockReturnValue(true);
    renderConnected();
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(toggle, { key: ' ' });

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mockSaveLogoutOnClose).toHaveBeenCalledTimes(1);
    expect(mockSaveLogoutOnClose).toHaveBeenCalledWith(false);
  });
});

// ─── 4. Enter key activates the toggle ────────────────────────────────────────

describe('logoutOnClose toggle — Enter key activation (#548)', () => {
  it('Enter key flips aria-checked from "false" to "true"', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');

    fireEvent.keyDown(toggle, { key: 'Enter' });

    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('Enter key calls saveLogoutOnClose(true) when toggling from false', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');

    fireEvent.keyDown(toggle, { key: 'Enter' });

    expect(mockSaveLogoutOnClose).toHaveBeenCalledTimes(1);
    expect(mockSaveLogoutOnClose).toHaveBeenCalledWith(true);
  });
});

// ─── 5. Click activation and saveLogoutOnClose correctness ────────────────────

describe('logoutOnClose toggle — click activation and save contract (#548)', () => {
  it('click flips aria-checked from "false" to "true"', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('click calls saveLogoutOnClose with the new value, not the old one', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    expect(mockSaveLogoutOnClose).toHaveBeenCalledWith(true);
    // Not called with the old value.
    expect(mockSaveLogoutOnClose).not.toHaveBeenCalledWith(false);
  });

  it('two successive clicks toggle the value back to "false" and call saveLogoutOnClose twice', () => {
    mockGetLogoutOnClose.mockReturnValue(false);
    renderConnected();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle); // false → true
    fireEvent.click(toggle); // true → false

    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(mockSaveLogoutOnClose).toHaveBeenCalledTimes(2);
    expect(mockSaveLogoutOnClose).toHaveBeenNthCalledWith(1, true);
    expect(mockSaveLogoutOnClose).toHaveBeenNthCalledWith(2, false);
  });

  it('saveLogoutOnClose is never called during a disconnected render', () => {
    renderDisconnected();
    // No toggle is present — no interaction possible.
    expect(queryToggle()).toBeNull();
    expect(mockSaveLogoutOnClose).not.toHaveBeenCalled();
  });
});

// ─── 6. Toggle absent in disconnected state — exhaustive check ────────────────

describe('logoutOnClose toggle — absent from login-form state (#548)', () => {
  it('no role="switch" element exists in the disconnected state', () => {
    renderDisconnected();
    // getByRole would throw; queryByRole returns null.
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('login form inputs are present (confirming we are in disconnected state)', () => {
    renderDisconnected();
    // Confirm we really rendered the disconnected branch, not an empty tree.
    expect(screen.getByLabelText(/server url/i)).toBeTruthy();
    expect(screen.getByLabelText(/username/i)).toBeTruthy();
    expect(screen.getByLabelText('Password')).toBeTruthy();
  });
});
