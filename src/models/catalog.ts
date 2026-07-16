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

// ─── Security: model ID allowlist ─────────────────────────────────────────────
//
// All model IDs received from external sources (OpenRouter, models.json, etc.)
// must pass this test before being included in a catalog entry. A compromised
// or malformed response could supply path-traversal characters (e.g. ../../evil)
// that propagate into provider request URLs (issue #387).
//
// Allowlist: ASCII alphanumeric + . _ : - only; 1–128 chars total; must start
// with an alphanumeric character so the first character is never a path separator.
const SAFE_MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

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

/**
 * Expected top-level shape of the `models.json` file hosted at the GitHub raw URL.
 * Each key in `providers` is a provider prefix string (e.g. "anthropic", "openai").
 * The value is an array of `RemoteCatalogEntry` objects for that provider.
 *
 * This shape is the second fallback tier in the three-tier discovery chain
 * (OpenRouter → models.json → bundled). The file is hosted at:
 *   https://raw.githubusercontent.com/JacobGiordano/roundtable/main/models.json
 * and mirrors the static `availableVersions` entries in `registry.ts`.
 */
type ModelsFallbackJson = {
  updated: string;
  providers: Record<string, RemoteCatalogEntry[]>;
};

// ─── OpenRouter live-API response shape (not exported) ────────────────────────

/**
 * Single model entry as returned by the OpenRouter `/api/v1/models` endpoint.
 * Only the fields we consume are listed; the API returns many more.
 *
 * `input_modalities` and `output_modalities` are arrays of capability strings
 * (e.g. ["text", "image"]). These indicate what media types the model can
 * accept and produce — mapped to `ModelCatalogEntry.capabilities.vision` and
 * `ModelCatalogEntry.capabilities.imageGeneration` respectively.
 *
 * `supported_parameters` is an array of parameter name strings indicating which
 * API parameters the model accepts. Used for capability gating (e.g. "tools"
 * presence indicates function-calling support).
 */
type OpenRouterModel = {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  /** Media types accepted as input, e.g. ["text", "image"]. */
  input_modalities?: string[];
  /** Media types produced as output, e.g. ["text", "image"]. */
  output_modalities?: string[];
  /** API parameter names this model supports, e.g. ["tools", "temperature"]. */
  supported_parameters?: string[];
};

/**
 * Top-level response body from the OpenRouter `/api/v1/models` endpoint.
 */
type OpenRouterModelsResponse = {
  data: OpenRouterModel[];
};

// ─── Anthropic live-API response shape (not exported) ─────────────────────────

/**
 * Single model entry as returned by the Anthropic `GET /v1/models` endpoint.
 * Requires `x-api-key` and `anthropic-version: 2023-06-01` headers.
 *
 * `capabilities` contains feature flags for the model:
 *   - `image_input`:          → `ModelCatalogEntry.capabilities.vision`
 *   - `tool_use`:             → `ModelCatalogEntry.capabilities.toolUse`
 *   - `thinking`:             → `ModelCatalogEntry.capabilities.thinking`
 *   - `structured_outputs`:   → `ModelCatalogEntry.capabilities.structuredOutputs`
 *   - `context_management`:   → `ModelCatalogEntry.capabilities.contextManagement`
 *
 * The `capabilities` field on the returned `ModelCatalogEntry` is omitted
 * entirely when `model.capabilities` is absent.
 */
type AnthropicModel = {
  id: string;
  display_name: string;
  created_at?: string;
  max_input_tokens?: number;
  max_tokens?: number;
  capabilities?: {
    image_input?: boolean;
    thinking?: boolean;
    structured_outputs?: boolean;
    tool_use?: boolean;
    /** Extended context management (200k+ window handling). */
    context_management?: boolean;
  };
};

/**
 * Top-level response body from the Anthropic `GET /v1/models` endpoint.
 */
type AnthropicModelsResponse = {
  data: AnthropicModel[];
  has_more?: boolean;
  first_id?: string | null;
  last_id?: string | null;
};

// ─── Gemini live-API response shape (not exported) ────────────────────────────

/**
 * Single model entry as returned by the Google Generative Language
 * `GET /v1beta/models?key={apiKey}` endpoint.
 *
 * `name` is the resource name, e.g. "models/gemini-2.5-flash". The API-level
 * model string (used in request URLs) is the suffix after "models/".
 *
 * `supportedGenerationMethods` lists the methods this model supports, e.g.
 * ["generateContent", "countTokens", "bidiGenerateContent"]. Only models with
 * "generateContent" are usable for chat completions — others are filtered out.
 */
type GeminiModelEntry = {
  name: string;           // e.g. "models/gemini-2.5-flash"
  displayName: string;    // e.g. "Gemini 2.5 Flash"
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
};

/**
 * Top-level response body from the Gemini `GET /v1beta/models` endpoint.
 */
type GeminiModelsResponse = {
  models: GeminiModelEntry[];
  nextPageToken?: string;
};

// ─── Type guards ──────────────────────────────────────────────────────────────

function isRemoteCatalogEntry(value: unknown): value is RemoteCatalogEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v['id'] === 'string' && typeof v['displayName'] === 'string';
}

function isModelsFallbackJson(value: unknown): value is ModelsFallbackJson {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v['updated'] !== 'string') return false;
  if (typeof v['providers'] !== 'object' || v['providers'] === null) return false;
  const providers = v['providers'] as Record<string, unknown>;
  for (const providerModels of Object.values(providers)) {
    if (!Array.isArray(providerModels)) return false;
    for (const item of providerModels) {
      if (!isRemoteCatalogEntry(item)) return false;
    }
  }
  return true;
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
      // Safe summary only — never log the raw item, which may be arbitrarily large.
      const itemType = typeof item;
      const itemLen = item === null ? 4 : JSON.stringify(item)?.length ?? 0;
      console.warn(
        `[Atlas/catalog] fetchRemoteCatalog: skipping entry missing required fields (id, displayName) — type: ${itemType}, ~${itemLen} chars`
      );
      continue;
    }
    if (!SAFE_MODEL_ID.test(item.id)) {
      console.warn('[catalog] skipping model with invalid ID', item.id);
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
 * Fetches available models from the OpenRouter public `/api/v1/models` endpoint,
 * filters by provider prefix, and returns the matching entries with the prefix
 * stripped from each model ID.
 *
 * No API key is required — the OpenRouter models endpoint is public. This makes
 * it suitable as the first tier of the built-in provider fallback chain, giving
 * fresh model lists without requiring a user-supplied OpenRouter key.
 *
 * Model ID transformation: OpenRouter IDs follow the `<prefix>/<model-id>` format.
 * This function strips the prefix so callers receive the native API-level model
 * string (e.g. `anthropic/claude-opus-4-8` → `claude-opus-4-8`). The display name
 * comes from OpenRouter's `name` field for the model.
 *
 * Capabilities are mapped from OpenRouter's modality fields:
 *   `input_modalities` includes "image"  → `capabilities.vision: true`
 *   `output_modalities` includes "image" → `capabilities.imageGeneration: true`
 *
 * On any error (network failure, non-2xx, unexpected shape): logs a console.warn
 * and returns []. Never throws. In the dev container, openrouter.ai is NOT on the
 * firewall allowlist — fetches will fail and return [] silently, falling through
 * to the models.json tier.
 *
 * @param providerPrefix - OpenRouter provider prefix (e.g. "anthropic", "openai",
 *                         "google", "x-ai", "deepseek", "mistralai").
 */
export async function fetchOpenRouterBuiltinCatalog(
  providerPrefix: string
): Promise<ModelCatalogEntry[]> {
  const url = 'https://openrouter.ai/api/v1/models';
  const prefixWithSlash = `${providerPrefix}/`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    console.warn('[Atlas/catalog] fetchOpenRouterBuiltinCatalog: network error fetching', url, err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchOpenRouterBuiltinCatalog: non-2xx response',
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
    console.warn('[Atlas/catalog] fetchOpenRouterBuiltinCatalog: JSON parse failure from', url, err);
    return [];
  }

  if (!isOpenRouterModelsResponse(raw)) {
    // Safe summary only — never log the raw body, which may be arbitrarily large or sensitive.
    const bodyLen = raw === null ? 4 : JSON.stringify(raw)?.length ?? 0;
    console.warn(
      `[Atlas/catalog] fetchOpenRouterBuiltinCatalog: unexpected response shape from ${url} — ~${bodyLen} chars`
    );
    return [];
  }

  // Filter to models whose ID starts with the provider prefix, strip the prefix,
  // then validate the native ID against the safe-character allowlist before including.
  // A compromised response returning path-traversal characters (e.g. ../../evil)
  // would otherwise propagate into provider request URLs (issue #387).
  // Capabilities come from OpenRouter's modality fields — NOT from provider-level
  // BUILTIN_CAPABILITIES_MAP, which is authoritative for other purposes.
  const catalog: ModelCatalogEntry[] = [];
  for (const model of raw.data) {
    if (!model.id.startsWith(prefixWithSlash)) continue;
    const nativeId = model.id.slice(prefixWithSlash.length);
    if (!SAFE_MODEL_ID.test(nativeId)) {
      console.warn('[catalog] skipping model with invalid ID', nativeId);
      continue;
    }
    const hasVision = model.input_modalities?.includes('image') ?? false;
    const hasImageGen = model.output_modalities?.includes('image') ?? false;
    const hasCapabilities = hasVision || hasImageGen;
    catalog.push({
      id: nativeId,
      displayName: model.name,
      ...(model.description !== undefined ? { description: model.description } : {}),
      ...(model.context_length !== undefined ? { contextWindow: model.context_length } : {}),
      ...(hasCapabilities ? { capabilities: {
        vision: hasVision,
        imageGeneration: hasImageGen,
      } } : {}),
      source: 'live-api',
    });
  }
  return catalog;
}

/**
 * Fetches the shared `models.json` fallback file and returns the model list for
 * the requested provider key as `ModelCatalogEntry[]` with `source: 'remote'`.
 *
 * The `models.json` file has the following top-level shape:
 * ```json
 * {
 *   "updated": "YYYY-MM-DD",
 *   "providers": {
 *     "anthropic": [{ "id": "...", "displayName": "..." }, ...],
 *     "openai":    [...],
 *     ...
 *   }
 * }
 * ```
 *
 * `providerKey` must match a key in `providers` — this is the same string as
 * `ModelRegistryEntry.openrouterPrefix` (e.g. "anthropic", "openai", "google").
 *
 * On any error (network failure, non-2xx, unexpected shape, missing provider key):
 * logs a console.warn and returns []. Never throws.
 *
 * @param url         - Full URL of the `models.json` file (GitHub raw URL).
 * @param providerKey - Provider key to look up in `providers` (e.g. "anthropic").
 */
export async function fetchModelsFallbackJson(
  url: string,
  providerKey: string
): Promise<ModelCatalogEntry[]> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.warn('[Atlas/catalog] fetchModelsFallbackJson: network error fetching', url, err);
    return [];
  }

  if (!response.ok) {
    console.warn(
      '[Atlas/catalog] fetchModelsFallbackJson: non-2xx response',
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
    console.warn('[Atlas/catalog] fetchModelsFallbackJson: JSON parse failure from', url, err);
    return [];
  }

  if (!isModelsFallbackJson(raw)) {
    // Safe summary only — never log the raw body, which may be arbitrarily large.
    const bodyLen = raw === null ? 4 : JSON.stringify(raw)?.length ?? 0;
    console.warn(
      `[Atlas/catalog] fetchModelsFallbackJson: unexpected response shape from ${url} — ~${bodyLen} chars`
    );
    return [];
  }

  const providerModels = raw.providers[providerKey];
  if (!Array.isArray(providerModels)) {
    console.warn(
      '[Atlas/catalog] fetchModelsFallbackJson: no entry for provider key',
      providerKey,
      'in',
      url
    );
    return [];
  }

  const catalog: ModelCatalogEntry[] = [];
  for (const entry of providerModels) {
    if (!SAFE_MODEL_ID.test(entry.id)) {
      console.warn('[catalog] skipping model with invalid ID', entry.id);
      continue;
    }
    catalog.push({
      id: entry.id,
      displayName: entry.displayName,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(entry.contextWindow !== undefined ? { contextWindow: entry.contextWindow } : {}),
      source: 'remote',
    });
  }
  return catalog;
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
    // Safe summary only — never log the raw body, which may be arbitrarily large or sensitive.
    const bodyLen = raw === null ? 4 : JSON.stringify(raw)?.length ?? 0;
    console.warn(
      `[Atlas/catalog] fetchLiveApiCatalog: unexpected response shape from ${url} — ~${bodyLen} chars`
    );
    return [];
  }

  return raw.data.map((model): ModelCatalogEntry => {
    const hasVision = model.input_modalities?.includes('image') ?? false;
    const hasImageGen = model.output_modalities?.includes('image') ?? false;
    const hasCapabilities = hasVision || hasImageGen;

    return {
      id: model.id,
      displayName: model.name,
      ...(model.description !== undefined ? { description: model.description } : {}),
      ...(model.context_length !== undefined ? { contextWindow: model.context_length } : {}),
      ...(hasCapabilities ? { capabilities: {
        vision: hasVision,
        imageGeneration: hasImageGen,
      } } : {}),
      source: 'live-api',
    };
  });
}

// ─── Resolver utilities — consumed by Aria via models/index.ts ────────────────

/**
 * Resolves the version catalog for a registry entry using the best available
 * source, in priority order:
 *
 * For built-in entries with `openrouterPrefix` set, runs a three-tier chain:
 *   1. OpenRouter (no key)  — `fetchOpenRouterBuiltinCatalog(entry.openrouterPrefix)`
 *                             Public endpoint; no API key required. Falls through to
 *                             tier 2 if the result is empty (network blocked, etc.).
 *   2. models.json          — `fetchModelsFallbackJson(entry.remoteCatalogUrl, entry.openrouterPrefix)`
 *                             Fetches the shared models.json from GitHub raw URL.
 *                             Falls through to tier 3 if the result is empty.
 *   3. Bundled              — `entry.availableVersions` mapped to `ModelCatalogEntry[]`
 *                             with `source: 'bundled'`. Always succeeds.
 *
 * For entries with `liveApiEndpoint` set (and `apiKey` provided), dispatches to
 * the provider-specific fetcher. This path is independent of the three-tier chain
 * and takes priority when both `liveApiEndpoint` and `openrouterPrefix` are set:
 *   - 'anthropic' → `fetchAnthropicCatalog(apiKey)`
 *   - 'gemini'    → `fetchGeminiCatalog(apiKey)`
 *   - (default)   → `fetchLiveApiCatalog(entry.liveApiEndpoint, apiKey)` (OpenRouter format)
 *
 * For entries with only `remoteCatalogUrl` (no `openrouterPrefix`, no `liveApiEndpoint`),
 * falls back to the old `fetchRemoteCatalog` path (array-at-root format).
 *
 * Never throws. Graceful degradation is the contract: a failed remote/live
 * fetch produces the bundled list, not an error.
 *
 * Aria calls this (documented cross-agent exception — see models/index.ts).
 *
 * @param entry  - A `ModelRegistryEntry` from `MODEL_REGISTRY`.
 * @param apiKey - Optional API key for live endpoint auth (Gate-mediated; never
 *                 stored or logged here). Required for the liveApiEndpoint path.
 */
export async function resolveVersionCatalog(
  entry: ModelRegistryEntry,
  apiKey?: string
): Promise<ModelCatalogEntry[]> {
  if (entry.liveApiEndpoint !== undefined && apiKey !== undefined) {
    // Dispatch to the provider-specific fetcher when `liveApiProvider` is set.
    // The generic `fetchLiveApiCatalog` is OpenRouter wire format and does not
    // work for Anthropic or Gemini, which use different auth schemes and response
    // shapes.
    //
    // Bug fix (#392): when the live API fetch returns [] (network error, CORS,
    // auth failure), fall through to the three-tier chain below rather than
    // returning [] directly. This ensures the bundled fallback is always reached
    // when the live API is unavailable — e.g. Anthropic's /v1/models is
    // CORS-blocked in most browser contexts without a proxy, so a user with an
    // API key configured would previously get an empty version catalog.
    let liveResult: ModelCatalogEntry[];
    if (entry.liveApiProvider === 'anthropic') {
      liveResult = await fetchAnthropicCatalog(apiKey);
    } else if (entry.liveApiProvider === 'gemini') {
      liveResult = await fetchGeminiCatalog(apiKey);
    } else {
      // Default: OpenRouter / generic OpenAI-compatible /models endpoint.
      liveResult = await fetchLiveApiCatalog(entry.liveApiEndpoint, apiKey);
    }
    if (liveResult.length > 0) {
      return liveResult;
    }
    // Live API returned [] — fall through to the three-tier chain below.
    // This covers CORS-blocked endpoints (Anthropic direct), network errors,
    // and auth failures. The bundled list is always returned in the worst case.
  }

  // Three-tier chain for built-in providers with an OpenRouter prefix.
  // Tier 1: OpenRouter public endpoint — no key required.
  if (entry.openrouterPrefix !== undefined) {
    const openrouterResult = await fetchOpenRouterBuiltinCatalog(entry.openrouterPrefix);
    if (openrouterResult.length > 0) {
      return openrouterResult;
    }

    // Tier 2: models.json fallback from GitHub raw URL.
    if (entry.remoteCatalogUrl !== undefined) {
      const fallbackResult = await fetchModelsFallbackJson(
        entry.remoteCatalogUrl,
        entry.openrouterPrefix
      );
      if (fallbackResult.length > 0) {
        return fallbackResult;
      }
    }

    // Tier 3: bundled — fall through to return below.
  } else if (entry.remoteCatalogUrl !== undefined) {
    // Legacy path: remoteCatalogUrl without openrouterPrefix — array-at-root format.
    return fetchRemoteCatalog(entry.remoteCatalogUrl);
  }

  // Bundled fallback — map static ModelVersionOption[] to ModelCatalogEntry[]
  // This path is always reached if all remote fetches fail or return empty.
  // The bundled list is the last line of defense and always succeeds.
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

/**
 * Fetches available models from the Anthropic `GET /v1/models` endpoint.
 *
 * Authentication: `x-api-key: <apiKey>` + `anthropic-version: 2023-06-01`.
 * The key is passed by the caller (Gate-mediated) — never read from storage here.
 *
 * Fields mapped:
 *   `id`               → `id`            (exact API model string)
 *   `display_name`     → `displayName`
 *   `max_input_tokens` → `contextWindow`  (input context limit)
 *   `capabilities`     → `capabilities`  (when present; see `AnthropicModel` for
 *                                          the field-by-field mapping)
 *
 * On any error (network, non-2xx, unexpected shape): logs a console.warn and
 * returns []. Never throws.
 *
 * @param apiKey - Anthropic API key. Passed by Gate; never stored or logged here.
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
    // Safe summary only — never log the raw body, which may be arbitrarily large or sensitive.
    const bodyLen = raw === null ? 4 : JSON.stringify(raw)?.length ?? 0;
    console.warn(
      `[Atlas/catalog] fetchAnthropicCatalog: unexpected response shape from ${url} — ~${bodyLen} chars`
    );
    return [];
  }

  return raw.data.map((model): ModelCatalogEntry => ({
    id: model.id,
    displayName: model.display_name,
    // max_input_tokens is the context window size for this model version.
    ...(model.max_input_tokens !== undefined ? { contextWindow: model.max_input_tokens } : {}),
    ...(model.capabilities !== undefined ? { capabilities: {
      vision: model.capabilities.image_input ?? false,
      toolUse: model.capabilities.tool_use ?? false,
      thinking: model.capabilities.thinking ?? false,
      structuredOutputs: model.capabilities.structured_outputs ?? false,
      contextManagement: model.capabilities.context_management ?? false,
    } } : {}),
    source: 'live-api',
  }));
}

/**
 * Fetches available models from the Google Generative Language
 * `GET /v1beta/models?key={apiKey}` endpoint.
 *
 * Only models that support "generateContent" are returned — others (e.g.
 * embedding-only models) are filtered out since they cannot be used for chat.
 *
 * Fields mapped:
 *   `name`            → `id`             (suffix after "models/", e.g. "gemini-2.5-flash")
 *   `displayName`     → `displayName`
 *   `description`     → `description`
 *   `inputTokenLimit` → `contextWindow`
 *
 * On any error (network, non-2xx, unexpected shape): logs a console.warn and
 * returns []. Never throws.
 *
 * @param apiKey - Google API key. Passed by Gate; never stored or logged here.
 */
export async function fetchGeminiCatalog(apiKey: string): Promise<ModelCatalogEntry[]> {
  // apiKey is a query parameter for the Google API — not sent as a header.
  // The key is appended to the URL and transmitted only to googleapis.com.
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
      response.status
    );
    return [];
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch (err) {
    console.warn('[Atlas/catalog] fetchGeminiCatalog: JSON parse failure', err);
    return [];
  }

  if (!isGeminiModelsResponse(raw)) {
    // Safe summary only — never log the raw body, which may be arbitrarily large or sensitive.
    const bodyLen = raw === null ? 4 : JSON.stringify(raw)?.length ?? 0;
    console.warn(
      `[Atlas/catalog] fetchGeminiCatalog: unexpected response shape — ~${bodyLen} chars`
    );
    return [];
  }

  // Filter to only models that support generateContent — chat-capable models only.
  // Embedding models, code execution models, etc. use different endpoints and are
  // not usable in the Roundtable chat pipeline.
  const chatModels = raw.models.filter(
    (m) => m.supportedGenerationMethods?.includes('generateContent') ?? false
  );

  return chatModels.map((model): ModelCatalogEntry => {
    // `name` is the resource path, e.g. "models/gemini-2.5-flash".
    // The API-level model string is the segment after the "models/" prefix.
    const id = model.name.startsWith('models/') ? model.name.slice('models/'.length) : model.name;

    return {
      id,
      displayName: model.displayName,
      ...(model.description !== undefined ? { description: model.description } : {}),
      ...(model.inputTokenLimit !== undefined ? { contextWindow: model.inputTokenLimit } : {}),
      source: 'live-api',
    };
  });
}
