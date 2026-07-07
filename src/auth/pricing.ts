/**
 * Gate — pricing.ts
 *
 * Implements the pricing data layer for Roundtable.
 *
 * Responsibilities:
 *   - Fetch and cache pricing.json from a configurable URL
 *   - Stale-while-revalidate strategy: always return cached data immediately,
 *     trigger a background refresh when the cache is null or >24 hours old
 *   - Expose getPricingTable(), getPricingMetadata(), getPricingUrl(),
 *     savePricingUrl(), and refreshPricing() as the public API
 *
 * Storage keys:
 *   roundtable:pricing       — { table: PricingTable, metadata: PricingMetadata }
 *   roundtable:pricing-url   — user-configured URL override (empty string = cleared)
 *
 * URL resolution priority (highest to lowest):
 *   1. localStorage override (roundtable:pricing-url, non-empty string)
 *   2. import.meta.env.VITE_PRICING_URL (build-time env var, non-empty string)
 *   3. CANONICAL_PRICING_URL (hardcoded default)
 *
 * Security: no API keys appear in this module. The pricing URL is not a
 * credential — it is configuration. URL values are validated before use via
 * isValidHttpUrl(). getCredentials() is never called here.
 */

import type { PricingTable, PricingMetadata } from '@/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRICING_STORAGE_KEY = 'roundtable:pricing' as const;
const PRICING_URL_STORAGE_KEY = 'roundtable:pricing-url' as const;
const CANONICAL_PRICING_URL =
  'https://raw.githubusercontent.com/JacobGiordano/roundtable/main/pricing.json';

/** 24 hours in milliseconds */
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// ─── Persisted shape ──────────────────────────────────────────────────────────

interface PricingPayload {
  table: PricingTable;
  metadata: PricingMetadata;
}

// ─── URL validation ───────────────────────────────────────────────────────────

/**
 * Returns true iff the string is a well-formed http:// or https:// URL.
 * Used to guard both the localStorage override and the VITE_PRICING_URL env var
 * before they are accepted into the URL resolution chain.
 */
function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── Shape validation ─────────────────────────────────────────────────────────

/**
 * Returns true iff the value is a PricingEntry (object with numeric inputPer1M
 * and outputPer1M fields).
 */
function isPricingEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.inputPer1M === 'number' && typeof obj.outputPer1M === 'number';
}

/**
 * Returns true iff the value is a PricingTable (object whose values are all
 * PricingEntry shapes). An empty object is valid.
 */
function isPricingTable(value: unknown): value is PricingTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isPricingEntry);
}

/**
 * Returns true iff the value is a PricingMetadata (object with a string-or-null
 * lastFetched field and a valid source discriminant).
 */
function isPricingMetadata(value: unknown): value is PricingMetadata {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const validLastFetched = obj.lastFetched === null || typeof obj.lastFetched === 'string';
  const validSource = obj.source === 'remote' || obj.source === 'fallback';
  return validLastFetched && validSource;
}

/**
 * Returns true iff the value is a PricingPayload ({ table, metadata }).
 */
function isPricingPayload(value: unknown): value is PricingPayload {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return isPricingTable(obj.table) && isPricingMetadata(obj.metadata);
}

// ─── Staleness check ──────────────────────────────────────────────────────────

/**
 * Returns true iff a background refresh should be triggered.
 *
 * Triggers when lastFetched is null (never fetched) or when the last successful
 * fetch was more than STALE_THRESHOLD_MS ago.
 */
function isStale(metadata: PricingMetadata): boolean {
  if (metadata.lastFetched === null) return true;
  const lastFetchedMs = new Date(metadata.lastFetched).getTime();
  if (isNaN(lastFetchedMs)) return true;
  return Date.now() - lastFetchedMs > STALE_THRESHOLD_MS;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function readPayload(): PricingPayload | null {
  try {
    const raw = localStorage.getItem(PRICING_STORAGE_KEY);
    if (raw === null) return null;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!isPricingPayload(parsed)) return null;
    return parsed;
  } catch {
    // localStorage unavailable (SSR context, storage access denied, etc.)
    return null;
  }
}

function writePayload(table: PricingTable, metadata: PricingMetadata): void {
  try {
    const payload: PricingPayload = { table, metadata };
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage write failure (quota exceeded, etc.) — silently ignored.
    // Callers do not depend on write success for correctness.
  }
}

// ─── Background fetch de-duplication ─────────────────────────────────────────

/**
 * Set of in-flight background fetch promises keyed by resolved URL.
 * Prevents multiple callers from stacking concurrent fetches for the same URL
 * when getPricingTable() is called rapidly in succession.
 */
const inFlightFetches = new Set<string>();

// ─── Core fetch logic ─────────────────────────────────────────────────────────

/**
 * Fetches the pricing JSON from the given URL, validates it as a PricingTable,
 * and writes the result to localStorage on success.
 *
 * On success: updates both the table and lastFetched/source metadata.
 * On failure: leaves localStorage unchanged (preserves stale data and timestamp).
 * Never throws — all errors are swallowed.
 */
async function fetchAndCache(url: string): Promise<void> {
  if (inFlightFetches.has(url)) return;
  inFlightFetches.add(url);

  try {
    const response = await fetch(url);
    if (!response.ok) return;

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      return;
    }

    if (!isPricingTable(json)) return;

    const metadata: PricingMetadata = {
      lastFetched: new Date().toISOString(),
      source: 'remote',
    };

    writePayload(json, metadata);
  } catch {
    // Network error or any unexpected failure — preserve stale data.
  } finally {
    inFlightFetches.delete(url);
  }
}

// ─── Test reset ───────────────────────────────────────────────────────────────

/**
 * @internal Test-only. Clears module-level de-duplication state so that unit
 * tests can be isolated from each other. Not exported from index.ts.
 */
export function __resetInFlightFetchesForTesting(): void {
  inFlightFetches.clear();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current pricing URL — the result of resolving:
 *   localStorage override → VITE_PRICING_URL env var → canonical default
 *
 * The returned URL is always a valid http(s) URL. Invalid stored or env values
 * are silently skipped in the resolution chain.
 */
export function getPricingUrl(): string {
  // 1. localStorage user override
  try {
    const stored = localStorage.getItem(PRICING_URL_STORAGE_KEY);
    if (stored && stored.trim().length > 0 && isValidHttpUrl(stored.trim())) {
      return stored.trim();
    }
  } catch {
    // localStorage unavailable — fall through
  }

  // 2. Build-time env var
  const envUrl = import.meta.env.VITE_PRICING_URL as string | undefined;
  if (envUrl && envUrl.trim().length > 0 && isValidHttpUrl(envUrl.trim())) {
    return envUrl.trim();
  }

  // 3. Canonical default
  return CANONICAL_PRICING_URL;
}

/**
 * Saves the user-configured pricing URL override to localStorage.
 *
 * Passing an empty string clears the override — subsequent calls to
 * getPricingUrl() will fall through to VITE_PRICING_URL or the canonical
 * default.
 *
 * Non-empty values are validated as http(s) URLs before saving. Throws
 * TypeError if the value is non-empty but not a valid URL — callers must
 * validate the input field before calling this function.
 */
export function savePricingUrl(url: string): void {
  if (url === '') {
    try {
      localStorage.removeItem(PRICING_URL_STORAGE_KEY);
    } catch {
      // localStorage unavailable — silently ignore
    }
    return;
  }

  const trimmed = url.trim();
  if (!isValidHttpUrl(trimmed)) {
    throw new TypeError(
      `savePricingUrl: "${url}" is not a valid http(s) URL`
    );
  }

  try {
    localStorage.setItem(PRICING_URL_STORAGE_KEY, trimmed);
  } catch {
    // localStorage write failure — silently ignore
  }
}

/**
 * Returns the cached PricingTable, or null if pricing data has never been
 * successfully fetched or written.
 *
 * On every call: if the cached metadata indicates the data is stale (null or
 * >24h since last successful fetch), kicks off an async background fetch.
 * The caller is never blocked or notified about the background fetch.
 */
export function getPricingTable(): PricingTable | null {
  const payload = readPayload();

  if (payload === null) {
    // No cached data at all — trigger a background fetch, return null.
    void fetchAndCache(getPricingUrl());
    return null;
  }

  if (isStale(payload.metadata)) {
    // Data is stale — return the cached table immediately and refresh in background.
    void fetchAndCache(getPricingUrl());
  }

  return payload.table;
}

/**
 * Returns the current pricing metadata (lastFetched and source).
 *
 * Returns a default metadata object when nothing has been stored yet.
 * Read-only — never triggers a fetch. Aria calls this for the staleness footer.
 */
export function getPricingMetadata(): PricingMetadata {
  const payload = readPayload();
  if (payload === null) {
    return { lastFetched: null, source: 'fallback' };
  }
  return payload.metadata;
}

/**
 * Forces an immediate fetch of the pricing data from the resolved URL.
 *
 * Updates the cache and lastFetched on success. On failure: no-op — preserves
 * stale data and the existing lastFetched timestamp. Never throws.
 */
export async function refreshPricing(): Promise<void> {
  await fetchAndCache(getPricingUrl());
}
