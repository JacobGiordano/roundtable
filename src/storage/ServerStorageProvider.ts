/**
 * ServerStorageProvider — Vault implementation of StorageProvider over REST.
 *
 * Maps every StorageProvider method to an HTTP call against a self-hosted
 * Roundtable backend (issue #26). The backend must expose endpoints described
 * below. Uses `fetch` — no external dependencies.
 *
 * Endpoint map:
 *   listConversations()           → GET    /conversations
 *   loadConversation(id)          → GET    /conversations/:id
 *   saveConversation(conv)        → PUT    /conversations/:id
 *   deleteConversation(id)        → DELETE /conversations/:id
 *   archiveConversation(id)       → PATCH  /conversations/:id  { archived: true }
 *   unarchiveConversation(id)     → PATCH  /conversations/:id  { archived: false }
 *   exportConversation(id,format) → GET    /conversations/:id/export?format=<format>
 *
 * Ghost-mode guard:
 *   `saveConversation` is the canonical write guard. If `conversation.isGhost`
 *   is true, the method returns immediately without any network call. This is
 *   the first check on every write path.
 *
 * Error handling:
 *   - Network failures (fetch rejects) → StorageError(code: 'network_error')
 *   - HTTP 401 / 403                   → StorageError(code: 'auth_failure')
 *   - HTTP 404                         → StorageError(code: 'not_found') for
 *     write operations; read methods return null (per StorageProvider contract)
 *   - HTTP 5xx                         → StorageError(code: 'server_error')
 *   - Other non-ok responses           → StorageError(code: 'unknown')
 *   - Unparseable response body        → StorageError(code: 'parse_error')
 *
 * Swappability:
 *   This class is a drop-in replacement for LocalStorageProvider. The
 *   constructor config is the only surface that differs — callers use
 *   `createStorageProvider` to avoid depending on either class directly.
 */

import type {
  Conversation,
  ExportedConversation,
  ExportFormat,
  StorageProvider,
} from '@/types/index';

import { StorageError } from './StorageError';

// ─── Config ───────────────────────────────────────────────────────────────────

export interface ServerStorageConfig {
  /**
   * Base URL of the self-hosted backend, WITHOUT a trailing slash.
   * Example: "https://roundtable.example.com/api"
   */
  baseUrl: string;

  /**
   * Optional Bearer token included in every request as
   * `Authorization: Bearer <authToken>`. Provided by Gate after login.
   * When absent, no Authorization header is sent.
   */
  authToken?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map an HTTP status code to a StorageErrorCode for non-ok responses.
 */
function statusToCode(status: number): import('./StorageError').StorageErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'unknown';
}

// ─── ServerStorageProvider ────────────────────────────────────────────────────

export class ServerStorageProvider implements StorageProvider {
  private readonly _baseUrl: string;
  private readonly _authToken: string | undefined;

  constructor(config: ServerStorageConfig) {
    // Strip trailing slash so every URL build can uniformly prepend '/path'.
    this._baseUrl = config.baseUrl.replace(/\/+$/, '');
    this._authToken = config.authToken;
  }

  // ─── Request helpers ────────────────────────────────────────────────────────

  /**
   * Build the common Headers object for all requests.
   * Includes `Content-Type: application/json` on write requests (caller's
   * responsibility to pass the header when needed) and the Bearer token when
   * an authToken was provided.
   */
  private _headers(includeContentType: boolean = false): HeadersInit {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (this._authToken) {
      headers['Authorization'] = `Bearer ${this._authToken}`;
    }
    return headers;
  }

  /**
   * Execute a fetch and translate network / HTTP errors into StorageError.
   * Returns the raw Response on success (caller parses the body as needed).
   *
   * A 404 on a read path is NOT thrown here — the caller checks the status and
   * decides whether to return null or throw. Write paths treat 404 as an error.
   */
  private async _fetch(url: string, init?: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (err: unknown) {
      // fetch() itself rejected — no network or DNS failure.
      throw new StorageError(
        'network_error',
        `Network request failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return response;
  }

  /**
   * Throw a StorageError based on an HTTP response whose `ok` is false.
   * Used on write paths where every non-ok status is an error.
   */
  private async _throwForStatus(response: Response): Promise<never> {
    let body = '';
    try {
      body = await response.text();
    } catch {
      // Ignore — body read failure does not change the error semantics.
    }
    throw new StorageError(
      statusToCode(response.status),
      `HTTP ${response.status}: ${body || response.statusText}`,
      response.status
    );
  }

  // ─── StorageProvider implementation ─────────────────────────────────────────

  /**
   * Persist a conversation via PUT /conversations/:id.
   *
   * Ghost-mode guard: `isGhost === true` → immediate return, no network call.
   * This is the first line of the method, before any other logic.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    // Ghost-mode guard — canonical check, first line of the write path.
    if (conversation.isGhost) return;

    const url = `${this._baseUrl}/conversations/${encodeURIComponent(conversation.id)}`;
    const response = await this._fetch(url, {
      method: 'PUT',
      headers: this._headers(true),
      body: JSON.stringify(conversation),
    });

    if (!response.ok) {
      await this._throwForStatus(response);
    }
  }

  /**
   * Load a conversation via GET /conversations/:id.
   * Returns null if the server returns 404 or the response body cannot be parsed.
   */
  async loadConversation(id: string): Promise<Conversation | null> {
    const url = `${this._baseUrl}/conversations/${encodeURIComponent(id)}`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: this._headers(),
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      await this._throwForStatus(response);
    }

    try {
      return (await response.json()) as Conversation;
    } catch {
      throw new StorageError(
        'parse_error',
        `Failed to parse conversation response for id "${id}"`
      );
    }
  }

  /**
   * List all conversations via GET /conversations.
   * Returns an empty array if the response body cannot be parsed — the list
   * must remain usable even if the server returns unexpected data.
   */
  async listConversations(): Promise<Conversation[]> {
    const url = `${this._baseUrl}/conversations`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: this._headers(),
    });

    if (!response.ok) {
      await this._throwForStatus(response);
    }

    try {
      const data = (await response.json()) as Conversation[];
      // Guard: ensure the response is actually an array.
      if (!Array.isArray(data)) {
        throw new StorageError(
          'parse_error',
          'Expected an array from GET /conversations but received a non-array response'
        );
      }
      return data;
    } catch (err: unknown) {
      if (err instanceof StorageError) throw err;
      throw new StorageError(
        'parse_error',
        `Failed to parse conversation list response`
      );
    }
  }

  /**
   * Delete a conversation via DELETE /conversations/:id.
   * No-op behaviour: the StorageProvider contract says this is idempotent —
   * if the server returns 404, we treat it as success (the record is gone).
   */
  async deleteConversation(id: string): Promise<void> {
    const url = `${this._baseUrl}/conversations/${encodeURIComponent(id)}`;
    const response = await this._fetch(url, {
      method: 'DELETE',
      headers: this._headers(),
    });

    // 404 is idempotent — the conversation was already gone.
    if (response.status === 404) return;

    if (!response.ok) {
      await this._throwForStatus(response);
    }
  }

  /**
   * Archive a conversation via PATCH /conversations/:id { archived: true }.
   * No-op if the server returns 404.
   */
  async archiveConversation(id: string): Promise<void> {
    const url = `${this._baseUrl}/conversations/${encodeURIComponent(id)}`;
    const response = await this._fetch(url, {
      method: 'PATCH',
      headers: this._headers(true),
      body: JSON.stringify({ archived: true }),
    });

    if (response.status === 404) return;

    if (!response.ok) {
      await this._throwForStatus(response);
    }
  }

  /**
   * Unarchive a conversation via PATCH /conversations/:id { archived: false }.
   * No-op if the server returns 404.
   */
  async unarchiveConversation(id: string): Promise<void> {
    const url = `${this._baseUrl}/conversations/${encodeURIComponent(id)}`;
    const response = await this._fetch(url, {
      method: 'PATCH',
      headers: this._headers(true),
      body: JSON.stringify({ archived: false }),
    });

    if (response.status === 404) return;

    if (!response.ok) {
      await this._throwForStatus(response);
    }
  }

  /**
   * Export a conversation via GET /conversations/:id/export?format=<format>.
   * Returns null if the server returns 404.
   * The backend returns an ExportedConversation JSON object.
   */
  async exportConversation(id: string, format: ExportFormat): Promise<ExportedConversation | null> {
    const url = `${this._baseUrl}/conversations/${encodeURIComponent(id)}/export?format=${encodeURIComponent(format)}`;
    const response = await this._fetch(url, {
      method: 'GET',
      headers: this._headers(),
    });

    if (response.status === 404) return null;

    if (!response.ok) {
      await this._throwForStatus(response);
    }

    try {
      return (await response.json()) as ExportedConversation;
    } catch {
      throw new StorageError(
        'parse_error',
        `Failed to parse export response for conversation "${id}" (format: ${format})`
      );
    }
  }
}
