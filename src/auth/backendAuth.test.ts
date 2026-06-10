/**
 * Gate — backendAuth.test.ts
 *
 * Tests for:
 *   - login()
 *   - logout()
 *   - refreshToken()
 *   - getActiveStorageProvider()
 *   - isBackendConfigured()
 *   - getBackendFallbackStatus()
 *   - getServerUrl / saveServerUrl / clearServerUrl
 *   - clearAuthToken
 *
 * Uses vi.stubGlobal to replace global fetch with a mock.
 * Uses vitest's localStorage mock via vi.stubEnv + real localStorage from
 * @vitest/browser-environment or the built-in jsdom environment.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  login,
  logout,
  refreshToken,
  getActiveStorageProvider,
  isBackendConfigured,
  getBackendFallbackStatus,
  getServerUrl,
  saveServerUrl,
  clearServerUrl,
  clearAuthToken,
  BackendAuthError,
} from './backendAuth';

// ─── localStorage stub ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};

const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  }),
};

vi.stubGlobal('localStorage', localStorageMock);

// ─── fetch mock ───────────────────────────────────────────────────────────────

/**
 * Build a minimal Response-like object for the fetch mock.
 */
function mockResponse(
  status: number,
  body: unknown,
  ok?: boolean
): Response {
  const bodyText = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: String(status),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(bodyText),
  } as unknown as Response;
}

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear localStorage store before every test.
  Object.keys(localStorageStore).forEach((k) => delete localStorageStore[k]);
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Server URL persistence ───────────────────────────────────────────────────

describe('getServerUrl / saveServerUrl / clearServerUrl', () => {
  it('returns undefined when no server URL is stored', () => {
    expect(getServerUrl()).toBeUndefined();
  });

  it('persists and retrieves a server URL', () => {
    saveServerUrl('https://example.com');
    expect(getServerUrl()).toBe('https://example.com');
  });

  it('strips trailing slashes on save', () => {
    saveServerUrl('https://example.com/////');
    expect(getServerUrl()).toBe('https://example.com');
  });

  it('clears the stored server URL', () => {
    saveServerUrl('https://example.com');
    clearServerUrl();
    expect(getServerUrl()).toBeUndefined();
  });
});

// ─── clearAuthToken ───────────────────────────────────────────────────────────

describe('clearAuthToken', () => {
  it('removes the auth token key from localStorage', () => {
    // Seed the token directly to avoid calling private saveAuthToken.
    localStorageStore['roundtable:auth-token'] = 'tok-123';
    clearAuthToken();
    expect(localStorageStore['roundtable:auth-token']).toBeUndefined();
  });
});

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  it('clears both auth token and server URL', () => {
    localStorageStore['roundtable:auth-token'] = 'tok-abc';
    localStorageStore['roundtable:server-url'] = 'https://example.com';

    logout();

    expect(localStorageStore['roundtable:auth-token']).toBeUndefined();
    expect(localStorageStore['roundtable:server-url']).toBeUndefined();
  });

  it('is a no-op when nothing is stored', () => {
    expect(() => logout()).not.toThrow();
  });
});

// ─── isBackendConfigured / getBackendFallbackStatus ───────────────────────────

describe('isBackendConfigured', () => {
  it('returns false when nothing is stored', () => {
    expect(isBackendConfigured()).toBe(false);
  });

  it('returns false when only server URL is stored', () => {
    saveServerUrl('https://example.com');
    expect(isBackendConfigured()).toBe(false);
  });

  it('returns false when only auth token is stored', () => {
    localStorageStore['roundtable:auth-token'] = 'tok-xyz';
    expect(isBackendConfigured()).toBe(false);
  });

  it('returns true when both server URL and auth token are stored', () => {
    saveServerUrl('https://example.com');
    localStorageStore['roundtable:auth-token'] = 'tok-xyz';
    expect(isBackendConfigured()).toBe(true);
  });
});

describe('getBackendFallbackStatus', () => {
  it('returns "local" when backend is not configured', () => {
    expect(getBackendFallbackStatus()).toBe('local');
  });

  it('returns "server" when backend is fully configured', () => {
    saveServerUrl('https://example.com');
    localStorageStore['roundtable:auth-token'] = 'tok-xyz';
    expect(getBackendFallbackStatus()).toBe('server');
  });
});

// ─── getActiveStorageProvider ─────────────────────────────────────────────────

describe('getActiveStorageProvider', () => {
  it('returns a StorageProvider (object with required methods) in local mode', () => {
    const provider = getActiveStorageProvider();
    expect(typeof provider.saveConversation).toBe('function');
    expect(typeof provider.loadConversation).toBe('function');
    expect(typeof provider.listConversations).toBe('function');
    expect(typeof provider.deleteConversation).toBe('function');
  });

  it('returns a StorageProvider in server mode when both URL and token are set', () => {
    saveServerUrl('https://rt.example.com');
    localStorageStore['roundtable:auth-token'] = 'tok-server';
    const provider = getActiveStorageProvider();
    expect(typeof provider.saveConversation).toBe('function');
    expect(typeof provider.loadConversation).toBe('function');
    expect(typeof provider.listConversations).toBe('function');
  });

  it('falls back to local mode when token is missing', () => {
    saveServerUrl('https://rt.example.com');
    // No token set — should fall back to local mode.
    const provider = getActiveStorageProvider();
    // LocalStorageProvider constructor succeeds; verify interface shape.
    expect(typeof provider.saveConversation).toBe('function');
  });

  it('falls back to local mode when server URL is missing', () => {
    localStorageStore['roundtable:auth-token'] = 'tok-orphan';
    const provider = getActiveStorageProvider();
    expect(typeof provider.saveConversation).toBe('function');
  });
});

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  const SERVER_URL = 'https://rt.example.com';
  const USERNAME = 'alice';
  const PASSWORD = 'secret';
  const TOKEN = 'tok-returned-by-server';

  it('POSTs to {serverUrl}/auth/login with username and password', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { token: TOKEN })
    );
    vi.stubGlobal('fetch', fetchMock);

    await login(SERVER_URL, USERNAME, PASSWORD);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SERVER_URL}/auth/login`);
    expect(init.method).toBe('POST');

    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ username: USERNAME, password: PASSWORD });
  });

  it('strips trailing slash from serverUrl before constructing endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { token: TOKEN })
    );
    vi.stubGlobal('fetch', fetchMock);

    await login('https://rt.example.com///', USERNAME, PASSWORD);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://rt.example.com/auth/login');
  });

  it('persists the server URL and auth token on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { token: TOKEN })
    ));

    await login(SERVER_URL, USERNAME, PASSWORD);

    expect(getServerUrl()).toBe(SERVER_URL);
    // Auth token is readable only via isBackendConfigured — we check indirectly.
    expect(isBackendConfigured()).toBe(true);
  });

  it('throws BackendAuthError with code "unauthorized" on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(401, 'Unauthorized', false)
    ));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toThrow(BackendAuthError);
    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'unauthorized',
      httpStatus: 401,
    });
  });

  it('throws BackendAuthError with code "unauthorized" on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(403, 'Forbidden', false)
    ));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'unauthorized',
      httpStatus: 403,
    });
  });

  it('throws BackendAuthError with code "server_error" on 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(500, 'Internal Server Error', false)
    ));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'server_error',
      httpStatus: 500,
    });
  });

  it('throws BackendAuthError with code "network_error" when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('DNS failure')));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'network_error',
    });
  });

  it('throws BackendAuthError with code "invalid_response" when token field is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { status: 'ok' }) // no "token" field
    ));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('throws BackendAuthError with code "invalid_response" when token is empty string', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { token: '' })
    ));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('throws BackendAuthError with code "invalid_response" when response body is not JSON', async () => {
    const badResponse = {
      ok: true,
      status: 200,
      statusText: 'OK',
      json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      text: vi.fn().mockResolvedValue('not json'),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(badResponse));

    await expect(login(SERVER_URL, USERNAME, PASSWORD)).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('does not persist anything on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(401, 'Unauthorized', false)
    ));

    try {
      await login(SERVER_URL, USERNAME, PASSWORD);
    } catch {
      // expected
    }

    expect(getServerUrl()).toBeUndefined();
    expect(isBackendConfigured()).toBe(false);
  });
});

// ─── refreshToken ─────────────────────────────────────────────────────────────

describe('refreshToken', () => {
  const SERVER_URL = 'https://rt.example.com';
  const INITIAL_TOKEN = 'tok-initial';
  const NEW_TOKEN = 'tok-refreshed';

  function seedCredentials() {
    saveServerUrl(SERVER_URL);
    localStorageStore['roundtable:auth-token'] = INITIAL_TOKEN;
  }

  it('returns immediately (no fetch) when no token is stored', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await refreshToken();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns immediately (no fetch) when no server URL is stored', async () => {
    localStorageStore['roundtable:auth-token'] = INITIAL_TOKEN;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await refreshToken();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs to {serverUrl}/auth/refresh with Bearer token', async () => {
    seedCredentials();
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, { token: NEW_TOKEN })
    );
    vi.stubGlobal('fetch', fetchMock);

    await refreshToken();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${SERVER_URL}/auth/refresh`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      `Bearer ${INITIAL_TOKEN}`
    );
  });

  it('stores the new token on success', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { token: NEW_TOKEN })
    ));

    await refreshToken();

    // The new token is now active — verifiable via isBackendConfigured remaining true.
    expect(isBackendConfigured()).toBe(true);
    // We also verify that the new token was written to localStorage directly.
    expect(localStorageStore['roundtable:auth-token']).toBe(NEW_TOKEN);
  });

  it('calls logout() and throws on 401', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(401, 'Unauthorized', false)
    ));

    await expect(refreshToken()).rejects.toMatchObject({ code: 'unauthorized' });
    // logout() should have been called — both token and URL cleared.
    expect(isBackendConfigured()).toBe(false);
  });

  it('calls logout() and throws on network error', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    await expect(refreshToken()).rejects.toMatchObject({ code: 'network_error' });
    expect(isBackendConfigured()).toBe(false);
  });

  it('throws with code "server_error" on 500 and clears credentials', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(500, 'Server Error', false)
    ));

    await expect(refreshToken()).rejects.toMatchObject({ code: 'server_error' });
    expect(isBackendConfigured()).toBe(false);
  });

  it('throws with code "invalid_response" when refresh response has no token', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { success: true })
    ));

    await expect(refreshToken()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('does not call logout() on invalid_response (token was valid, just bad response)', async () => {
    seedCredentials();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      mockResponse(200, { success: true })
    ));

    try {
      await refreshToken();
    } catch {
      // expected
    }

    // Credentials should still be present — invalid_response does not mean the
    // token is revoked; it means the server sent a malformed response.
    expect(isBackendConfigured()).toBe(true);
  });
});
