/**
 * Integration tests — provider-specific live catalog fetchers (#386)
 *
 * Issue #386: OpenRouter-based live model discovery for built-in providers.
 *
 * Atlas added two new provider-specific catalog fetchers:
 *   - fetchAnthropicCatalog(apiKey): Anthropic GET /v1/models
 *   - fetchGeminiCatalog(apiKey): Google GET /v1beta/models?key={apiKey}
 *
 * And updated resolveVersionCatalog to dispatch to these fetchers when
 * liveApiProvider is set on the registry entry.
 *
 * These functions live in /src/models/catalog.ts (Atlas owns).
 * This file lives in /src/tests/models/ (Scout owns — read-only).
 *
 * Coverage:
 *
 * fetchAnthropicCatalog:
 *   1. Successful response → ModelCatalogEntry[] with source: 'live-api'
 *   2. display_name maps to displayName
 *   3. max_input_tokens maps to contextWindow
 *   4. capabilities object maps all five fields correctly
 *   5. Missing capabilities object → no capabilities key on entry
 *   6. Uses x-api-key header (not Authorization: Bearer)
 *   7. Uses anthropic-version: 2023-06-01 header
 *   8. Non-2xx response → returns []
 *   9. Network failure → returns []
 *  10. Malformed JSON → returns []
 *  11. Unexpected response shape (no data array) → returns []
 *  12. Partial capabilities (only image_input set) → remaining fields default to false
 *
 * fetchGeminiCatalog:
 *  13. Successful response → ModelCatalogEntry[] with source: 'live-api'
 *  14. Strips 'models/' prefix from name field → clean id
 *  15. name without 'models/' prefix → kept as-is (edge case)
 *  16. inputTokenLimit maps to contextWindow
 *  17. description passes through when present
 *  18. description omitted when absent
 *  19. Filters out models without generateContent in supportedGenerationMethods
 *  20. Filters out models with no supportedGenerationMethods at all
 *  21. Returns empty array when all models are filtered out
 *  22. API key is embedded in URL query param, not a header
 *  23. Non-2xx response → returns []
 *  24. Network failure → returns []
 *  25. Malformed JSON → returns []
 *  26. Unexpected response shape (no models array) → returns []
 *
 * resolveVersionCatalog — liveApiProvider dispatch:
 *  27. liveApiProvider 'anthropic' → dispatches to fetchAnthropicCatalog (x-api-key header)
 *  28. liveApiProvider 'gemini' → dispatches to fetchGeminiCatalog (key in URL)
 *  29. liveApiProvider 'anthropic' with no apiKey → bundled fallback
 *  30. liveApiProvider 'gemini' with no apiKey → bundled fallback
 *  31. liveApiProvider 'anthropic' fetch fails → returns [] (no bundled fallback from live path)
 *  32. liveApiProvider 'gemini' fetch fails → returns [] (no bundled fallback from live path)
 *  33. No liveApiProvider + liveApiEndpoint → uses generic fetchLiveApiCatalog (Bearer header)
 *
 * fetchLiveApiCatalog — OpenRouter capability mapping (new in #386):
 *  34. input_modalities includes image → capabilities.vision = true
 *  35. output_modalities includes image → capabilities.imageGeneration = true
 *  36. Both modalities include image → both flags set
 *  37. No image modalities → capabilities object omitted entirely
 *  38. Modality fields absent → capabilities object omitted entirely
 *
 * MODEL_REGISTRY wiring:
 *  39. Claude entry has liveApiProvider: 'anthropic'
 *  40. Gemini entry has liveApiProvider: 'gemini'
 *  41. GPT-5.5 entry has no liveApiProvider (static only)
 *
 * Mock strategy: vi.stubGlobal('fetch', ...) replaces the global fetch for each test.
 * Each test restores via vi.restoreAllMocks() in afterEach. No real network calls made.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  fetchAnthropicCatalog,
  fetchGeminiCatalog,
  resolveVersionCatalog,
  fetchLiveApiCatalog,
} from '@/models/catalog';
import { MODEL_REGISTRY } from '@/models/registry';
import type { ModelVersionOption } from '@/types';
import type { ModelRegistryEntry } from '@/models/registry';

// ─── Test helpers ─────────────────────────────────────────────────────────────

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
    json: () => Promise.reject(new Error('body not consumed on non-2xx')),
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

/** Minimal ModelRegistryEntry for resolveVersionCatalog dispatch tests. */
function makeEntry(overrides: Partial<ModelRegistryEntry> = {}): ModelRegistryEntry {
  const defaults: ModelRegistryEntry = {
    modelId: 'test-model',
    name: 'Test Model',
    providerName: 'TestCo',
    color: 'accent-other',
    defaultActive: false,
    availableVersions: [
      { id: 'bundled-v1', displayName: 'Bundled V1' } satisfies ModelVersionOption,
    ],
  };
  return { ...defaults, ...overrides };
}

// ─── fetchAnthropicCatalog ────────────────────────────────────────────────────

describe('fetchAnthropicCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Representative Anthropic /v1/models response with two entries. */
  const anthropicResponse = {
    data: [
      {
        id: 'claude-opus-4-8',
        display_name: 'Claude Opus 4',
        max_input_tokens: 200000,
        capabilities: {
          image_input: true,
          thinking: true,
          structured_outputs: true,
          tool_use: true,
          context_management: true,
        },
      },
      {
        id: 'claude-haiku-4-5-20251001',
        display_name: 'Claude Haiku 4',
        // max_input_tokens and capabilities both absent
      },
    ],
  };

  it('returns ModelCatalogEntry[] with source: live-api on success', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');

    expect(result).toHaveLength(2);
    expect(result[0]!.source).toBe('live-api');
    expect(result[1]!.source).toBe('live-api');
  });

  it('maps display_name to displayName and id to id', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');

    expect(result[0]!.id).toBe('claude-opus-4-8');
    expect(result[0]!.displayName).toBe('Claude Opus 4');
  });

  it('maps max_input_tokens to contextWindow when present', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');

    expect(result[0]!.contextWindow).toBe(200000);
  });

  it('omits contextWindow key entirely when max_input_tokens is absent', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');

    // Second entry has no max_input_tokens — key must not appear on the result object
    expect(result[1]!.contextWindow).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result[1], 'contextWindow')).toBe(false);
  });

  it('maps all five capability fields from the API capabilities object', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');
    const caps = result[0]!.capabilities;

    expect(caps).toBeDefined();
    expect(caps!.vision).toBe(true);            // image_input → vision
    expect(caps!.thinking).toBe(true);           // thinking → thinking
    expect(caps!.structuredOutputs).toBe(true);  // structured_outputs → structuredOutputs
    expect(caps!.toolUse).toBe(true);            // tool_use → toolUse
    expect(caps!.contextManagement).toBe(true);  // context_management → contextManagement
  });

  it('omits capabilities key entirely when the API entry has no capabilities field', async () => {
    vi.stubGlobal('fetch', makeFetchOk(anthropicResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');

    // Second entry has no capabilities object in the API response
    expect(result[1]!.capabilities).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result[1], 'capabilities')).toBe(false);
  });

  it('sends x-api-key header with the API key (not Authorization: Bearer)', async () => {
    const mockFetch = makeFetchOk(anthropicResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchAnthropicCatalog('sk-ant-secret-key');

    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers?.['x-api-key']).toBe('sk-ant-secret-key');
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('sends anthropic-version: 2023-06-01 header', async () => {
    const mockFetch = makeFetchOk(anthropicResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchAnthropicCatalog('sk-ant-test-key');

    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers?.['anthropic-version']).toBe('2023-06-01');
  });

  it('returns [] and does not throw on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchStatus(401));

    await expect(fetchAnthropicCatalog('bad-key')).resolves.toEqual([]);
  });

  it('returns [] and does not throw on network failure', async () => {
    vi.stubGlobal('fetch', makeFetchNetworkError());

    await expect(fetchAnthropicCatalog('sk-ant-test-key')).resolves.toEqual([]);
  });

  it('returns [] and does not throw on malformed JSON', async () => {
    vi.stubGlobal('fetch', makeFetchBadJson());

    await expect(fetchAnthropicCatalog('sk-ant-test-key')).resolves.toEqual([]);
  });

  it('returns [] when response shape has no data array', async () => {
    vi.stubGlobal('fetch', makeFetchOk({ models: [] }));

    await expect(fetchAnthropicCatalog('sk-ant-test-key')).resolves.toEqual([]);
  });

  it('defaults missing capability booleans to false when partial capabilities object is present', async () => {
    // Only image_input is provided in the capabilities object — the rest are absent.
    const partialCapResponse = {
      data: [
        {
          id: 'claude-partial',
          display_name: 'Claude Partial',
          capabilities: {
            image_input: true,
            // thinking, structured_outputs, tool_use, context_management absent
          },
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(partialCapResponse));

    const result = await fetchAnthropicCatalog('sk-ant-test-key');
    const caps = result[0]!.capabilities;

    expect(caps).toBeDefined();
    expect(caps!.vision).toBe(true);
    // Missing fields default to false via `?? false` in the implementation
    expect(caps!.thinking).toBe(false);
    expect(caps!.structuredOutputs).toBe(false);
    expect(caps!.toolUse).toBe(false);
    expect(caps!.contextManagement).toBe(false);
  });
});

// ─── fetchGeminiCatalog ───────────────────────────────────────────────────────

describe('fetchGeminiCatalog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Representative Google /v1beta/models response.
   * Includes: two chat-capable models, one embedding-only model, one model
   * with no supportedGenerationMethods at all.
   */
  const geminiResponse = {
    models: [
      {
        name: 'models/gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Most capable model',
        inputTokenLimit: 2097152,
        supportedGenerationMethods: ['generateContent', 'countTokens'],
      },
      {
        name: 'models/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        inputTokenLimit: 1048576,
        supportedGenerationMethods: ['generateContent', 'countTokens', 'bidiGenerateContent'],
      },
      {
        name: 'models/embedding-001',
        displayName: 'Embedding 001',
        supportedGenerationMethods: ['embedContent'], // no generateContent → filtered out
      },
      {
        name: 'models/text-embedding-004',
        displayName: 'Text Embedding 004',
        // no supportedGenerationMethods at all → filtered out
      },
    ],
  };

  it('returns ModelCatalogEntry[] with source: live-api for generateContent-capable models', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    // Only the two generateContent-capable models should be included
    expect(result).toHaveLength(2);
    expect(result[0]!.source).toBe('live-api');
    expect(result[1]!.source).toBe('live-api');
  });

  it('strips the models/ prefix from the name field to produce the id', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result[0]!.id).toBe('gemini-2.5-pro');
    expect(result[1]!.id).toBe('gemini-2.5-flash');
  });

  it('keeps name as-is when it does not start with the models/ prefix', async () => {
    const noPrefixResponse = {
      models: [
        {
          name: 'gemini-custom',
          displayName: 'Gemini Custom',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(noPrefixResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result[0]!.id).toBe('gemini-custom');
  });

  it('maps inputTokenLimit to contextWindow when present', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result[0]!.contextWindow).toBe(2097152);
    expect(result[1]!.contextWindow).toBe(1048576);
  });

  it('passes through description when present', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result[0]!.description).toBe('Most capable model');
  });

  it('omits description key entirely when absent', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    // Second entry (gemini-2.5-flash) has no description in the API response
    expect(result[1]!.description).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result[1], 'description')).toBe(false);
  });

  it('filters out models that lack generateContent in supportedGenerationMethods', async () => {
    vi.stubGlobal('fetch', makeFetchOk(geminiResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    const ids = result.map((r) => r.id);
    expect(ids).not.toContain('embedding-001');
    expect(ids).not.toContain('text-embedding-004');
  });

  it('filters out models with no supportedGenerationMethods field at all', async () => {
    const noMethodsResponse = {
      models: [
        {
          name: 'models/gemini-no-methods',
          displayName: 'Gemini No Methods',
          // supportedGenerationMethods field absent
        },
        {
          name: 'models/gemini-chat',
          displayName: 'Gemini Chat',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(noMethodsResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('gemini-chat');
  });

  it('returns empty array when all models fail the generateContent filter', async () => {
    const allEmbeddingResponse = {
      models: [
        { name: 'models/embed-1', displayName: 'Embed 1', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/embed-2', displayName: 'Embed 2', supportedGenerationMethods: ['embedContent'] },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(allEmbeddingResponse));

    const result = await fetchGeminiCatalog('google-api-key');

    expect(result).toEqual([]);
  });

  it('embeds the API key as a URL query parameter, not in headers', async () => {
    const mockFetch = makeFetchOk(geminiResponse);
    vi.stubGlobal('fetch', mockFetch);

    await fetchGeminiCatalog('my-google-api-key');

    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    // Key must appear as a query param in the URL
    expect(calledUrl).toContain('key=my-google-api-key');
    expect(calledUrl).toContain('generativelanguage.googleapis.com');

    // Authorization and x-api-key headers must NOT be set
    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit | undefined;
    const headers = calledInit?.headers as Record<string, string> | undefined;
    expect(headers?.['Authorization']).toBeUndefined();
    expect(headers?.['x-api-key']).toBeUndefined();
  });

  it('returns [] and does not throw on non-2xx response', async () => {
    vi.stubGlobal('fetch', makeFetchStatus(403));

    await expect(fetchGeminiCatalog('google-api-key')).resolves.toEqual([]);
  });

  it('returns [] and does not throw on network failure', async () => {
    vi.stubGlobal('fetch', makeFetchNetworkError());

    await expect(fetchGeminiCatalog('google-api-key')).resolves.toEqual([]);
  });

  it('returns [] and does not throw on malformed JSON', async () => {
    vi.stubGlobal('fetch', makeFetchBadJson());

    await expect(fetchGeminiCatalog('google-api-key')).resolves.toEqual([]);
  });

  it('returns [] when response shape has no models array', async () => {
    vi.stubGlobal('fetch', makeFetchOk({ data: [] }));

    await expect(fetchGeminiCatalog('google-api-key')).resolves.toEqual([]);
  });
});

// ─── resolveVersionCatalog — liveApiProvider dispatch ─────────────────────────

describe('resolveVersionCatalog — liveApiProvider dispatch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches to fetchAnthropicCatalog (not fetchLiveApiCatalog) when liveApiProvider is anthropic', async () => {
    // Anthropic wire format: { data: [...] } with display_name (not name)
    const anthropicResponse = {
      data: [
        { id: 'claude-opus-4-8', display_name: 'Claude Opus 4', max_input_tokens: 200000 },
      ],
    };
    const mockFetch = makeFetchOk(anthropicResponse);
    vi.stubGlobal('fetch', mockFetch);

    const entry = makeEntry({
      liveApiEndpoint: 'https://api.anthropic.com/v1/models',
      liveApiProvider: 'anthropic',
    });

    const result = await resolveVersionCatalog(entry, 'sk-ant-key');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('claude-opus-4-8');
    expect(result[0]!.source).toBe('live-api');

    // Anthropic auth: x-api-key header, not Authorization: Bearer
    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers?.['x-api-key']).toBe('sk-ant-key');
    expect(headers?.['Authorization']).toBeUndefined();
  });

  it('dispatches to fetchGeminiCatalog (not fetchLiveApiCatalog) when liveApiProvider is gemini', async () => {
    // Gemini wire format: { models: [...] } with name/displayName
    const geminiResponse = {
      models: [
        {
          name: 'models/gemini-2.5-pro',
          displayName: 'Gemini 2.5 Pro',
          inputTokenLimit: 2097152,
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    };
    const mockFetch = makeFetchOk(geminiResponse);
    vi.stubGlobal('fetch', mockFetch);

    const entry = makeEntry({
      liveApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      liveApiProvider: 'gemini',
    });

    const result = await resolveVersionCatalog(entry, 'google-api-key');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('gemini-2.5-pro');
    expect(result[0]!.source).toBe('live-api');
    expect(result[0]!.contextWindow).toBe(2097152);

    // Gemini auth: key embedded in URL, not a header
    const calledUrl = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('key=google-api-key');
  });

  it('falls through to bundled when liveApiProvider is anthropic but apiKey is absent', async () => {
    // No fetch stub — fetch must never be called when apiKey is absent
    const entry = makeEntry({
      liveApiEndpoint: 'https://api.anthropic.com/v1/models',
      liveApiProvider: 'anthropic',
    });

    const result = await resolveVersionCatalog(entry); // no apiKey argument

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('bundled-v1');
    expect(result[0]!.source).toBe('bundled');
  });

  it('falls through to bundled when liveApiProvider is gemini but apiKey is absent', async () => {
    const entry = makeEntry({
      liveApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      liveApiProvider: 'gemini',
    });

    const result = await resolveVersionCatalog(entry); // no apiKey argument

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('bundled-v1');
    expect(result[0]!.source).toBe('bundled');
  });

  it('returns [] (not bundled) when liveApiProvider: anthropic fetch fails', async () => {
    // The live API path activates because apiKey is provided. It then fails.
    // resolveVersionCatalog returns whatever fetchAnthropicCatalog returns ([] on error).
    // It does NOT fall back to bundled — bundled is only for the no-liveApiEndpoint path.
    vi.stubGlobal('fetch', makeFetchNetworkError());

    const entry = makeEntry({
      liveApiEndpoint: 'https://api.anthropic.com/v1/models',
      liveApiProvider: 'anthropic',
    });

    const result = await resolveVersionCatalog(entry, 'sk-ant-key');

    expect(result).toEqual([]);
  });

  it('returns [] (not bundled) when liveApiProvider: gemini fetch fails', async () => {
    vi.stubGlobal('fetch', makeFetchNetworkError());

    const entry = makeEntry({
      liveApiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      liveApiProvider: 'gemini',
    });

    const result = await resolveVersionCatalog(entry, 'google-api-key');

    expect(result).toEqual([]);
  });

  it('uses generic fetchLiveApiCatalog (Bearer header) when no liveApiProvider is set', async () => {
    // OpenRouter wire format when liveApiProvider is not set
    const openRouterResponse = {
      data: [{ id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B' }],
    };
    const mockFetch = makeFetchOk(openRouterResponse);
    vi.stubGlobal('fetch', mockFetch);

    const entry = makeEntry({
      liveApiEndpoint: 'https://openrouter.ai/api/v1',
      // no liveApiProvider — defaults to generic OpenRouter fetcher
    });

    const result = await resolveVersionCatalog(entry, 'or-test-key');

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('meta-llama/llama-3-70b-instruct');
    expect(result[0]!.source).toBe('live-api');

    // Generic OpenRouter fetcher uses Authorization: Bearer
    const calledInit = (mockFetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    const headers = calledInit?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBe('Bearer or-test-key');
  });
});

// ─── fetchLiveApiCatalog — OpenRouter capability mapping (new in #386) ────────
//
// The OpenRouter response parser now maps input_modalities and output_modalities
// to ModelCatalogEntry.capabilities. This coverage did not exist before #386.

describe('fetchLiveApiCatalog — OpenRouter capability mapping (#386)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets capabilities.vision = true when input_modalities includes image', async () => {
    const response = {
      data: [
        {
          id: 'provider/vision-model',
          name: 'Vision Model',
          input_modalities: ['text', 'image'],
          output_modalities: ['text'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.capabilities).toBeDefined();
    expect(result[0]!.capabilities!.vision).toBe(true);
    expect(result[0]!.capabilities!.imageGeneration).toBe(false);
  });

  it('sets capabilities.imageGeneration = true when output_modalities includes image', async () => {
    const response = {
      data: [
        {
          id: 'provider/image-gen-model',
          name: 'Image Gen Model',
          input_modalities: ['text'],
          output_modalities: ['text', 'image'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.capabilities!.vision).toBe(false);
    expect(result[0]!.capabilities!.imageGeneration).toBe(true);
  });

  it('sets both vision and imageGeneration when both modality lists include image', async () => {
    const response = {
      data: [
        {
          id: 'provider/multimodal',
          name: 'Multimodal',
          input_modalities: ['text', 'image'],
          output_modalities: ['text', 'image'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.capabilities!.vision).toBe(true);
    expect(result[0]!.capabilities!.imageGeneration).toBe(true);
  });

  it('omits capabilities entirely when no modality list includes image', async () => {
    const response = {
      data: [
        {
          id: 'provider/text-only',
          name: 'Text Only',
          input_modalities: ['text'],
          output_modalities: ['text'],
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.capabilities).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result[0], 'capabilities')).toBe(false);
  });

  it('omits capabilities entirely when modality fields are absent', async () => {
    const response = {
      data: [
        {
          id: 'provider/no-modalities',
          name: 'No Modalities',
          // input_modalities and output_modalities both absent from the response
        },
      ],
    };
    vi.stubGlobal('fetch', makeFetchOk(response));

    const result = await fetchLiveApiCatalog('https://openrouter.ai/api/v1', 'test-key');

    expect(result[0]!.capabilities).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(result[0], 'capabilities')).toBe(false);
  });
});

// ─── MODEL_REGISTRY wiring (#386) ─────────────────────────────────────────────

describe('MODEL_REGISTRY — liveApiProvider wiring (#386)', () => {
  it('Claude entry is wired with liveApiProvider: anthropic', () => {
    const claudeEntry = MODEL_REGISTRY.find((e) => e.modelId === 'claude');

    expect(claudeEntry).toBeDefined();
    expect(claudeEntry!.liveApiProvider).toBe('anthropic');
    expect(claudeEntry!.liveApiEndpoint).toBe('https://api.anthropic.com/v1/models');
  });

  it('Gemini entry is wired with liveApiProvider: gemini', () => {
    const geminiEntry = MODEL_REGISTRY.find((e) => e.modelId === 'gemini');

    expect(geminiEntry).toBeDefined();
    expect(geminiEntry!.liveApiProvider).toBe('gemini');
    expect(geminiEntry!.liveApiEndpoint).toBeDefined();
  });

  it('GPT-5.5 entry has no liveApiProvider (static registry only, per HANDOFF)', () => {
    const gptEntry = MODEL_REGISTRY.find((e) => e.modelId === 'gpt-5.5');

    expect(gptEntry).toBeDefined();
    // OpenAI /v1/models returns no capability data — Atlas uses static registry only
    expect(gptEntry!.liveApiProvider).toBeUndefined();
  });
});
