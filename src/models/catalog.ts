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
 * Capability-relevant fields (`input_modalities`, `output_modalities`,
 * `supported_parameters`, `pricing`) are captured but not mapped into
 * `ModelCatalogEntry` — that type has no `capabilities` field.
 *
 * NOTE — capability surfacing gap (flag for Arch, issue #378):
 *   Derived capability hints (vision from input_modalities, imageGeneration from
 *   output_modalities) are returned via `fetchOpenRouterCapabilities` for Atlas-
 *   internal use. A types PR adding `capabilities?: ProviderCapabilities` to
 *   `ModelCatalogEntry` is required before Aria can display per-model capability
 *   badges from live data.
 */
type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  /** Modalities this model accepts as input, e.g. ["text", "image"]. */
  input_modalities?: string[];
  /** Modalities this model can produce as output, e.g. ["text", "image"]. */
  output_modalities?: string[];
  /** Parameters supported by this model (informational; not currently mapped). */
  supported_parameters?: string[];
  /** Pricing data for this model (informational — not mapped to catalog). */
  pricing?: {
    prompt?: string;
    completion?: string;
    image?: string;
    request?: string;
  };
};

/**
 * Top-level response body from the OpenRouter `/api/v1/models` endpoint.
 */
type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

// ─── OpenRouter capability hints (Atlas-internal only) ────────────────────────

/**
 * Capability hints derived from OpenRouter's per-model modality fields.
 * Atlas-internal — not part of the cross-agent ModelCatalogEntry contract.
 *
 * Exported so Atlas consumers (e.g. future custom-provider sync logic) can
 * receive per-model capability data from the live OpenRouter endpoint without
 * going through the public `fetchLiveApiCatalog` path (which strips these fields).
 *
 * Once Arch adds `capabilities?: ProviderCapabilities` to `ModelCatalogEntry`
 * in `/src/types/index.ts`, these hints can be folded into the standard catalog
 * return value and this type retired.
 */
export type OpenRouterCapabilityHints = {
  /** True when `input_modalities` includes "image". */
  vision: boolean;
  /** True when `output_modalities` includes "image". */
  imageGeneration: boolean;
};

// ─── Anthropic live-API response shape (not exported) ─────────────────────────

/**
 * Single model entry as returned by the Anthropic `GET /v1/models` endpoint.
 * Only consumed fields are listed.
 *
 * NOTE — capability surfacing gap (flag for Arch, issue #378):
 *   `capabilities.image_input` maps to `ProviderCapabilities.vision` and
 *   `capabilities.thinking` maps to a thinking flag. Neither can be returned
 *   via `ModelCatalogEntry` without a types PR adding a `capabilities` field.
 */
type AnthropicModel = {
  id: string;
  display_name: string;
  /** Maximum input tokens — mapped to ModelCatalogEntry.contextWindow. */
  max_input_tokens?: number;
  max_tokens?: number;
  /** Capability flags as declared by Anthropic. Retained for future use. */
  capabilities?: {
    image_input?: boolean;
    thinking?: boolean;
    effort?: boolean;
    structured_outputs?: boolean;
    context_management?: boolean;
  };
};

type AnthropicModelsResponse = {
  data: AnthropicModel[];
};

// ─── Gemini live-API response shape (not exported) ────────────────────────────

/**
 * Single model entry as returned by the Google Generative Language
 * `GET /v1beta/models?key=<key>` endpoint.
 * Only consumed fields are listed.
 *
 * NOTE — no image-gen signal (issue #378 constraint):
 *   `supportedGenerationMethods` does not cleanly indicate image-gen capability.
 *   Image-gen for Gemini is managed statically via IMAGE_GEN_MODEL_STRINGS in gemini.ts.
 */
type GeminiModel = {
  /** Fully qualified name, e.g. "models/gemini-2.5-pro". */
  name: string;
  displayName: string;
  description?: string;
  /** Maximum input token context limit — mapped to ModelCatalogEntry.contextWindow. */
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

type GeminiModelsResponse = {
  models: GeminiModel[];
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

function isAnthropicModelsResponse(value: unknown): value is AnthropicModelsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['data']) &&
    v['data'].every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>)['id'] === 'string' &&
        typeof (item as Record<string, unknown>)['display_name'] === 'string'
    )
  );
}

function isGeminiModelsResponse(value: unknown): value is GeminiModelsResponse {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v['models']) &&
    v['models'].every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>)['name'] === 'string' &&
        typeof (item as Record<string, unknown>)['displayName'] === 'string'
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
 * Capability-relevant fields (`input_modalities`, `output_modalities`) are parsed
 * from the response but cannot be returned here — `ModelCatalogEntry` has no
 * `capabilities` field. Use `fetchOpenRouterCapabilities` to obtain per-model
 * capability hints separately (Atlas-internal use only).
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

/**
 * Fetches capability hints for all models at an OpenRouter-compatible endpoint.
 *
 * Returns a `Map<modelId, OpenRouterCapabilityHints>` where:
 *   - `vision` is true when the model's `input_modalities` includes "image"
 *   - `imageGeneration` is true when the model's `output_modalities` includes "image"
 *
 * This is a separate function from `fetchLiveApiCatalog` because `ModelCatalogEntry`
 * has no `capabilities` field — these hints cannot be included in the standard
 * catalog return value without a types PR (Arch sign-off required, issue #378).
 *
 * Atlas-internal use only. Not re-exported via models/index.ts to avoid
 * exposing an Atlas-internal type to Aria.
 *
 * On any error: logs a console.warn and returns an empty Map. Never throws.
 *
 * @param endpoint - Base URL of the provider's API (e.g. `https://openrouter.ai/api/v1`).
 * @param apiKey   - Bearer token for authorization. Passed by Gate; never stored here.
 */
export async function fetchOpenRouterCapabilities(
  endpoint: string,
  apiKey: string
): Promise<Map<string, OpenRouterCapabilityHints>> {
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
    console.warn('[Atlas/catalog] fetchOpenRouterCapabilities: network error fetching', url, err);
    return new Map();
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchOpenRouterCapabilities: non-2xx response',
      response.status,
      'from',
      url
    );
    return new Map();
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    console.warn(
      '[Atlas/catalog] fetchOpenRouterCapabilities: JSON parse failure from',
      url,
      err
    );
    return new Map();
  }

  if (!isOpenRouterModelsResponse(raw)) {
    console.warn(
      '[Atlas/catalog] fetchOpenRouterCapabilities: unexpected response shape from',
      url,
      raw
    );
    return new Map();
  }

  const result = new Map<string, OpenRouterCapabilityHints>();
  for (const model of raw.data) {
    result.set(model.id, {
      vision: Array.isArray(model.input_modalities) && model.input_modalities.includes('image'),
      imageGeneration:
        Array.isArray(model.output_modalities) && model.output_modalities.includes('image'),
    });
  }
  return result;
}

/**
 * Fetches available models from the Anthropic `GET /v1/models` endpoint and
 * returns them as `ModelCatalogEntry[]` with `source: 'live-api'`.
 *
 * Auth: `x-api-key: <apiKey>` and `anthropic-version: 2023-06-01` headers.
 * The key is passed by the caller (Gate-mediated) — never stored here.
 *
 * Fields mapped:
 *   `id`               → `id`
 *   `display_name`     → `displayName`
 *   `max_input_tokens` → `contextWindow`
 *
 * NOTE — capability surfacing gap (flag for Arch, issue #378):
 *   `capabilities.image_input` maps to vision, `capabilities.thinking` maps to
 *   a thinking flag. These cannot be returned via `ModelCatalogEntry` without a
 *   types PR adding `capabilities?: ProviderCapabilities` to that interface.
 *
 * On any error: logs a console.warn and returns []. Never throws.
 *
 * @param apiKey - Anthropic API key. Passed by Gate; never stored here.
 */
export async function fetchAnthropicCatalog(apiKey: string): Promise<ModelCatalogEntry[]> {
  const url = 'https://api.anthropic.com/v1/models';

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('[Atlas/catalog] fetchAnthropicCatalog: network error fetching', url, err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchAnthropicCatalog: non-2xx response',
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
    console.warn('[Atlas/catalog] fetchAnthropicCatalog: JSON parse failure from', url, err);
    return [];
  }

  if (!isAnthropicModelsResponse(raw)) {
    console.warn(
      '[Atlas/catalog] fetchAnthropicCatalog: unexpected response shape from',
      url,
      raw
    );
    return [];
  }

  return raw.data.map((model): ModelCatalogEntry => ({
    id: model.id,
    displayName: model.display_name,
    // max_input_tokens is the input context limit — the most informative context window value.
    ...(model.max_input_tokens !== undefined ? { contextWindow: model.max_input_tokens } : {}),
    source: 'live-api',
  }));
}

/**
 * Fetches available models from the Google Generative Language
 * `GET /v1beta/models?key=<apiKey>` endpoint and returns them as
 * `ModelCatalogEntry[]` with `source: 'live-api'`.
 *
 * The API key is passed as a query parameter (Google's required auth mechanism
 * for this endpoint). Passed by the caller (Gate-mediated) — never stored here.
 *
 * Fields mapped:
 *   `name`            → `id` (strips "models/" prefix:
 *                        "models/gemini-2.5-pro" → "gemini-2.5-pro")
 *   `displayName`     → `displayName`
 *   `description`     → `description`
 *   `inputTokenLimit` → `contextWindow`
 *
 * NOTE — no image-gen signal (issue #378 constraint):
 *   `supportedGenerationMethods` does not cleanly indicate image-gen capability.
 *   Image-gen for Gemini is managed statically via IMAGE_GEN_MODEL_STRINGS in gemini.ts.
 *   Do not attempt to derive `imageGeneration` from this endpoint's response.
 *
 * On any error: logs a console.warn and returns []. Never throws.
 *
 * @param apiKey - Google API key. Passed by Gate; never stored here.
 */
export async function fetchGeminiCatalog(apiKey: string): Promise<ModelCatalogEntry[]> {
  // Google's models endpoint authenticates via query parameter, not a Bearer token.
  // The key is never logged — only transmitted to the official Google endpoint.
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('[Atlas/catalog] fetchGeminiCatalog: network error fetching models endpoint', err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchGeminiCatalog: non-2xx response',
      response.status,
      'from Gemini models endpoint'
    );
    return [];
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    console.warn(
      '[Atlas/catalog] fetchGeminiCatalog: JSON parse failure from models endpoint',
      err
    );
    return [];
  }

  if (!isGeminiModelsResponse(raw)) {
    console.warn(
      '[Atlas/catalog] fetchGeminiCatalog: unexpected response shape from models endpoint',
      raw
    );
    return [];
  }

  return raw.models.map((model): ModelCatalogEntry => ({
    // Strip the "models/" prefix from the fully-qualified name to get the bare API model string.
    // e.g. "models/gemini-2.5-pro" → "gemini-2.5-pro"
    id: model.name.startsWith('models/') ? model.name.slice('models/'.length) : model.name,
    displayName: model.displayName,
    ...(model.description !== undefined ? { description: model.description } : {}),
    ...(model.inputTokenLimit !== undefined ? { contextWindow: model.inputTokenLimit } : {}),
    source: 'live-api',
  }));
}

// ─── Resolver utilities — consumed by Aria via models/index.ts ────────────────

/**
 * Resolves the version catalog for a registry entry using the best available
 * source, in priority order:
 *
 *   1. Provider-specific live fetch — if `entry.liveApiFetchFn` is set AND
 *                  `apiKey` is provided, calls `entry.liveApiFetchFn(apiKey)`.
 *                  Used for providers (Anthropic, Gemini) whose live endpoints
 *                  require non-OpenRouter auth or response shapes.
 *                  Returns the result (may be [] if network is blocked).
 *   2. Generic live API — if `entry.liveApiEndpoint` is set AND `apiKey` is
 *                  provided, calls `fetchLiveApiCatalog(entry.liveApiEndpoint, apiKey)`.
 *                  Used for OpenRouter-compatible endpoints.
 *                  Returns the result (may be [] if network is blocked).
 *   3. Remote    — if `entry.remoteCatalogUrl` is set, calls
 *                  `fetchRemoteCatalog(entry.remoteCatalogUrl)`.
 *                  Returns the result (may be [] if fetch fails).
 *   4. Bundled   — falls back to `entry.availableVersions` mapped to
 *                  `ModelCatalogEntry[]` with `source: 'bundled'`.
 *
 * Never throws. Graceful degradation is the contract: a failed remote/live
 * fetch produces the bundled list, not an error.
 *
 * Aria calls this (documented cross-agent exception — see models/index.ts).
 *
 * @param entry  - A `ModelRegistryEntry` from `MODEL_REGISTRY`.
 * @param apiKey - Optional API key for live endpoint auth (Gate-mediated; never
 *                 stored or logged here). Required for paths 1-2 to activate.
 */
export async function resolveVersionCatalog(
  entry: ModelRegistryEntry,
  apiKey?: string
): Promise<ModelCatalogEntry[]> {
  // Path 1: provider-specific live fetch (Anthropic, Gemini — non-OpenRouter format).
  if (entry.liveApiFetchFn !== undefined && apiKey !== undefined) {
    return entry.liveApiFetchFn(apiKey);
  }

  // Path 2: generic OpenRouter-compatible live endpoint.
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
