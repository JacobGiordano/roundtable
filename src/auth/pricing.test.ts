/**
 * Tests for Gate — pricing.ts
 *
 * Covers:
 *   - URL resolution chain (localStorage → VITE_PRICING_URL → canonical default)
 *   - savePricingUrl('') clears the override
 *   - getPricingTable() returns null on empty cache, triggers background fetch
 *   - getPricingTable() returns stale data immediately and triggers background refresh when >24h
 *   - getPricingTable() returns fresh data with no background refresh when <24h
 *   - Fetch failure preserves stale cache and existing lastFetched timestamp
 *   - source set to 'remote' after successful fetch
 *   - getPricingMetadata() returns fallback defaults when nothing stored
 *   - refreshPricing() never throws on fetch failure
 *   - savePricingUrl() throws TypeError on invalid URL
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PricingTable } from '@/types';
import {
  getPricingTable,
  getPricingMetadata,
  getPricingUrl,
  savePricingUrl,
  refreshPricing,
  __resetInFlightFetchesForTesting,
} from './pricing';

// ─── localStorage mock ────────────────────────────────────────────────────────

const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
};

vi.stubGlobal('localStorage', localStorageMock);

// ─── fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ─── Test pricing data ────────────────────────────────────────────────────────

const SAMPLE_TABLE: PricingTable = {
  'claude-sonnet-4-6': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'gpt-4o': { inputPer1M: 2.5, outputPer1M: 10.0 },
};

const PRICING_STORAGE_KEY = 'roundtable:pricing';
const PRICING_URL_STORAGE_KEY = 'roundtable:pricing-url';
const CANONICAL_URL =
  'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/pricing.json';

function makeFetchOk(table = SAMPLE_TABLE) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => table,
  });
}

function makeFetchFail() {
  mockFetch.mockResolvedValueOnce({ ok: false });
}

function makeFetchNetworkError() {
  mockFetch.mockRejectedValueOnce(new Error('Network error'));
}

function storePayload(
  table = SAMPLE_TABLE,
  lastFetched: string | null = new Date().toISOString(),
  source: 'remote' | 'fallback' = 'remote'
) {
  localStorageStore[PRICING_STORAGE_KEY] = JSON.stringify({
    table,
    metadata: { lastFetched, source },
  });
}

function storeOldPayload(table = SAMPLE_TABLE) {
  // 25 hours ago — past the 24h stale threshold
  const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  storePayload(table, oldDate, 'remote');
}

function storeFreshPayload(table = SAMPLE_TABLE) {
  // 1 hour ago — within the 24h stale threshold
  const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  storePayload(table, recentDate, 'remote');
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  localStorageMock.clear();
  mockFetch.mockReset();
  vi.unstubAllEnvs();
  // Clear module-level de-duplication state so in-flight fetches from a prior
  // test cannot write into this test's localStorage.
  __resetInFlightFetchesForTesting();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── getPricingUrl ─────────────────────────────────────────────────────────────

describe('getPricingUrl', () => {
  it('returns canonical default when no override or env var', () => {
    expect(getPricingUrl()).toBe(CANONICAL_URL);
  });

  it('returns localStorage override when set to a valid URL', () => {
    const custom = 'https://example.com/my-pricing.json';
    localStorageStore[PRICING_URL_STORAGE_KEY] = custom;
    expect(getPricingUrl()).toBe(custom);
  });

  it('falls through to env var when localStorage override is empty', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = '';
    vi.stubEnv('VITE_PRICING_URL', 'https://env.example.com/pricing.json');
    expect(getPricingUrl()).toBe('https://env.example.com/pricing.json');
  });

  it('falls through to canonical default when localStorage override is invalid URL', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = 'not-a-url';
    expect(getPricingUrl()).toBe(CANONICAL_URL);
  });

  it('falls through to canonical default when env var is invalid URL', () => {
    vi.stubEnv('VITE_PRICING_URL', 'not-a-url');
    expect(getPricingUrl()).toBe(CANONICAL_URL);
  });

  it('localStorage override takes precedence over env var', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = 'https://override.example.com/pricing.json';
    vi.stubEnv('VITE_PRICING_URL', 'https://env.example.com/pricing.json');
    expect(getPricingUrl()).toBe('https://override.example.com/pricing.json');
  });

  it('trims whitespace from localStorage override before validating', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = '  https://example.com/pricing.json  ';
    expect(getPricingUrl()).toBe('https://example.com/pricing.json');
  });
});

// ─── savePricingUrl ────────────────────────────────────────────────────────────

describe('savePricingUrl', () => {
  it('saves a valid URL to localStorage', () => {
    const url = 'https://example.com/pricing.json';
    savePricingUrl(url);
    expect(localStorageStore[PRICING_URL_STORAGE_KEY]).toBe(url);
  });

  it('removes the override key when called with empty string', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = 'https://example.com/pricing.json';
    savePricingUrl('');
    expect(localStorageStore[PRICING_URL_STORAGE_KEY]).toBeUndefined();
  });

  it('throws TypeError for an invalid URL', () => {
    expect(() => savePricingUrl('not-a-url')).toThrow(TypeError);
  });

  it('throws TypeError for a non-http URL (e.g. ftp)', () => {
    expect(() => savePricingUrl('ftp://example.com/pricing.json')).toThrow(TypeError);
  });

  it('trims whitespace before saving', () => {
    savePricingUrl('  https://example.com/pricing.json  ');
    expect(localStorageStore[PRICING_URL_STORAGE_KEY]).toBe('https://example.com/pricing.json');
  });

  it('after savePricingUrl(""), getPricingUrl() returns canonical default', () => {
    localStorageStore[PRICING_URL_STORAGE_KEY] = 'https://example.com/pricing.json';
    savePricingUrl('');
    expect(getPricingUrl()).toBe(CANONICAL_URL);
  });
});

// ─── getPricingMetadata ────────────────────────────────────────────────────────

describe('getPricingMetadata', () => {
  it('returns fallback defaults when nothing is stored', () => {
    const meta = getPricingMetadata();
    expect(meta.lastFetched).toBeNull();
    expect(meta.source).toBe('fallback');
  });

  it('returns stored metadata when available', () => {
    const ts = '2026-01-01T00:00:00.000Z';
    storePayload(SAMPLE_TABLE, ts, 'remote');
    const meta = getPricingMetadata();
    expect(meta.lastFetched).toBe(ts);
    expect(meta.source).toBe('remote');
  });

  it('does not trigger a fetch', () => {
    getPricingMetadata();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── getPricingTable ───────────────────────────────────────────────────────────

describe('getPricingTable', () => {
  it('returns null when nothing is cached', () => {
    makeFetchOk();
    const result = getPricingTable();
    expect(result).toBeNull();
  });

  it('triggers a background fetch when cache is empty', async () => {
    makeFetchOk();
    getPricingTable();
    // Allow the microtask queue to flush
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(mockFetch).toHaveBeenCalledWith(CANONICAL_URL);
  });

  it('returns cached table immediately when data is fresh', () => {
    storeFreshPayload();
    const result = getPricingTable();
    expect(result).toEqual(SAMPLE_TABLE);
  });

  it('does NOT trigger a background fetch when data is fresh', async () => {
    storeFreshPayload();
    getPricingTable();
    // Wait a tick to confirm no fetch was fired
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns stale cached table immediately', () => {
    storeOldPayload();
    makeFetchOk();
    const result = getPricingTable();
    expect(result).toEqual(SAMPLE_TABLE);
  });

  it('triggers background fetch when data is >24h stale', async () => {
    storeOldPayload();
    makeFetchOk();
    getPricingTable();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it('updates cache with remote data after successful background fetch', async () => {
    // Verify via refreshPricing() — same underlying fetchAndCache code path,
    // but explicitly awaitable so there is no race condition with module-level
    // de-duplication state from background fetches triggered by other tests.
    storeOldPayload();
    const newTable = { 'gpt-5.5': { inputPer1M: 1.0, outputPer1M: 4.0 } };
    makeFetchOk(newTable);
    await refreshPricing();
    const stored = JSON.parse(localStorageStore[PRICING_STORAGE_KEY]);
    expect(stored.table).toEqual(newTable);
    expect(stored.metadata.source).toBe('remote');
    expect(stored.metadata.lastFetched).toBeTruthy();
  });

  it('preserves stale cache when background fetch fails (HTTP error)', async () => {
    storeOldPayload();
    makeFetchFail();
    const originalPayload = localStorageStore[PRICING_STORAGE_KEY];
    getPricingTable();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(localStorageStore[PRICING_STORAGE_KEY]).toBe(originalPayload);
  });

  it('preserves stale cache when background fetch fails (network error)', async () => {
    storeOldPayload();
    makeFetchNetworkError();
    const originalPayload = localStorageStore[PRICING_STORAGE_KEY];
    getPricingTable();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(localStorageStore[PRICING_STORAGE_KEY]).toBe(originalPayload);
  });

  it('preserves stale lastFetched timestamp when fetch fails', async () => {
    const staleTs = '2026-01-01T00:00:00.000Z';
    storePayload(SAMPLE_TABLE, staleTs, 'remote');
    // Force it to be seen as stale by manipulating the timestamp to be >24h ago
    const payloadObj = JSON.parse(localStorageStore[PRICING_STORAGE_KEY]);
    payloadObj.metadata.lastFetched = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const preservedTs = payloadObj.metadata.lastFetched;
    localStorageStore[PRICING_STORAGE_KEY] = JSON.stringify(payloadObj);

    makeFetchFail();
    getPricingTable();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());

    const afterPayload = JSON.parse(localStorageStore[PRICING_STORAGE_KEY]);
    expect(afterPayload.metadata.lastFetched).toBe(preservedTs);
  });

  it('ignores corrupt stored data and triggers a fresh fetch', async () => {
    localStorageStore[PRICING_STORAGE_KEY] = 'not valid json {{{{';
    makeFetchOk();
    const result = getPricingTable();
    expect(result).toBeNull();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it('ignores structurally invalid stored payload and triggers a fresh fetch', async () => {
    localStorageStore[PRICING_STORAGE_KEY] = JSON.stringify({ wrong: 'shape' });
    makeFetchOk();
    const result = getPricingTable();
    expect(result).toBeNull();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
  });

  it('ignores invalid PricingTable from remote and preserves stale cache', async () => {
    storeOldPayload();
    const originalPayload = localStorageStore[PRICING_STORAGE_KEY];
    // Remote returns an invalid table shape
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 'model-x': { wrong_field: 999 } }),
    });
    getPricingTable();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledOnce());
    expect(localStorageStore[PRICING_STORAGE_KEY]).toBe(originalPayload);
  });
});

// ─── refreshPricing ────────────────────────────────────────────────────────────

describe('refreshPricing', () => {
  it('fetches from the resolved URL and updates cache on success', async () => {
    makeFetchOk();
    await refreshPricing();
    expect(mockFetch).toHaveBeenCalledWith(CANONICAL_URL);
    const stored = JSON.parse(localStorageStore[PRICING_STORAGE_KEY]);
    expect(stored.table).toEqual(SAMPLE_TABLE);
    expect(stored.metadata.source).toBe('remote');
    expect(stored.metadata.lastFetched).toBeTruthy();
  });

  it('does not throw on HTTP error', async () => {
    makeFetchFail();
    await expect(refreshPricing()).resolves.toBeUndefined();
  });

  it('does not throw on network error', async () => {
    makeFetchNetworkError();
    await expect(refreshPricing()).resolves.toBeUndefined();
  });

  it('preserves existing cache on failure', async () => {
    storeFreshPayload();
    const originalPayload = localStorageStore[PRICING_STORAGE_KEY];
    makeFetchFail();
    await refreshPricing();
    expect(localStorageStore[PRICING_STORAGE_KEY]).toBe(originalPayload);
  });

  it('uses the localStorage URL override when set', async () => {
    const customUrl = 'https://my-server.example.com/pricing.json';
    localStorageStore[PRICING_URL_STORAGE_KEY] = customUrl;
    makeFetchOk();
    await refreshPricing();
    expect(mockFetch).toHaveBeenCalledWith(customUrl);
  });
});
