/**
 * StorageError — typed error for storage-layer failures.
 *
 * Used by both LocalStorageProvider (quota exceeded, parse failures) and
 * ServerStorageProvider (network errors, HTTP error responses) so callers can
 * catch and distinguish storage failures from other application errors.
 *
 * Code semantics — mirrors the StorageError.code union in /src/types/index.ts:
 *   quota_exceeded  — localStorage quota full (LocalStorageProvider)
 *   parse_failure   — stored data present but corrupt, JSON.parse failure
 *                     (LocalStorageProvider)
 *   network_error   — fetch() rejected: no network or DNS (ServerStorageProvider)
 *   server_error    — HTTP 5xx from the backend (ServerStorageProvider)
 *   not_found       — HTTP 404 or record missing (ServerStorageProvider)
 *   auth_failure    — HTTP 401 / 403 from the backend (ServerStorageProvider)
 *   parse_error     — response body could not be parsed as expected JSON
 *                     (ServerStorageProvider)
 *   unknown         — catch-all
 *
 * Note: parse_failure (LocalStorageProvider) and parse_error (ServerStorageProvider)
 * both describe a JSON parse failure but originate from different providers. Both
 * codes are in the union so switch statements on StorageError.code remain exhaustive
 * across all Vault implementations. This mirrors the same intentional dual-code
 * design in the shared contract at /src/types/index.ts.
 */

export type StorageErrorCode =
  | 'quota_exceeded'    // localStorage quota full
  | 'parse_failure'     // stored data corrupt — JSON.parse failure (LocalStorageProvider)
  | 'network_error'     // fetch failed (no response)
  | 'server_error'      // HTTP 5xx
  | 'not_found'         // HTTP 404 or record missing
  | 'auth_failure'      // HTTP 401 / 403
  | 'parse_error'       // response body could not be parsed as expected JSON (ServerStorageProvider)
  | 'unknown';          // catch-all

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  /** HTTP status code, if the error came from an HTTP response. */
  readonly status?: number;

  constructor(code: StorageErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.status = status;
  }
}
