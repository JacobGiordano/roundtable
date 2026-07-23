/**
 * Gate — logoutOnClose.ts
 *
 * Manages the `logoutOnClose` preference: whether the backend auth token
 * should survive across browser sessions.
 *
 * When `logoutOnClose` is `false` (default): the auth token is stored in
 * `localStorage` and persists until the user explicitly logs out or the token
 * expires. Suitable for personal machines.
 *
 * When `logoutOnClose` is `true`: the auth token is stored in `sessionStorage`
 * instead. `sessionStorage` is cleared by the browser when the tab or window
 * closes, so the session ends automatically on close. This is the appropriate
 * choice for shared machines.
 *
 * The preference itself is always stored in `localStorage` — it must survive
 * across sessions so the user does not have to re-configure it each time.
 *
 * Storage key: 'roundtable:logout-on-close'
 *
 * UI toggle: deferred to a future Aria wave (issue #456 Gate scope only).
 */

const LOGOUT_ON_CLOSE_KEY = 'roundtable:logout-on-close' as const;

/**
 * Read the `logoutOnClose` preference from localStorage.
 * Returns `false` (the safe default — no behavior change) when no value
 * has been saved or the stored value is not a valid boolean string.
 */
export function getLogoutOnClose(): boolean {
  const raw = localStorage.getItem(LOGOUT_ON_CLOSE_KEY);
  return raw === 'true';
}

/**
 * Persist the `logoutOnClose` preference to localStorage.
 * This preference is always in localStorage regardless of the auth token
 * storage path — the meta-preference about how to store tokens must outlast
 * any individual session.
 */
export function saveLogoutOnClose(value: boolean): void {
  localStorage.setItem(LOGOUT_ON_CLOSE_KEY, String(value));
}

/**
 * Remove the `logoutOnClose` preference, returning to the default (false).
 */
export function clearLogoutOnClose(): void {
  localStorage.removeItem(LOGOUT_ON_CLOSE_KEY);
}
