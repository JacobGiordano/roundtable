/**
 * Integration tests — fetchRemoteCatalog and fetchLiveApiCatalog
 *
 * Issue #177: Remote/live-API model catalog fetch utilities.
 *
 * These functions live in /src/models/catalog.ts (Atlas owns).
 * This file lives in /src/tests/integration/ (Scout owns — read-only).
 *
 * Coverage:
 *   fetchRemoteCatalog:
 *     1. Successful fetch → correctly shaped ModelCatalogEntry[] with source: 'remote'
 *     2. Network failure (fetch throws) → returns []
 *     3. Non-2xx HTTP response → returns []
 *     4. Malformed JSON (parse failure) → returns []
 *     5. Valid JSON but not an array → returns []
 *     6. Array entries missing required fields are skipped; valid entries pass through
 *     7. Optional fields (description, contextWindow) are mapped when present
 *
 *   fetchLiveApiCatalog:
 *     8. Successful OpenRouter response → correctly shaped entries with source: 'live-api'
 *     9. Non-2xx HTTP response → returns []
 *    10. Network failure (fetch throws) → returns []
 *    11. Endpoint without /models suffix → /models is appended
 *    12. Endpoint already ending with /models → not double-appended
 *    13. Optional fields (description, context_length) are mapped when present
 *    14. Authorization header is sent with the provided API key
 *
 * Mock strategy: vi.stubGlobal('fetch', ...) replaces the global fetch for each test.
 * Each test restores via vi.restoreAllMocks() in afterEach.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchRemoteCatalog, fetchLiveApiCatalog } from '@/models/catalog';
import type { ModelCatalogEntry } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function makeFetchStatus(status: number): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.reject(new Error('body not consumed')),
  });
}

function makeFetchNetworkError(): typeof fetch {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

function makeFetchBadJson(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  });
}

// ─── fetchRemoteCatalog ───────────────────────────────────────────────────────

describe('fetchRemoteCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps a valid remote JSON array to ModelCatalogEntry[] with source: remote', async () => {
    const remoteData = [
      { id: 'model-a', displayName: 'Model A' },
      { id: 'model-b', displayName: 'Model B', description: 'Fast model', contextWindow: 8192 },
    ];
    vi.stubGlobal('fetch', makeFetchOk(remoteData));

    const result = await fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json');

    expect(result).toHaveLength(2);

    const a = result[0] as ModelCatalogEntry;
    expect(a.id).toBe('model-a');
    expect(a.displayName).toBe('Model A');
    expect(a.source).toBe('remote');
    expect(a.description).toBeUndefined();
    expect(a.contextWindow).toBeUndefined();

    const b = result[1] as ModelCatalogEntry;
    expect(b.id).toBe('model-b');
    expect(b.displayName).toBe('Model B');
    expect(b.description).toBe('Fast model');
    expect(b.contextWindow).toBe(8192);
    expect(b.source).toBe('remote');
  });

  it('returns [] and does not throw on network failure', async () => {
    vi.stubGlobal('fetch', makeFetchNetworkError());

    await expect(
      fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json')
    ).resolves.toEqual([]);
  });

  it('returns [] and does not throw on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchStatus(404));

    await expect(
      fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json')
    ).resolves.toEqual([]);
  });

  it('returns [] and does not throw on malformed JSON', async () => {
    vi.stubGlobal('fetch', makeFetchBadJson());

    await expect(
      fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json')
    ).resolves.toEqual([]);
  });

  it('returns [] when JSON root is not an array', async () => {
    vi.stubGlobal('fetch', makeFetchOk({ models: [] }));

    await expect(
      fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json')
    ).resolves.toEqual([]);
  });

  it('skips entries missing required fields and returns valid entries', async () => {
    const remoteData = [
      { id: 'valid-model', displayName: 'Valid' },
      { id: 'missing-displayName' },               // missing displayName
      { displayName: 'Missing ID' },                // missing id
      null,                                          // null entry
      42,                                            // wrong type entirely
    ];
    vi.stubGlobal('fetch', makeFetchOk(remoteData));

    const result = await fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('valid-model');
    expect(result[0]!.source).toBe('remote');
  });

  it('maps optional description and contextWindow when present', async () => {
    const remoteData = [
      {
        id: 'full-entry',
        displayName: 'Full Entry',
        description: 'Has all fields',
        contextWindow: 200000,
      },
    ];
    vi.stubGlobal('fetch', makeFetchOk(remoteData));

    const result = await fetchRemoteCatalog('https://raw.githubusercontent.com/example/models.json');

    expect(result[0]!.description).toBe('Has all fields');
    expect(result[0]!.contextWindow).toBe(200000);
  });
});

// ─── fetchLiveApiCatalog ──────────────────────────────────────────────────────

describe('fetchLiveApiCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openRouterResponse = {
    data: [
      { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B Instruct' },
      {
        id: 'anthropic/claude-3.5-sonnet',
        name: 'Claude 3.5 Sonnet',
        description: 'High capability model',
        context_length: 200000,
      },
    ],
  };

  it('maps a valid OpenRouter response to ModelCatalogEntry[] with source: live-api', async () => {
    vi.stubGlobal('fetch', makeFetchOk(openRouterResponse));

    const result = await fetchLiveApiCatalog(
      'https://openrouter.ai/api/v1',
      'test-api-key'
    );

    expect(result).toHaveLength(2);

    const first = result[0] as ModelCatalogEntry;
    expect(first.id).toBe('meta-llama/llama-3-70b-instruct');
    expect(first.displayName).toBe('Llama 3 70B Instruct');
    expect(first.source).toBe('live-api');
    expect(first.description).toBeUndefined();
    expect(first.contextWindow).toBeUndefined();

    const second = result[1] as ModelCatalogEntry;
    expect(second.id).toBe('anthropic/claude-3.5-sonnet');
    expect(second.displayName).toBe('Claude 3.5 Sonnet');
    expect(second.description).toBe('High capability model');
    expect(second.contextWindow).toBe(200000);
    expect(second.source).toBe('live-api');
  });

  it('returns [] and does not throw on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchStatus(401));

    await expect(
      fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'bad-key')
    ).resolves.toEqual([]);
  });

  it('returns [] and does not throw on network failure', async () => {
    vi.stubGlobal('fetch', makeFetchNetworkError());

    await expect(
      fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key')
    ).resolves.toEqual([]);
  });

  it('appends /models to endpoint when not already present', async () => {
    const mockFetch = makeFetchOk(openRouterResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://openrouter.ai/api/v1/models');
  });

  it('does not double-append /models when endpoint already ends with /models', async () => {
    const mockFetch = makeFetchOk(openRouterResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchLiveApiCatalog('https://openrouter.ai/api/v1/models', 'test-key');

    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe('https://openrouter.ai/api/v1/models');
  });

  it('sends Authorization: Bearer header with the provided API key', async () => {
    const mockFetch = makeFetchOk(openRouterResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'sk-secret-key');

    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBe('Bearer sk-secret-key');
  });

  it('returns [] and does not throw when response shape is unexpected', async () => {
    // Response is 2xx but lacks the `data` array
    vi.stubGlobal('fetch', makeFetchOk({ models: [] }));

    await expect(
      fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key')
    ).resolves.toEqual([]);
  });

  it('maps optional description and context_length fields when present', async () => {
    const response = {
      data: [
        {
          id: 'provider/model',
          name: 'Provider Model',
          description: 'A great model',
          context_length: 128000,
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.description).toBe('A great model');
    expect(result[0]!.contextWindow).toBe(128000);
  });
});
