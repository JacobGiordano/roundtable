/**
 * Integration: Gate — testCustomCredential requiresApiKey:false short-circuit (#269)
 *
 * Verifies that testCustomCredential() short-circuits immediately when
 * requiresApiKey === false:
 *   - Returns { status: 'valid', message: 'No API key required' }
 *   - Makes zero fetch() calls (no network contact whatsoever)
 *
 * Also verifies that when requiresApiKey is true or absent, the existing
 * fetch-based behavior is unchanged (no regression).
 *
 * All tests mock fetch at the global boundary — no real network calls are made.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { testCustomCredential } from '@/auth/credentialTest';

// ─── fetch mock helpers ───────────────────────────────────────────────────────

function mockFetchResponse(status: number) {
  return vi.fn().mockResolvedValue({ status, ok: status >= 200 && status < 300 });
}

function mockFetchThrow(error: Error = new TypeError('Failed to fetch')) {
  return vi.fn().mockRejectedValue(error);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── requiresApiKey:false — short-circuit ─────────────────────────────────────

describe('testCustomCredential — requiresApiKey:false short-circuit', () => {
  it('returns valid with "No API key required" message', async () => {
    // Stub fetch so any accidental call produces a detectable error.
    vi.stubGlobal('fetch', mockFetchThrow(new Error('fetch should not be called')));

    const result = await testCustomCredential(
      'http://localhost:11434/v1',
      undefined,
      false,
    );

    expect(result.status).toBe('valid');
    expect(result.message).toBe('No API key required');
  });

  it('makes zero fetch calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    await testCustomCredential('http://localhost:11434/v1', undefined, false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits regardless of provided apiKey value', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    // Even if a key is provided alongside requiresApiKey:false, no fetch occurs.
    await testCustomCredential('http://localhost:11434/v1', 'some-key', false);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('short-circuits even when endpointUrl is empty', async () => {
    // The empty URL check normally returns an error, but requiresApiKey:false
    // short-circuits before reaching that check.
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const result = await testCustomCredential('', undefined, false);

    expect(result.status).toBe('valid');
    expect(result.message).toBe('No API key required');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the exact TestResult shape expected by the UI', async () => {
    vi.stubGlobal('fetch', mockFetchThrow());

    const result = await testCustomCredential('http://localhost:11434/v1', undefined, false);

    // Verify the shape is a valid TestResult — both fields present.
    expect(result).toHaveProperty('status', 'valid');
    expect(result).toHaveProperty('message');
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
  });
});

// ─── requiresApiKey:true — existing fetch behavior unchanged ──────────────────

describe('testCustomCredential — requiresApiKey:true does NOT short-circuit', () => {
  it('makes a fetch call when requiresApiKey is true', async () => {
    const fetchMock = mockFetchResponse(200);
    vi.stubGlobal('fetch', fetchMock);

    await testCustomCredential('http://localhost:11434/v1', 'sk-key', true);

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns valid on 200 when requiresApiKey is true', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(200));

    const result = await testCustomCredential('http://my-provider/v1', 'sk-key', true);

    expect(result.status).toBe('valid');
  });

  it('returns invalid on 401 when requiresApiKey is true', async () => {
    vi.stubGlobal('fetch', mockFetchResponse(401));

    const result = await testCustomCredential('http://my-provider/v1', 'sk-bad', true);

    expect(result.status).toBe('invalid');
  });
});

// ─── requiresApiKey absent — existing fetch behavior unchanged ────────────────

describe('testCustomCredential — requiresApiKey absent does NOT short-circuit', () => {
  it('makes a fetch call when requiresApiKey is undefined', async () => {
    const fetchMock = mockFetchResponse(200);
    vi.stubGlobal('fetch', fetchMock);

    await testCustomCredential('http://localhost:11434/v1', 'sk-key');

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('returns cors-or-network when fetch throws and requiresApiKey is absent', async () => {
    vi.stubGlobal('fetch', mockFetchThrow(new TypeError('Failed to fetch')));

    const result = await testCustomCredential('http://localhost:11434/v1', 'sk-key');

    expect(result.status).toBe('cors-or-network');
  });
});
