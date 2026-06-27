/**
 * Gate — credentialTest.test.ts
 *
 * Tests for:
 *   - testCredential()       — built-in provider key validation
 *   - testCustomCredential() — custom OpenAI-compatible endpoint testing
 *
 * All tests use vi.stubGlobal('fetch', ...) to intercept HTTP calls.
 * No real network requests are made.
 *
 * Security: no real API key values appear in this file.
 * Test keys are syntactically plausible but not functional.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testCredential, testCustomCredential } from './credentialTest';

// ─── fetch mock helpers ───────────────────────────────────────────────────────

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetchResponse(status: number): FetchMock {
  return vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300 });
}

function mockFetchThrow(error: Error = new TypeError('Failed to fetch')): FetchMock {
  return vi.fn().mockRejectedValue(error);
}

// ─── testCredential ───────────────────────────────────────────────────────────

describe('testCredential — built-in providers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('200 → valid', () => {
    it.each([
      ['anthropic'],
      ['openai'],
      ['google'],
      ['xai'],
      ['deepseek'],
      ['mistral'],
    ] as const)('%s returns valid on 200', async (key) => {
      vi.stubGlobal('fetch', mockFetchResponse(200));
      const result = await testCredential(key, 'sk-test-key');
      expect(result.status).toBe('valid');
      expect(result.message).toBeTruthy();
    });
  });

  describe('401 → invalid', () => {
    it.each([
      ['anthropic'],
      ['openai'],
    ] as const)('%s returns invalid on 401', async (key) => {
      vi.stubGlobal('fetch', mockFetchResponse(401));
      const result = await testCredential(key, 'sk-bad-key');
      expect(result.status).toBe('invalid');
    });
  });

  describe('403 → invalid', () => {
    it('returns invalid on 403', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(403));
      const result = await testCredential('anthropic', 'sk-bad-key');
      expect(result.status).toBe('invalid');
    });
  });

  describe('429 → rate-limited', () => {
    it('returns rate-limited on 429', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(429));
      const result = await testCredential('openai', 'sk-valid-but-busy');
      expect(result.status).toBe('rate-limited');
    });
  });

  describe('5xx → error', () => {
    it('returns error on 500', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(500));
      const result = await testCredential('anthropic', 'sk-test');
      expect(result.status).toBe('error');
      expect(result.message).toContain('500');
    });

    it('returns error on 503', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(503));
      const result = await testCredential('mistral', 'sk-test');
      expect(result.status).toBe('error');
      expect(result.message).toContain('503');
    });
  });

  describe('network failure → cors-or-network', () => {
    it('returns cors-or-network on fetch throw (CORS or network error)', async () => {
      vi.stubGlobal('fetch', mockFetchThrow());
      const result = await testCredential('anthropic', 'sk-test');
      expect(result.status).toBe('cors-or-network');
    });

    it('returns cors-or-network on fetch throw for all built-in providers', async () => {
      const providers = ['anthropic', 'openai', 'google', 'xai', 'deepseek', 'mistral'] as const;
      for (const key of providers) {
        vi.unstubAllGlobals();
        vi.stubGlobal('fetch', mockFetchThrow());
        const result = await testCredential(key, 'sk-test');
        expect(result.status).toBe('cors-or-network');
      }
    });

    it('cors-or-network message mentions CORS or network', async () => {
      vi.stubGlobal('fetch', mockFetchThrow());
      const result = await testCredential('anthropic', 'sk-test');
      expect(result.status).toBe('cors-or-network');
      expect(result.message.toLowerCase()).toMatch(/cors|network/);
    });
  });

  describe('unknown credentialKey', () => {
    it('returns error for an unrecognised credential key', async () => {
      vi.stubGlobal('fetch', mockFetchResponse(200));
      const result = await testCredential('custom:some-provider', 'sk-test');
      expect(result.status).toBe('error');
      expect(result.message).toContain('not supported');
    });
  });

  describe('request shape — anthropic', () => {
    it('sends x-api-key, anthropic-version, and browser-access headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await testCredential('anthropic', 'sk-ant-test');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      // In test / dev mode the URL routes through the Vite proxy (/anthropic-proxy)
      // or VITE_ANTHROPIC_PROXY_URL. The URL will NOT be the direct api.anthropic.com
      // address — that's the whole point of the fix.
      expect(url).toContain('/v1/models');
      expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-ant-test');
      expect((init.headers as Record<string, string>)['anthropic-version']).toBeTruthy();
      expect(
        (init.headers as Record<string, string>)['anthropic-dangerous-direct-browser-access'],
      ).toBe('true');
    });
  });

  describe('request shape — openai', () => {
    it('sends Authorization: Bearer header', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await testCredential('openai', 'sk-openai-test');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      // In test / dev mode the URL routes through the Vite proxy (/openai-proxy)
      // or VITE_OPENAI_PROXY_URL. The URL will NOT be the direct api.openai.com
      // address — that's the whole point of the fix for the CORS error.
      expect(url).toContain('/v1/models');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-openai-test');
    });
  });

  describe('request shape — google', () => {
    it('passes key as URL query parameter', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await testCredential('google', 'AIzaTestKey');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('key=AIzaTestKey');
    });

    it('URL-encodes the google key', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
      vi.stubGlobal('fetch', fetchMock);
      await testCredential('google', 'key with spaces');
      const [url] = fetchMock.mock.calls[0] as [string];
      // encodeURIComponent encodes spaces as %20 (not +)
      expect(url).toContain('key=key%20with%20spaces');
    });
  });
});

// ─── testCustomCredential ─────────────────────────────────────────────────────

describe('testCustomCredential — custom OpenAI-compatible endpoints', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── empty/missing endpoint URL ────────────────────────────────────────────

  it('returns error when endpointUrl is empty string', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(200));
    const result = await testCustomCredential('');
    expect(result.status).toBe('error');
    expect(result.message).toBeTruthy();
  });

  it('returns error when endpointUrl is whitespace', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(200));
    const result = await testCustomCredential('   ');
    expect(result.status).toBe('error');
  });

  // ─── URL normalisation ──────────────────────────────────────────────────────

  it('appends /models to a base URL without trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1', 'test-key');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/models');
  });

  it('appends /models to a base URL with trailing slash', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1/', 'test-key');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/models');
  });

  it('does not double-append /models when base URL already ends with /models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1/models', 'test-key');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/models');
  });

  it('strips multiple trailing slashes before appending /models', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1///', 'test-key');
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('http://localhost:11434/v1/models');
  });

  // ─── keyed endpoints ────────────────────────────────────────────────────────

  it('sends Authorization: Bearer header when apiKey is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://my-proxy/v1', 'sk-my-proxy-key');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-my-proxy-key');
  });

  it('trims whitespace from apiKey before use', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://my-proxy/v1', '  sk-trimmed  ');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-trimmed');
  });

  it('returns valid on 200 with a key', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(200));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-my-key');
    expect(result.status).toBe('valid');
  });

  it('returns invalid on 401 with a key', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-bad-key');
    expect(result.status).toBe('invalid');
  });

  it('returns invalid on 403 with a key', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(403));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-bad-key');
    expect(result.status).toBe('invalid');
  });

  it('returns rate-limited on 429', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(429));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-valid-key');
    expect(result.status).toBe('rate-limited');
  });

  it('returns error on 500', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(500));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-key');
    expect(result.status).toBe('error');
    expect(result.message).toContain('500');
  });

  // ─── keyless endpoints (e.g. local Ollama) ─────────────────────────────────

  it('omits Authorization header when apiKey is absent', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('omits Authorization header when apiKey is empty string', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1', '');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('omits Authorization header when apiKey is whitespace-only', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://localhost:11434/v1', '   ');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('returns valid on 200 for keyless endpoint', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(200));
    const result = await testCustomCredential('http://localhost:11434/v1');
    expect(result.status).toBe('valid');
  });

  it('returns invalid with "auth required" message on 401 for keyless endpoint', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401));
    const result = await testCustomCredential('http://localhost:11434/v1');
    expect(result.status).toBe('invalid');
    expect(result.message.toLowerCase()).toContain('key');
  });

  it('returns invalid with "auth required" message on 403 for keyless endpoint', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(403));
    const result = await testCustomCredential('http://localhost:11434/v1');
    expect(result.status).toBe('invalid');
    expect(result.message.toLowerCase()).toContain('key');
  });

  // ─── CORS / network failures ────────────────────────────────────────────────

  it('returns cors-or-network when fetch throws TypeError (CORS)', async () => {
    vi.stubGlobal('fetch', mockFetchThrow(new TypeError('Failed to fetch')));
    const result = await testCustomCredential('http://localhost:11434/v1', 'sk-key');
    expect(result.status).toBe('cors-or-network');
  });

  it('returns cors-or-network when fetch throws on keyless endpoint', async () => {
    vi.stubGlobal('fetch', mockFetchThrow(new TypeError('NetworkError')));
    const result = await testCustomCredential('http://localhost:11434/v1');
    expect(result.status).toBe('cors-or-network');
  });

  it('cors-or-network message mentions CORS', async () => {
    vi.stubGlobal('fetch', mockFetchThrow(new TypeError('Failed to fetch')));
    const result = await testCustomCredential('http://my-proxy/v1', 'sk-key');
    expect(result.status).toBe('cors-or-network');
    expect(result.message.toLowerCase()).toContain('cors');
  });

  it('returns cors-or-network on any thrown error (e.g. connection refused)', async () => {
    vi.stubGlobal('fetch', mockFetchThrow(new Error('ECONNREFUSED')));
    const result = await testCustomCredential('http://localhost:9999/v1', 'sk-key');
    expect(result.status).toBe('cors-or-network');
  });

  // ─── does not use built-in provider config ──────────────────────────────────

  it('makes a real fetch call (not a no-op) for any valid URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    await testCustomCredential('http://custom-provider/api/v1', 'sk-key');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
