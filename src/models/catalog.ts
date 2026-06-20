// Atlas owns this file — /src/models/catalog.ts
//
// Async utilities for fetching model version lists from remote sources.
// These supplement the static MODEL_REGISTRY in registry.ts — they do not
// replace it. Graceful degradation to [] on any error is the full error strategy;
// callers fall back to bundled versions when these return empty.
//
// API key rule: keys are passed in as parameters by the caller (Gate-mediated).
// This module never reads localStorage directly.

import type { ModelCatalogEntry } from '@/types';
import type { ModelRegistryEntry } from './registry';

// ─── Remote catalog shape (not exported — internal parse contract) ────────────

/**
 * Expected shape of a single entry in a remote `models.json` file.
 * The minimum required fields are `id` and `displayName`; all others are
 * optional and are mapped through to `ModelCatalogEntry` when present.
 */
type RemoteCatalogEntry = {
  id: string;
  displayName: string;
  description?: string;
  contextWindow?: number;
};

// ─── OpenRouter live-API response shape (not exported) ────────────────────────

/**
 * Single model entry as returned by the OpenRouter `/api/v1/models` endpoint.
 * Only the fields we consume are listed; the API returns many more.
 */
type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
};

/**
 * Top-level response body from the OpenRouter `/api/v1/models` endpoint.
 */
type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

// ─── Type guards ──────────────────────────────────────────────────────────────

function isRemoteCatalogEntry(value: unknown): value is RemoteCatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['id'] === 'string' && typeof v['displayName'] === 'string';
}

function isOpenRouterModelsResponse(value: unknown): value is OpenRouterModelsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['data']) &&
    v['data'].every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>)['id'] === 'string' &&
        typeof (item as Record<string, unknown>)['name'] === 'string'
    )
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches a remote model catalog JSON file and returns the entries as
 * `ModelCatalogEntry[]` with `source: 'remote'`.
 *
 * The remote JSON must be an array of objects where each entry has at minimum
 * `id: string` and `displayName: string`. Optional fields `description` and
 * `contextWindow` are passed through when present.
 *
 * On any error (network failure, non-2xx response, malformed JSON, missing
 * required fields): logs a console.warn and returns []. Never throws.
 *
 * @param url - Full URL of the remote `models.json` file. Expected to be
 *              hosted on `raw.githubusercontent.com` (on the network allowlist).
 */
export async function fetchRemoteCatalog(url: string): Promise<ModelCatalogEntry[]> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.warn('[Atlas/catalog] fetchRemoteCatalog: network error fetching', url, err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchRemoteCatalog: non-2xx response',
      response.status,
      'from',
      url
    );
    return [];
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    console.warn('[Atlas/catalog] fetchRemoteCatalog: JSON parse failure from', url, err);
    return [];
  }

  if (!Array.isArray(raw)) {
    console.warn(
      '[Atlas/catalog] fetchRemoteCatalog: expected array at root, got',
      typeof raw,
      'from',
      url
    );
    return [];
  }

  const entries: ModelCatalogEntry[] = [];
  for (const item of raw) {
    if (!isRemoteCatalogEntry(item)) {
      console.warn(
        '[Atlas/catalog] fetchRemoteCatalog: skipping entry missing required fields (id, displayName)',
        item
      );
      continue;
    }
    entries.push({
      id: item.id,
      displayName: item.displayName,
      ...(item.description !== undefined ? { description: item.description } : {}),
      ...(item.contextWindow !== undefined ? { contextWindow: item.contextWindow } : {}),
      source: 'remote',
    });
  }

  return entries;
}

/**
 * Fetches available models from a live provider API endpoint and returns them
 * as `ModelCatalogEntry[]` with `source: 'live-api'`.
 *
 * Primary target: OpenRouter at `https://openrouter.ai/api/v1/models`.
 * The endpoint is called as `GET <endpoint>/models` if `endpoint` does not
 * already end with `/models`, otherwise `endpoint` is called as-is.
 *
 * Authorization is sent as `Bearer <apiKey>`. The key is passed by the caller
 * (Gate-mediated) — this function never reads localStorage directly.
 *
 * OpenRouter response shape: `{ data: Array<{ id, name, description?, context_length?, ... }> }`.
 * Fields mapped: `id` → `id`, `name` → `displayName`, `description` → `description`,
 * `context_length` → `contextWindow`.
 *
 * On any error (network failure, non-2xx response, unexpected response shape):
 * logs a console.warn and returns []. Never throws.
 *
 * @param endpoint - Base URL of the provider's API (e.g. `https://openrouter.ai/api/v1`).
 * @param apiKey   - Bearer token for authorization. Passed by Gate; never stored here.
 */
export async function fetchLiveApiCatalog(
  endpoint: string,
  apiKey: string
): Promise<ModelCatalogEntry[]> {
  const url = endpoint.endsWith('/models') ? endpoint : `${endpoint}/models`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('[Atlas/catalog] fetchLiveApiCatalog: network error fetching', url, err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchLiveApiCatalog: non-2xx response',
      response.status,
      'from',
      url
    );
    return [];
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    console.warn('[Atlas/catalog] fetchLiveApiCatalog: JSON parse failure from', url, err);
    return [];
  }

  if (!isOpenRouterModelsResponse(raw)) {
    console.warn(
      '[Atlas/catalog] fetchLiveApiCatalog: unexpected response shape from',
      url,
      raw
    );
    return [];
  }

  return raw.data.map((model): ModelCatalogEntry => ({
    id: model.id,
    displayName: model.name,
    ...(model.description !== undefined ? { description: model.description } : {}),
    ...(model.context_length !== undefined ? { contextWindow: model.context_length } : {}),
    source: 'live-api',
  }));
}

// ─── Resolver utilities — consumed by Aria via models/index.ts ────────────────

/**
 * Resolves the version catalog for a registry entry using the best available
 * source, in priority order:
 *
 *   1. Live API  — if `entry.liveApiEndpoint` is set AND `apiKey` is provided,
 *                  calls `fetchLiveApiCatalog(entry.liveApiEndpoint, apiKey)`.
 *                  Returns the result (may be [] if network is blocked).
 *   2. Remote    — if `entry.remoteCatalogUrl` is set, calls
 *                  `fetchRemoteCatalog(entry.remoteCatalogUrl)`.
 *                  Returns the result (may be [] if fetch fails).
 *   3. Bundled   — falls back to `entry.availableVersions` mapped to
 *                  `ModelCatalogEntry[]` with `source: 'bundled'`.
 *
 * Never throws. Graceful degradation is the contract: a failed remote/live
 * fetch produces the bundled list, not an error.
 *
 * Aria calls this (documented cross-agent exception — see models/index.ts).
 *
 * @param entry  - A `ModelRegistryEntry` from `MODEL_REGISTRY`.
 * @param apiKey - Optional API key for live endpoint auth (Gate-mediated; never
 *                 stored or logged here). Required for path 1 to activate.
 */
export async function resolveVersionCatalog(
  entry: ModelRegistryEntry,
  apiKey?: string
): Promise<ModelCatalogEntry[]> {
  if (entry.liveApiEndpoint !== undefined && apiKey !== undefined) {
    return fetchLiveApiCatalog(entry.liveApiEndpoint, apiKey);
  }

  if (entry.remoteCatalogUrl !== undefined) {
    return fetchRemoteCatalog(entry.remoteCatalogUrl);
  }

  // Bundled fallback — map static ModelVersionOption[] to ModelCatalogEntry[]
  return entry.availableVersions.map(
    (v): ModelCatalogEntry => ({
      id: v.id,
      displayName: v.displayName,
      ...(v.description !== undefined ? { description: v.description } : {}),
      source: 'bundled' as const,
    })
  );
}

/**
 * Fetches the model catalog for a custom (non-registry) provider via its live
 * API endpoint. Delegates to `fetchLiveApiCatalog`.
 *
 * This is the named entry point Aria uses for custom providers (OpenRouter-style)
 * so that it never reaches into catalog.ts directly and remains decoupled from
 * the internal fetch implementation.
 *
 * Aria calls this (documented cross-agent exception — see models/index.ts).
 *
 * @param liveApiEndpoint - Base URL of the provider's API (e.g. `https://openrouter.ai/api/v1`).
 * @param apiKey          - Bearer token for authorization. Passed by Gate; never stored here.
 */
export async function resolveCustomProviderCatalog(
  liveApiEndpoint: string,
  apiKey: string
): Promise<ModelCatalogEntry[]> {
  return fetchLiveApiCatalog(liveApiEndpoint, apiKey);
}
