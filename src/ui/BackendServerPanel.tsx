/**
 * BackendServerPanel — Backend Server section for the sidebar settings panel.
 *
 * Renders:
 *   - Server URL input (pre-populated from stored value via Gate)
 *   - Connection status indicator (connected / disconnected)
 *   - Login form (username + password) — visible when not connected
 *   - Login / Logout button
 *   - Inline error message on failed auth
 *
 * Gate imports used here (all sanctioned cross-boundary imports per CLAUDE.md):
 *   - getServerUrl: read-only persistence utility
 *   - saveServerUrl: persist URL on blur
 *   - login: POST /auth/login, stores token internally via Gate
 *   - logout: clears URL + token
 *   - isBackendConfigured: true when both URL and token are stored
 *   - BackendAuthError: typed error class, exported for isinstance checks (#170)
 *   - BackendAuthErrorCode: type only
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  getServerUrl,
  saveServerUrl,
  login,
  logout,
  isBackendConfigured,
  BackendAuthError,
} from '@/auth';
import type { BackendAuthErrorCode } from '@/auth';
import { EyeIcon, EyeOffIcon } from './icons';

// ─── Error message helpers ─────────────────────────────────────────────────────

function errorCodeToMessage(code: BackendAuthErrorCode): string {
  switch (code) {
    case 'network_error':
      return 'Could not reach the server. Check the URL and your network connection.';
    case 'unauthorized':
      return 'Invalid username or password.';
    case 'server_error':
      return 'The server returned an error. Try again later.';
    case 'invalid_response':
      return 'The server returned an unexpected response.';
    default:
      return 'Login failed. Please try again.';
  }
}

// ─── Connection status badge ───────────────────────────────────────────────────

interface StatusBadgeProps {
  isConnected: boolean;
}

function StatusBadge({ isConnected }: StatusBadgeProps) {
  if (isConnected) {
    return (
      <span className="text-[11px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5 flex-shrink-0">
        Connected
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium text-text-muted bg-hover rounded-full px-2 py-0.5 flex-shrink-0">
      Not connected
    </span>
  );
}

// ─── BackendServerPanel ────────────────────────────────────────────────────────

export interface BackendServerPanelProps {
  /**
   * Called after a successful login or logout so the parent can react to the
   * connection state change (e.g. re-initialize the storage provider in App).
   */
  onConnectionChange?: () => void;
}

export function BackendServerPanel({ onConnectionChange }: BackendServerPanelProps) {
  // ── Auth state ─────────────────────────────────────────────────────────────
  const [isConnected, setIsConnected] = useState<boolean>(() => isBackendConfigured());

  // ── URL field ──────────────────────────────────────────────────────────────
  // Initialised from Gate storage; mirrors the user's typed value.
  const [serverUrl, setServerUrl] = useState<string>(() => getServerUrl() ?? '');
  const [urlError, setUrlError] = useState<string>('');

  // ── Login form ─────────────────────────────────────────────────────────────
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [usernameError, setUsernameError] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');

  // ── Login lifecycle ────────────────────────────────────────────────────────
  type LoginState = 'idle' | 'loading' | 'error';
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [loginError, setLoginError] = useState<string>('');

  // Focus targets for validation error recovery.
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // ── URL validation ─────────────────────────────────────────────────────────
  const validateUrl = useCallback((url: string): boolean => {
    if (!url.trim()) {
      setUrlError('Server URL is required.');
      return false;
    }
    if (!/^https?:\/\/.+/.test(url.trim())) {
      setUrlError('Enter a valid URL (e.g. https://my-server.example.com)');
      return false;
    }
    setUrlError('');
    return true;
  }, []);

  // ── URL persist on blur ────────────────────────────────────────────────────
  const handleUrlBlur = useCallback(() => {
    const trimmed = serverUrl.trim();
    if (trimmed && /^https?:\/\/.+/.test(trimmed)) {
      saveServerUrl(trimmed);
      setUrlError('');
    } else if (trimmed) {
      setUrlError('Enter a valid URL (e.g. https://my-server.example.com)');
    }
  }, [serverUrl]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = useCallback(async () => {
    if (!validateUrl(serverUrl)) return;

    // Validate username and password before hitting the network.
    const usernameMissing = !username.trim();
    const passwordMissing = !password;

    if (usernameMissing) setUsernameError('Username is required.');
    if (passwordMissing) setPasswordError('Password is required.');

    if (usernameMissing) {
      requestAnimationFrame(() => {
        usernameInputRef.current?.focus();
      });
      return;
    }
    if (passwordMissing) {
      requestAnimationFrame(() => {
        passwordInputRef.current?.focus();
      });
      return;
    }

    setLoginState('loading');
    setLoginError('');

    try {
      await login(serverUrl.trim(), username.trim(), password);
      setIsConnected(true);
      setLoginState('idle');
      // Clear sensitive fields and any validation errors on success.
      setUsername('');
      setPassword('');
      setUsernameError('');
      setPasswordError('');
      onConnectionChange?.();
    } catch (err: unknown) {
      setLoginState('error');
      if (err instanceof BackendAuthError) {
        setLoginError(errorCodeToMessage(err.code));
      } else if (err instanceof Error) {
        setLoginError(err.message || 'Login failed. Please try again.');
      } else {
        setLoginError('Login failed. Please try again.');
      }
      // Return focus to username so keyboard users can correct credentials.
      requestAnimationFrame(() => {
        usernameInputRef.current?.focus();
      });
    }
  }, [serverUrl, username, password, validateUrl, onConnectionChange]);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    logout();
    setIsConnected(false);
    // Gate's logout() clears the server URL; sync field state.
    setServerUrl('');
    setUrlError('');
    setLoginError('');
    setLoginState('idle');
    setUsername('');
    setPassword('');
    setUsernameError('');
    setPasswordError('');
    onConnectionChange?.();
  }, [onConnectionChange]);

  // ── Enter key submits the form ─────────────────────────────────────────────
  const handleFormKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && loginState !== 'loading') {
        e.preventDefault();
        void handleLogin();
      }
    },
    [handleLogin, loginState],
  );

  // ── One-time sync on mount — detect external state change ─────────────────
  // If a token expired while the settings panel was closed, sync back to
  // disconnected without requiring a user action.
  useEffect(() => {
    const stored = isBackendConfigured();
    if (stored !== isConnected) {
      setIsConnected(stored);
      if (!stored) {
        setServerUrl(getServerUrl() ?? '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Shared input class ─────────────────────────────────────────────────────
  const inputBase = [
    'w-full h-9 px-3 rounded-md text-[13px] text-text-primary placeholder:text-text-muted',
    'bg-input border transition-colors duration-fast',
    'focus:outline-none focus:border-border-strong',
    'focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
  ].join(' ');

  return (
    <div>
      {/* Section heading */}
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted mb-2">
        Backend Server
      </p>

      {/* ── Connected state ─────────────────────────────────────────────── */}
      {isConnected ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge isConnected={true} />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Disconnect from backend server"
              className={[
                'h-7 px-3 rounded-md text-[12px] font-medium flex-shrink-0',
                'text-error border border-border',
                'hover:border-error/50 hover:bg-error/5',
                'transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              ].join(' ')}
            >
              Disconnect
            </button>
          </div>
          {/* Stored server URL — informational, truncated */}
          {serverUrl && (
            <p
              className="text-[11px] text-text-muted truncate"
              title={serverUrl}
            >
              {serverUrl}
            </p>
          )}
        </div>
      ) : (
        /* ── Disconnected state — URL + login form ─────────────────────── */
        <div className="flex flex-col gap-3" onKeyDown={handleFormKeyDown}>
          <StatusBadge isConnected={false} />

          {/* Server URL */}
          <div>
            <label
              htmlFor="backend-server-url"
              className="block text-[11px] font-medium text-text-secondary mb-1"
            >
              Server URL
            </label>
            <input
              id="backend-server-url"
              type="url"
              value={serverUrl}
              onChange={(e) => {
                setServerUrl(e.target.value);
                if (urlError) setUrlError('');
              }}
              onBlur={handleUrlBlur}
              placeholder="https://my-server.example.com"
              autoComplete="url"
              className={[inputBase, urlError ? 'border-error' : 'border-border'].join(' ')}
            />
            {urlError && (
              <p role="alert" className="mt-1 text-[11px] text-error">
                {urlError}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="backend-username"
              className="block text-[11px] font-medium text-text-secondary mb-1"
            >
              Username
            </label>
            <input
              ref={usernameInputRef}
              id="backend-username"
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (usernameError) setUsernameError('');
              }}
              placeholder="Username"
              autoComplete="username"
              aria-describedby={usernameError ? 'backend-username-error' : undefined}
              aria-invalid={usernameError ? true : undefined}
              className={[inputBase, usernameError ? 'border-error' : 'border-border'].join(' ')}
            />
            {usernameError && (
              <p id="backend-username-error" role="alert" className="mt-1 text-[11px] text-error">
                {usernameError}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="backend-password"
              className="block text-[11px] font-medium text-text-secondary mb-1"
            >
              Password
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
                id="backend-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (passwordError) setPasswordError('');
                }}
                placeholder="Password"
                autoComplete="current-password"
                aria-describedby={passwordError ? 'backend-password-error' : undefined}
                aria-invalid={passwordError ? true : undefined}
                style={{ paddingRight: '36px' }}
                className={[inputBase, passwordError ? 'border-error' : 'border-border'].join(' ')}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors duration-fast focus:outline-none"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {passwordError && (
              <p id="backend-password-error" role="alert" className="mt-1 text-[11px] text-error">
                {passwordError}
              </p>
            )}
          </div>

          {/* Inline auth error */}
          {loginState === 'error' && loginError && (
            <p role="alert" aria-live="polite" className="text-[11px] text-error">
              {loginError}
            </p>
          )}

          {/* Connect button */}
          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loginState === 'loading'}
            aria-disabled={loginState === 'loading'}
            className={[
              'h-8 px-4 rounded-md text-[12px] font-semibold self-start',
              'bg-accent-claude text-text-inverse',
              'hover:brightness-110 transition-all duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1',
              loginState === 'loading' ? 'opacity-50 cursor-not-allowed' : '',
            ].join(' ')}
          >
            {loginState === 'loading' ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
}
