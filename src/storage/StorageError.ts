/**
 * StorageError — typed error for storage-layer failures.
 *
 * Used by both LocalStorageProvider (quota exceeded) and ServerStorageProvider
 * (network errors, HTTP error responses) so callers can catch and distinguish
 * storage failures from other application errors.
 */

export type StorageErrorCode =
  | 'quota_exceeded'    // localStorage quota full
  | 'network_error'     // fetch failed (no response)
  | 'server_error'      // HTTP 5xx
  | 'not_found'         // HTTP 404
  | 'auth_failure'      // HTTP 401 / 403
  | 'parse_error'       // response body could not be parsed as expected JSON
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
