/**
 * Gate — backendAuth.ts
 *
 * Backend auth support for self-hosted Roundtable instances (issue #25).
 *
 * Manages:
 *   - Server URL and auth token persistence in localStorage or sessionStorage
 *   - Login / logout flow (POST /auth/login, synchronous logout)
 *   - Token refresh (POST /auth/refresh)
 *   - Active StorageProvider factory (server mode if configured, local mode otherwise)
 *   - Backend availability status helpers
 *
 * localStorage keys (roundtable: prefix, consistent with accentColors.ts):
 *   "roundtable:server-url"   — base URL of the self-hosted backend
 *   "roundtable:auth-token"   — session token (localStorage path, logoutOnClose=false)
 *
 * sessionStorage keys:
 *   "roundtable:auth-token"   — session token (sessionStorage path, logoutOnClose=true)
 *
 * Token storage path (issue #456):
 *   When `logoutOnClose` preference is false (default): token is stored in
 *   localStorage and persists until explicit logout. Suitable for personal machines.
 *   When `logoutOnClose` preference is true: token is stored in sessionStorage
 *   and is cleared automatically when the browser tab/window closes. Suitable
 *   for shared machines.
 *
 * Security rules (non-negotiable):
 *   - Auth tokens are NEVER logged
 *   - Auth tokens are NEVER exported to any file or clipboard by this module
 *   - Auth tokens are NEVER transmitted except to the user-configured backend URL
 *   - The logoutOnClose preference itself always lives in localStorage (it is
 *     meta-config about how to store the token, not the token itself)
 *
 * Cross-boundary import note:
 *   `createStorageProvider` is imported from @/storage/storageFactory. This is
 *   a sanctioned exception: the factory was built specifically for Gate to call
 *   from getActiveStorageProvider(). Gate never imports LocalStorageProvider or
 *   ServerStorageProvider directly — only the factory function and its config type.
 */

import type { StorageProvider } from '@/types';
// Sanctioned cross-boundary import — see module doc comment above.
import { createStorageProvider } from '@/storage/storageFactory';
import { getLogoutOnClose } from './logoutOnClose';

// ─── Storage keys ─────────────────────────────────────────────────────────────

const SERVER_URL_KEY = 'roundtable:server-url' as const;
const AUTH_TOKEN_KEY = 'roundtable:auth-token' as const;

// ─── BackendAuthError ─────────────────────────────────────────────────────────

export type BackendAuthErrorCode =
  | 'network_error'    // fetch() rejected — no network or DNS
  | 'unauthorized'     // 401 or 403 from the backend
  | 'server_error'     // 5xx from the backend
  | 'invalid_response' // unexpected response shape (missing token field, etc.)

/**
 * Typed error thrown by login() and refreshToken() on failure.
 * Internal to /src/auth — analogous to StorageError in /src/storage.
 *
 * Aria does not need to import this class by name to display a login error
 * message — it can catch Error and read the `code` field by duck-typing.
 * If Aria ever needs to catch it by type in a catch clause, Arch must add
 * BackendAuthErrorCode (or the full class) to /src/types/index.ts first.
 */
export class BackendAuthError extends Error {
  readonly code: BackendAuthErrorCode;
  readonly httpStatus?: number;

  constructor(code: BackendAuthErrorCode, message: string, httpStatus?: number) {
    super(message);
    this.name = 'BackendAuthError';
    this.code = code;
    this.httpStatus = httpStatus;
    // Restore prototype chain (required for instanceof checks in TypeScript
    // when targeting ES5 or when class extends Error).
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map an HTTP status code to a BackendAuthErrorCode.
 */
function statusToCode(status: number): BackendAuthErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (status >= 500) return 'server_error';
  return 'invalid_response';
}

/**
 * Throw a BackendAuthError for a non-ok HTTP response.
 * Attempts to read the response body to include in the message.
 */
async function throwForStatus(response: Response): Promise<never> {
  let body = '';
  try {
    body = await response.text();
  } catch {
    // Body read failure does not change the error semantics.
  }
  throw new BackendAuthError(
    statusToCode(response.status),
    `HTTP ${response.status}: ${body || response.statusText}`,
    response.status
  );
}

// ─── Server URL persistence ───────────────────────────────────────────────────

/**
 * Read the stored server URL.
 * Returns undefined if none has been saved.
 */
export function getServerUrl(): string | undefined {
  return localStorage.getItem(SERVER_URL_KEY) ?? undefined;
}

/**
 * Persist the server URL to localStorage.
 * Strips a trailing slash for consistency with ServerStorageProvider.
 */
export function saveServerUrl(url: string): void {
  localStorage.setItem(SERVER_URL_KEY, url.replace(/\/+$/, ''));
}

/**
 * Remove the stored server URL.
 */
export function clearServerUrl(): void {
  localStorage.removeItem(SERVER_URL_KEY);
}

// ─── Auth token persistence ───────────────────────────────────────────────────

/**
 * Read the stored auth token.
 * Returns undefined if no token has been saved.
 *
 * This is the ONLY function in this module that reads the auth token value.
 * Checks sessionStorage first (logoutOnClose=true path), then localStorage
 * (logoutOnClose=false path). This order allows a token written via either path
 * to be read correctly regardless of whether the preference has since changed.
 * Verified by inspection: no other function calls getItem(AUTH_TOKEN_KEY).
 */
export function getAuthToken(): string | undefined {
  // Check sessionStorage first — a token stored there indicates logoutOnClose was
  // true at login time. Fall back to localStorage for the default (persistent) path.
  return (
    sessionStorage.getItem(AUTH_TOKEN_KEY) ??
    localStorage.getItem(AUTH_TOKEN_KEY) ??
    undefined
  );
}

/**
 * Persist an auth token to the appropriate storage based on the logoutOnClose
 * preference at the time of login.
 *
 * logoutOnClose=false (default): stores in localStorage — token survives tab
 *   and browser close until explicit logout.
 * logoutOnClose=true: stores in sessionStorage — token is cleared automatically
 *   when the tab or window closes, preventing session persistence on shared machines.
 *
 * Never log, export, or transmit the value outside of auth requests.
 */
function saveAuthToken(token: string): void {
  if (getLogoutOnClose()) {
    // sessionStorage path: token cleared on tab/window close.
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    // Ensure no stale token lingers in localStorage from a previous login where
    // logoutOnClose was false.
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } else {
    // localStorage path: token persists across sessions until explicit logout.
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    // Ensure no stale token lingers in sessionStorage from a previous login where
    // logoutOnClose was true.
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/**
 * Remove the stored auth token from both storage backends.
 * Clears both localStorage and sessionStorage to handle cases where the
 * logoutOnClose preference was changed after the token was written.
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

// ─── Login / logout ───────────────────────────────────────────────────────────

/**
 * Log in to a self-hosted Roundtable backend.
 *
 * POSTs to {serverUrl}/auth/login with { username, password }.
 * On success, extracts the auth token from the response body and persists
 * both the server URL and auth token to localStorage.
 *
 * Expected response body: { token: string }
 *
 * Throws BackendAuthError on:
 *   - Network failure (code: 'network_error')
 *   - 401 / 403 response (code: 'unauthorized')
 *   - 5xx response (code: 'server_error')
 *   - Response body missing or not containing a `token` string field
 *     (code: 'invalid_response')
 */
export async function login(
  serverUrl: string,
  username: string,
  password: string
): Promise<void> {
  const normalizedUrl = serverUrl.replace(/\/+$/, '');
  const endpoint = `${normalizedUrl}/auth/login`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });
  } catch (err: unknown) {
    throw new BackendAuthError(
      'network_error',
      `Network request to ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    await throwForStatus(response);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BackendAuthError(
      'invalid_response',
      `Login response from ${endpoint} could not be parsed as JSON`
    );
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Record<string, unknown>).token !== 'string' ||
    !(data as Record<string, unknown>).token
  ) {
    throw new BackendAuthError(
      'invalid_response',
      `Login response from ${endpoint} did not contain a "token" string field`
    );
  }

  const token = (data as { token: string }).token;

  // Persist server URL and token together. If either write fails, we surface
  // the error — a partial state (URL without token, or token without URL) would
  // leave the app in an unusable backend configuration.
  saveServerUrl(serverUrl);
  saveAuthToken(token);
}

/**
 * Log out from the self-hosted backend.
 *
 * Clears both the stored auth token and server URL from localStorage.
 * Synchronous. Does NOT make a network request — there is no server-side
 * logout endpoint in the current protocol. The backend's token-based auth
 * means that clearing the token is sufficient to end the session on the client.
 */
export function logout(): void {
  clearAuthToken();
  clearServerUrl();
}

// ─── Token refresh ────────────────────────────────────────────────────────────

/**
 * Refresh the current auth token.
 *
 * POSTs to {serverUrl}/auth/refresh with the current token in the
 * Authorization: Bearer header. On success, stores the new token.
 *
 * If no token is stored, returns immediately (nothing to refresh).
 * On 401 / 403 or network error: calls logout() and re-throws.
 *
 * Throws BackendAuthError on:
 *   - Network failure (code: 'network_error')
 *   - 401 / 403 response (code: 'unauthorized') — also calls logout()
 *   - 5xx response (code: 'server_error')
 *   - Response body missing or not containing a `token` string field
 *     (code: 'invalid_response')
 */
export async function refreshToken(): Promise<void> {
  const currentToken = getAuthToken();
  const serverUrl = getServerUrl();

  // No token stored — nothing to refresh.
  if (!currentToken || !serverUrl) return;

  const endpoint = `${serverUrl}/auth/refresh`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    });
  } catch (err: unknown) {
    // Network failure during refresh — log out and re-throw so the caller
    // (typically an interval timer) knows to stop retrying.
    logout();
    throw new BackendAuthError(
      'network_error',
      `Token refresh network request to ${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!response.ok) {
    // Any auth or server error during refresh clears the stored credentials
    // and falls back to local mode.
    logout();
    await throwForStatus(response);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new BackendAuthError(
      'invalid_response',
      `Token refresh response from ${endpoint} could not be parsed as JSON`
    );
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    typeof (data as Record<string, unknown>).token !== 'string' ||
    !(data as Record<string, unknown>).token
  ) {
    throw new BackendAuthError(
      'invalid_response',
      `Token refresh response from ${endpoint} did not contain a "token" string field`
    );
  }

  const newToken = (data as { token: string }).token;
  saveAuthToken(newToken);
}

// ─── Storage provider factory ─────────────────────────────────────────────────

/**
 * Return the appropriate StorageProvider for the current configuration.
 *
 * If both serverUrl and authToken are stored, returns a ServerStorageProvider
 * pointed at the configured backend with the current auth token.
 *
 * If either is absent (or both), returns a LocalStorageProvider.
 *
 * This is the function App.tsx calls to pass to useConversationStore().
 * It is intentionally side-effect-free — it reads localStorage and
 * constructs a provider; it does not mutate any state.
 */
export function getActiveStorageProvider(): StorageProvider {
  const serverUrl = getServerUrl();
  const authToken = getAuthToken();

  if (serverUrl && authToken) {
    return createStorageProvider({ mode: 'server', baseUrl: serverUrl, authToken });
  }

  return createStorageProvider({ mode: 'local' });
}

// ─── Auth state helpers ───────────────────────────────────────────────────────

/**
 * Returns true if both a server URL and auth token are stored, indicating that
 * the user has logged in to a self-hosted backend.
 *
 * The server URL is always in localStorage. The auth token may be in either
 * localStorage (logoutOnClose=false) or sessionStorage (logoutOnClose=true) —
 * getAuthToken() checks both.
 *
 * Does not validate reachability or token validity — it only checks storage.
 */
export function isBackendConfigured(): boolean {
  return Boolean(getServerUrl() && getAuthToken());
}

/**
 * Returns the current storage mode based on whether backend auth is configured.
 *
 * 'server' — serverUrl and authToken are both present; ServerStorageProvider
 *            will be used by getActiveStorageProvider().
 * 'local'  — no backend configured; LocalStorageProvider will be used.
 */
export function getBackendFallbackStatus(): 'local' | 'server' {
  return isBackendConfigured() ? 'server' : 'local';
}
