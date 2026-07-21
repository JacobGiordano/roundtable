/**
 * Integration: Atlas + Gate — GenericOpenAIProvider requiresApiKey:false (#269)
 *
 * Verifies the cross-agent contract between Gate's credential lookup and Atlas's
 * GenericOpenAIProvider:
 *
 *   - When requiresApiKey === false on the CustomProviderConfig:
 *       * getCredentials() is NOT called (no credential lookup)
 *       * No Authorization header is set on the outbound request
 *
 *   - When requiresApiKey is true or absent:
 *       * getCredentials() IS called via the normal credential lookup path
 *       * Authorization header is set when a credential exists in localStorage
 *       * Authorization header is absent when no credential is stored
 *
 * Mocking strategy: mock at the network boundary (fetch) only. Real
 * GenericOpenAIProvider and real getCredentials() implementations are used.
 * getCredentials is injected explicitly (Atlas #297 boundary fix — generic.ts
 * no longer imports from @/auth directly). localStorage is mocked via buildLocalStorageMock().
 *
 * The fake SSE stream returned by fetchMock produces a minimal valid OpenAI
 * streaming response (one content chunk + done marker) so sendMessage() completes
 * normally without hitting any error-handling paths.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenericOpenAIProvider } from '@/models/generic';
// getCredentials is injected into GenericOpenAIProvider at construction time rather
// than imported directly by generic.ts — this is the Atlas #297 boundary fix.
// Integration tests that exercise the credential lookup path must pass the real
// Gate implementation explicitly. Tests verifying requiresApiKey:false behavior
// (where no lookup occurs) may also pass getCredentials for API compatibility,
// though the function will never be called in those branches.
import { getCredentials } from '@/auth';
import { buildLocalStorageMock, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { CustomProviderConfig, Message } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ─── Fake SSE stream helpers ──────────────────────────────────────────────────

/**
 * Build a ReadableStream that emits a minimal OpenAI-compatible SSE response.
 * One content chunk followed by a [DONE] marker.
 */
function makeFakeSSEStream(modelId: string, text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const contentEvent = `data: ${JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 1700000000,
    model: modelId,
    choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
  })}\n\n`;

  // Final usage chunk with finish_reason and usage
  const usageEvent = `data: ${JSON.stringify({
    id: 'chatcmpl-test',
    object: 'chat.completion.chunk',
    created: 1700000000,
    model: modelId,
    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  })}\n\n`;

  const doneMarker = 'data: [DONE]\n\n';

  const chunks = [contentEvent, usageEvent, doneMarker];
  let i = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Stub globalThis.fetch to return a successful SSE response.
 * Returns the mock function so tests can inspect the calls.
 */
function stubFetchSuccess(modelId = 'llama3', text = 'Hello') {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: makeFakeSSEStream(modelId, text),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeKeylessProviderConfig(overrides: Partial<CustomProviderConfig> = {}): CustomProviderConfig {
  return {
    kind: 'custom',
    id: 'custom:ollama',
    displayName: 'Ollama',
    endpointUrl: 'http://localhost:11434/v1/chat/completions',
    modelString: 'llama3',
    credentialKey: 'custom:custom:ollama',
    requiresApiKey: false,
    ...overrides,
  };
}

function makeKeyedProviderConfig(overrides: Partial<CustomProviderConfig> = {}): CustomProviderConfig {
  return {
    kind: 'custom',
    id: 'custom:openrouter',
    displayName: 'OpenRouter',
    endpointUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelString: 'mistralai/mistral-7b-instruct',
    credentialKey: 'custom:custom:openrouter',
    ...overrides,
  };
}

const SAMPLE_MESSAGES: Message[] = [makeUserMessage('Hello')];

// ─── requiresApiKey:false — no credential lookup, no Authorization header ─────

describe('GenericOpenAIProvider — requiresApiKey:false', () => {
  it('does not set Authorization header on the outbound request', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig();
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('sends the request to the configured endpoint URL', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig();
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
  });

  it('completes successfully and emits content without a stored credential', async () => {
    stubFetchSuccess('llama3', 'Hello from Ollama');
    const config = makeKeylessProviderConfig();
    // No credential stored for this provider — if credential lookup ran it would find nothing.
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    // No error in done chunk.
    expect(acc.hasErrorFor('custom:ollama')).toBe(false);
    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].isDone).toBe(true);
  });

  it('does not emit auth_failure even with no stored credential', async () => {
    stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig();
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('custom:ollama')).toBe(false);
  });
});

// ─── requiresApiKey:true or absent — credential lookup fires as normal ────────

describe('GenericOpenAIProvider — requiresApiKey:true or absent (credential lookup)', () => {
  it('includes Authorization: Bearer header when a credential is stored', async () => {
    const fetchMock = stubFetchSuccess('mistralai/mistral-7b-instruct');
    const config = makeKeyedProviderConfig(); // requiresApiKey absent → defaults to requiring a key
    // Store a credential for this provider.
    globalThis.localStorage.setItem(
      'roundtable:key:custom:custom:openrouter',
      'sk-or-test-key',
    );
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-or-test-key');
  });

  it('omits Authorization header when no credential is stored (server will respond with 401)', async () => {
    const fetchMock = stubFetchSuccess('mistralai/mistral-7b-instruct');
    const config = makeKeyedProviderConfig();
    // No credential stored — lookup returns undefined.
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('includes Authorization header when requiresApiKey is explicitly true and credential is stored', async () => {
    const fetchMock = stubFetchSuccess('mistralai/mistral-7b-instruct');
    const config = makeKeyedProviderConfig({ requiresApiKey: true });
    globalThis.localStorage.setItem(
      'roundtable:key:custom:custom:openrouter',
      'sk-explicit-true-key',
    );
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-explicit-true-key');
  });
});

// ─── maxTokens override — issue #493 ─────────────────────────────────────────

describe('GenericOpenAIProvider — maxTokens override', () => {
  it('uses config.maxTokens in the request body when set', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig({ maxTokens: 2048 });
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(2048);
  });

  it('falls back to MAX_TOKENS_GENERIC (8192) when maxTokens is absent', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    // makeKeylessProviderConfig does not set maxTokens — it is absent.
    const config = makeKeylessProviderConfig();
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(8192);
  });

  it('respects a high maxTokens override (e.g. 131072 for a 128k-context model)', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig({ maxTokens: 131_072 });
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { max_tokens: number };
    expect(body.max_tokens).toBe(131_072);
  });
});

// ─── requiresApiKey:false vs absent — behavioral boundary ────────────────────

describe('GenericOpenAIProvider — requiresApiKey:false vs absent Authorization boundary', () => {
  it('keyless config sends no Authorization even when a credential IS stored for its key', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    const config = makeKeylessProviderConfig();
    // Store a key for this provider (e.g. a stale value from before it was made keyless).
    globalThis.localStorage.setItem(
      'roundtable:key:custom:custom:ollama',
      'stale-key',
    );
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    // The stale key must NOT appear — requiresApiKey:false gates the lookup.
    expect(headers['Authorization']).toBeUndefined();
  });

  it('keyed config sends Authorization when a credential is stored', async () => {
    const fetchMock = stubFetchSuccess('llama3');
    // Same endpoint, but requiresApiKey NOT false (absent).
    const config = makeKeylessProviderConfig({ requiresApiKey: undefined });
    globalThis.localStorage.setItem(
      'roundtable:key:custom:custom:ollama',
      'sk-test-key',
    );
    const provider = new GenericOpenAIProvider(config, getCredentials);
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer sk-test-key');
  });
});
