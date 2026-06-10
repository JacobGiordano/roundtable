/**
 * Unit tests for ServerStorageProvider, createStorageProvider, and migrateLocalToServer.
 *
 * `fetch` is mocked via vi.stubGlobal — no real network calls are made.
 * Each test gets a fresh mock reset via beforeEach.
 *
 * Coverage:
 *   ServerStorageProvider:
 *     - ghost-mode guard: saveConversation returns immediately when isGhost is true
 *     - saveConversation: PUT /conversations/:id with correct body and headers
 *     - saveConversation: throws StorageError on HTTP 5xx
 *     - saveConversation: throws StorageError(network_error) when fetch rejects
 *     - loadConversation: GET /conversations/:id returns parsed conversation
 *     - loadConversation: returns null on 404
 *     - loadConversation: throws on 5xx
 *     - loadConversation: throws StorageError(parse_error) on malformed JSON
 *     - listConversations: GET /conversations returns array
 *     - listConversations: throws StorageError(parse_error) when response is not an array
 *     - deleteConversation: DELETE /conversations/:id
 *     - deleteConversation: no-op (no throw) on 404
 *     - archiveConversation: PATCH with { archived: true }
 *     - archiveConversation: no-op on 404
 *     - unarchiveConversation: PATCH with { archived: false }
 *     - unarchiveConversation: no-op on 404
 *     - exportConversation: GET /conversations/:id/export?format=markdown
 *     - exportConversation: returns null on 404
 *     - auth header is sent when authToken is provided
 *     - auth header is absent when authToken is omitted
 *     - trailing slash in baseUrl is stripped
 *
 *   createStorageProvider:
 *     - returns LocalStorageProvider for mode 'local'
 *     - returns ServerStorageProvider for mode 'server'
 *
 *   migrateLocalToServer:
 *     - copies all conversations from local to server
 *     - continues after individual failures, collects errors
 *     - records migrated/failed counts correctly
 *     - handles listConversations() failure gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerStorageProvider } from './ServerStorageProvider';
import { StorageError } from './StorageError';
import { LocalStorageProvider } from './LocalStorageProvider';
import { createStorageProvider, migrateLocalToServer } from './storageFactory';
import type { Conversation, ExportedConversation, ModelConfig } from '@/types/index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MODEL: ModelConfig = {
  modelId: 'claude',
  name: 'Claude',
  color: 'violet',
  isActive: true,
};

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    title: 'Test conversation',
    messages: [],
    models: [MODEL],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeExported(): ExportedConversation {
  return {
    content: '# Test',
    filename: 'test.md',
    mimeType: 'text/markdown;charset=utf-8',
  };
}

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

/**
 * Build a minimal Response-like object that satisfies the properties we read
 * in ServerStorageProvider (ok, status, statusText, text(), json()).
 */
function mockResponse(
  status: number,
  body: unknown = null,
  options: { statusText?: string } = {},
): Response {
  const bodyText = body === null ? '' : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: options.statusText ?? (status === 200 ? 'OK' : String(status)),
    text: () => Promise.resolve(bodyText),
    json: () => {
      try {
        return Promise.resolve(JSON.parse(bodyText));
      } catch {
        return Promise.reject(new SyntaxError('Invalid JSON'));
      }
    },
  } as unknown as Response;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://roundtable.example.com/api';

let provider: ServerStorageProvider;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  provider = new ServerStorageProvider({ baseUrl: BASE_URL });
});

// ─── saveConversation ─────────────────────────────────────────────────────────

describe('saveConversation', () => {
  it('ghost-mode guard: returns immediately without fetching when isGhost is true', async () => {
    const ghost = makeConversation({ isGhost: true });
    await provider.saveConversation(ghost);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends PUT to /conversations/:id with JSON body', async () => {
    fetchMock.mockResolvedValue(mockResponse(200));
    const conv = makeConversation();
    await provider.saveConversation(conv);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/conversations/conv-1`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual(conv);
  });

  it('includes Content-Type application/json header', async () => {
    fetchMock.mockResolvedValue(mockResponse(200));
    await provider.saveConversation(makeConversation());
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('throws StorageError(server_error) on HTTP 500', async () => {
    fetchMock.mockResolvedValue(mockResponse(500, null, { statusText: 'Internal Server Error' }));
    await expect(provider.saveConversation(makeConversation())).rejects.toThrow(StorageError);
    await expect(provider.saveConversation(makeConversation())).rejects.toMatchObject({
      code: 'server_error',
      status: 500,
    });
  });

  it('throws StorageError(network_error) when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(provider.saveConversation(makeConversation())).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it('throws StorageError(auth_failure) on HTTP 401', async () => {
    fetchMock.mockResolvedValue(mockResponse(401));
    await expect(provider.saveConversation(makeConversation())).rejects.toMatchObject({
      code: 'auth_failure',
      status: 401,
    });
  });

  it('throws StorageError(auth_failure) on HTTP 403', async () => {
    fetchMock.mockResolvedValue(mockResponse(403));
    await expect(provider.saveConversation(makeConversation())).rejects.toMatchObject({
      code: 'auth_failure',
      status: 403,
    });
  });
});

// ─── loadConversation ─────────────────────────────────────────────────────────

describe('loadConversation', () => {
  it('GETs /conversations/:id and returns parsed conversation', async () => {
    const conv = makeConversation();
    fetchMock.mockResolvedValue(mockResponse(200, conv));

    const result = await provider.loadConversation('conv-1');
    expect(result).toEqual(conv);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/conversations/conv-1`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(mockResponse(404));
    const result = await provider.loadConversation('missing');
    expect(result).toBeNull();
  });

  it('throws StorageError on 5xx', async () => {
    fetchMock.mockResolvedValue(mockResponse(503));
    await expect(provider.loadConversation('conv-1')).rejects.toMatchObject({
      code: 'server_error',
    });
  });

  it('throws StorageError(parse_error) when response body is invalid JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('not json'),
      json: () => Promise.reject(new SyntaxError('Invalid JSON')),
    } as unknown as Response);
    await expect(provider.loadConversation('conv-1')).rejects.toMatchObject({
      code: 'parse_error',
    });
  });
});

// ─── listConversations ────────────────────────────────────────────────────────

describe('listConversations', () => {
  it('GETs /conversations and returns the array', async () => {
    const convs = [makeConversation({ id: 'a' }), makeConversation({ id: 'b' })];
    fetchMock.mockResolvedValue(mockResponse(200, convs));

    const result = await provider.listConversations();
    expect(result).toEqual(convs);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/conversations`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws StorageError(parse_error) when response is not an array', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, { not: 'an array' }));
    await expect(provider.listConversations()).rejects.toMatchObject({
      code: 'parse_error',
    });
  });

  it('throws StorageError on HTTP error', async () => {
    fetchMock.mockResolvedValue(mockResponse(500));
    await expect(provider.listConversations()).rejects.toMatchObject({
      code: 'server_error',
    });
  });
});

// ─── deleteConversation ───────────────────────────────────────────────────────

describe('deleteConversation', () => {
  it('sends DELETE to /conversations/:id', async () => {
    fetchMock.mockResolvedValue(mockResponse(204));
    await provider.deleteConversation('conv-1');
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/conversations/conv-1`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('is a no-op (does not throw) on 404', async () => {
    fetchMock.mockResolvedValue(mockResponse(404));
    await expect(provider.deleteConversation('missing')).resolves.toBeUndefined();
  });

  it('throws StorageError on 5xx', async () => {
    fetchMock.mockResolvedValue(mockResponse(500));
    await expect(provider.deleteConversation('conv-1')).rejects.toMatchObject({
      code: 'server_error',
    });
  });
});

// ─── archiveConversation ──────────────────────────────────────────────────────

describe('archiveConversation', () => {
  it('sends PATCH /conversations/:id with { archived: true }', async () => {
    fetchMock.mockResolvedValue(mockResponse(200));
    await provider.archiveConversation('conv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/conversations/conv-1`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ archived: true });
  });

  it('is a no-op on 404', async () => {
    fetchMock.mockResolvedValue(mockResponse(404));
    await expect(provider.archiveConversation('missing')).resolves.toBeUndefined();
  });
});

// ─── unarchiveConversation ────────────────────────────────────────────────────

describe('unarchiveConversation', () => {
  it('sends PATCH /conversations/:id with { archived: false }', async () => {
    fetchMock.mockResolvedValue(mockResponse(200));
    await provider.unarchiveConversation('conv-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE_URL}/conversations/conv-1`);
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ archived: false });
  });

  it('is a no-op on 404', async () => {
    fetchMock.mockResolvedValue(mockResponse(404));
    await expect(provider.unarchiveConversation('missing')).resolves.toBeUndefined();
  });
});

// ─── exportConversation ───────────────────────────────────────────────────────

describe('exportConversation', () => {
  it('GETs /conversations/:id/export?format=markdown', async () => {
    const exported = makeExported();
    fetchMock.mockResolvedValue(mockResponse(200, exported));

    const result = await provider.exportConversation('conv-1', 'markdown');
    expect(result).toEqual(exported);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/conversations/conv-1/export?format=markdown`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('GETs /conversations/:id/export?format=html', async () => {
    const exported = { ...makeExported(), filename: 'test.html', mimeType: 'text/html' };
    fetchMock.mockResolvedValue(mockResponse(200, exported));

    const result = await provider.exportConversation('conv-1', 'html');
    expect(result).toEqual(exported);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/conversations/conv-1/export?format=html`,
      expect.anything(),
    );
  });

  it('returns null on 404', async () => {
    fetchMock.mockResolvedValue(mockResponse(404));
    const result = await provider.exportConversation('missing', 'markdown');
    expect(result).toBeNull();
  });

  it('throws StorageError(parse_error) on malformed response body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('not json'),
      json: () => Promise.reject(new SyntaxError('Invalid JSON')),
    } as unknown as Response);
    await expect(provider.exportConversation('conv-1', 'markdown')).rejects.toMatchObject({
      code: 'parse_error',
    });
  });
});

// ─── Auth header ──────────────────────────────────────────────────────────────

describe('Authorization header', () => {
  it('includes Bearer token when authToken is provided', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, []));
    const authedProvider = new ServerStorageProvider({
      baseUrl: BASE_URL,
      authToken: 'my-secret-token',
    });

    await authedProvider.listConversations();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-secret-token');
  });

  it('omits Authorization header when authToken is not provided', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, []));
    await provider.listConversations();

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});

// ─── Base URL trailing slash ──────────────────────────────────────────────────

describe('baseUrl trailing slash handling', () => {
  it('strips trailing slashes from baseUrl so URLs are not double-slashed', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, []));
    const slashProvider = new ServerStorageProvider({
      baseUrl: 'https://roundtable.example.com/api/',
    });

    await slashProvider.listConversations();

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://roundtable.example.com/api/conversations');
    // Explicitly confirm no double slash.
    expect(url).not.toContain('//conversations');
  });
});

// ─── createStorageProvider ────────────────────────────────────────────────────

describe('createStorageProvider', () => {
  it('returns a LocalStorageProvider for mode local', () => {
    // We do not import LocalStorageProvider class here to avoid dependency on
    // concrete type — just verify it satisfies StorageProvider interface by
    // duck-typing the key methods.
    const p = createStorageProvider({ mode: 'local' });
    expect(typeof p.saveConversation).toBe('function');
    expect(typeof p.loadConversation).toBe('function');
    expect(typeof p.listConversations).toBe('function');
    expect(typeof p.deleteConversation).toBe('function');
    expect(typeof p.archiveConversation).toBe('function');
    expect(typeof p.unarchiveConversation).toBe('function');
    expect(typeof p.exportConversation).toBe('function');
  });

  it('returns a ServerStorageProvider for mode server', () => {
    const p = createStorageProvider({ mode: 'server', baseUrl: BASE_URL });
    expect(p).toBeInstanceOf(ServerStorageProvider);
  });

  it('passes authToken to ServerStorageProvider', async () => {
    fetchMock.mockResolvedValue(mockResponse(200, []));
    const p = createStorageProvider({
      mode: 'server',
      baseUrl: BASE_URL,
      authToken: 'token-from-gate',
    });
    await p.listConversations();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer token-from-gate');
  });
});

// ─── migrateLocalToServer ─────────────────────────────────────────────────────

describe('migrateLocalToServer', () => {
  // Build an in-memory localStorage mock for LocalStorageProvider.
  function buildLocalStorageMock(store: Map<string, string>) {
    return {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
      clear: () => { store.clear(); },
      get length() { return store.size; },
      key: (index: number) => [...store.keys()][index] ?? null,
    };
  }

  let localProvider: LocalStorageProvider;
  let serverProvider: ServerStorageProvider;

  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: buildLocalStorageMock(store),
      writable: true,
      configurable: true,
    });
    localProvider = new LocalStorageProvider();
    serverProvider = new ServerStorageProvider({ baseUrl: BASE_URL });
  });

  it('migrates all conversations from local to server', async () => {
    const convA = makeConversation({ id: 'a' });
    const convB = makeConversation({ id: 'b' });
    await localProvider.saveConversation(convA);
    await localProvider.saveConversation(convB);

    // Both PUTs succeed.
    fetchMock.mockResolvedValue(mockResponse(200));

    const result = await migrateLocalToServer(localProvider, serverProvider);
    expect(result.migrated).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    // Two PUT requests should have been made.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('continues after individual failure and collects errors', async () => {
    const convA = makeConversation({ id: 'a' });
    const convB = makeConversation({ id: 'b' });
    await localProvider.saveConversation(convA);
    await localProvider.saveConversation(convB);

    // First PUT fails; second succeeds.
    fetchMock
      .mockResolvedValueOnce(mockResponse(500))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await migrateLocalToServer(localProvider, serverProvider);
    // One succeeded, one failed.
    expect(result.migrated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(StorageError);
  });

  it('returns { migrated: 0, failed: 0 } when local storage is empty', async () => {
    const result = await migrateLocalToServer(localProvider, serverProvider);
    expect(result.migrated).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a failed result when listConversations throws', async () => {
    // Corrupt the index so listConversations cannot read anything useful —
    // but LocalStorageProvider swallows corruption silently and returns [].
    // To test the error path we mock listConversations directly.
    const brokenLocal = {
      ...localProvider,
      listConversations: () => Promise.reject(new Error('disk failure')),
    } as unknown as LocalStorageProvider;

    const result = await migrateLocalToServer(brokenLocal, serverProvider);
    expect(result.migrated).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0].message).toContain('disk failure');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
