/**
 * Gate — backendConfig.ts
 *
 * High-level backend configuration API for the settings UI (issue #170).
 *
 * Aria's BackendAuthPanel (Wave 2) calls these functions to read and persist
 * the server URL entered by the user. They are thin wrappers over the lower-level
 * getServerUrl / saveServerUrl primitives in backendAuth.ts — the wrapper layer
 * exists so Aria always works with a typed `BackendConfig` object rather than raw
 * strings, and so the UI surface is stable even if the internal storage schema
 * changes in Phase 4.
 *
 * `BackendConfig` is defined here (not in /src/types/index.ts) because it is a
 * Gate-internal detail. It crosses the agent boundary only as a return type and
 * parameter on the two exported functions; Aria imports the type from @/auth.
 * Arch does not need to be involved unless a second agent needs to read this type.
 *
 * localStorage keys (owned by backendAuth.ts):
 *   "roundtable:server-url" — the only field in BackendConfig at this time
 */

import { getServerUrl, saveServerUrl, clearServerUrl } from './backendAuth';

// ─── BackendConfig ─────────────────────────────────────────────────────────────

/**
 * Configuration for the self-hosted Roundtable backend.
 *
 * `serverUrl` is the base URL entered by the user (e.g. "https://rt.example.com").
 * Gate normalises trailing slashes on write (via saveServerUrl).
 *
 * Future Phase 4 fields (e.g. `authRequired: boolean`, `displayName: string`)
 * can be added here without an Arch types PR — this type lives inside Gate.
 * If another agent ever needs to read BackendConfig directly, move it to
 * /src/types/index.ts via Arch at that time.
 */
export interface BackendConfig {
  /** Base URL of the self-hosted backend, e.g. "https://rt.example.com". */
  serverUrl: string;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the stored backend configuration, or null if no server URL has been
 * saved.
 *
 * This is the only function Aria should call to determine whether a backend is
 * configured and what URL it points to. Do not call getServerUrl() directly from
 * the UI layer.
 */
export function getBackendConfig(): BackendConfig | null {
  const serverUrl = getServerUrl();
  if (!serverUrl) return null;
  return { serverUrl };
}

/**
 * Persist the backend configuration to localStorage.
 *
 * Currently writes `serverUrl` via saveServerUrl() (which strips trailing slashes
 * for consistency). Throws if localStorage is unavailable — the caller should
 * surface a storage error to the user in that case.
 *
 * Does NOT trigger login or token refresh — this only persists the URL.
 * The user still needs to complete the login flow via login() before the app
 * switches to server mode.
 */
export function saveBackendConfig(config: BackendConfig): void {
  saveServerUrl(config.serverUrl);
}

/**
 * Remove the stored backend configuration (server URL only).
 *
 * Distinct from logout(): clearBackendConfig removes the server URL but does
 * not clear the auth token. Use logout() (from backendAuth.ts) when the user
 * explicitly ends a session — that clears both. Use clearBackendConfig() only
 * when the user is removing the server URL from settings without necessarily
 * ending an authenticated session.
 *
 * In practice, the settings UI should call logout() rather than
 * clearBackendConfig() when the user disconnects from a backend.
 * This function exists for testing and for cases where only the URL needs resetting.
 */
export function clearBackendConfig(): void {
  clearServerUrl();
}
