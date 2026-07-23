/**
 * Integration: GPT-5.5 image generation via /v1/images/generations (#377)
 *
 * Tests the routing and output pipeline introduced in GPT55ModelProvider.sendMessage():
 *   - Two-condition gate: IMAGE_GEN_MODEL_STRINGS + requestImageGeneration === true
 *   - generateImage() parses b64_json responses into GeneratedImage[] and emits a done chunk
 *   - revised_prompt → altText mapping
 *   - All error paths: missing key, 401, 429, network throw, empty data, no user message
 *   - AbortError re-throw (not swallowed)
 *   - Fall-through to base chat completions when conditions are not met
 *
 * Cross-agent contracts exercised:
 *   GPT55ModelProvider.sendMessage()  — Atlas implementation in gpt.ts
 *   getCredentials()                   — Gate credential lookup
 *   GeneratedImage interface            — Arch's type contract
 *   StreamChunk.images field            — Arch's type contract
 *   ModelErrorCode variants             — Arch's type contract
 *
 * Mocking strategy: mock at the network boundary (fetch) and localStorage —
 * NOT at the ModelProvider interface. This exercises the real routing logic,
 * JSON parser, and error mapper in gpt.ts.
 *
 * The fall-through tests (requestImageGeneration false / non-image model) do NOT
 * mock fetch. The base chat completions path requires a streaming SSE response
 * which is complex to construct. Instead, we verify the image-gen endpoint was
 * NOT called by asserting fetch was never called for those tests — the missing
 * credential guard on the base path fires before any network request is made.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GPT55ModelProvider } from '@/models/gpt';
import { buildLocalStorageMock, makeUserMessage, makeAssistantMessage, resetIdSeq } from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { Message } from '@/types/index';

// ─── UUID format guard ────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Sample data ──────────────────────────────────────────────────────────────

// A 1×1 transparent PNG in base64 — raw base64, no data-URL prefix.
const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const SAMPLE_MESSAGES: Message[] = [makeUserMessage('Generate a sunset over mountains.')];

const IMAGE_GEN_MODEL = 'gpt-image-2';

// ─── Response factories ───────────────────────────────────────────────────────

/**
 * Build a mock JSON Response as returned by POST /v1/images/generations.
 * The real API shape: { created: number, data: [{ b64_json, revised_prompt? }] }
 */
function makeImageGenResponse(
  items: Array<{ b64_json?: string; revised_prompt?: string }>,
  status = 200
): Response {
  return new Response(JSON.stringify({ created: 1700000000, data: items }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Build a mock error Response with OpenAI error body shape.
 */
function makeErrorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: { message, type: 'invalid_request_error' } }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

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
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('GPT image gen — happy path: b64_json → GeneratedImage (#377)', () => {
  it('emits a done chunk with images when both conditions are met', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const done = acc.doneChunks[0];
    expect(done).toBeDefined();
    expect(done.images).toBeDefined();
    expect(done.images).toHaveLength(1);
  });

  it('GeneratedImage.base64 matches b64_json exactly — no data-URL prefix added', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const image = acc.doneChunks[0].images![0];
    expect(image.base64).toBe(SAMPLE_BASE64);
    // Atlas must not prepend a data-URL prefix — that is Aria's job when rendering.
    expect(image.base64).not.toMatch(/^data:/);
  });

  it('GeneratedImage.mimeType is image/png (gpt-image-2 default)', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.doneChunks[0].images![0].mimeType).toBe('image/png');
  });

  it('GeneratedImage.id is a UUID assigned at parse time', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.doneChunks[0].images![0].id).toMatch(UUID_RE);
  });

  it('done chunk content is empty string — image responses carry no text', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.doneChunks[0].content).toBe('');
  });

  it('tokenUsage is undefined on the done chunk — images endpoint returns no token counts', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    // No tokenUsage — /v1/images/generations does not return token counts.
    expect(acc.doneChunks[0].tokenUsage).toBeUndefined();
  });

  it('sendMessage resolves to {} (empty object) on success', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    const result = await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(result).toEqual({});
  });

  it('POSTs to the images/generations endpoint — not chat/completions', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const fetchMock = vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/v1/images/generations');
    expect(url).not.toContain('/v1/chat/completions');
  });

  it('request body contains model, prompt, n=1, size=1024x1024, output_format=png', async () => {
    const prompt = 'A red fox in the snow.';
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const fetchMock = vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(
      [makeUserMessage(prompt)],
      undefined,
      acc.onChunk,
      IMAGE_GEN_MODEL,
      undefined,
      true
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe(IMAGE_GEN_MODEL);
    expect(body.prompt).toBe(prompt);
    expect(body.n).toBe(1);
    expect(body.size).toBe('1024x1024');
    // gpt-image-2 uses output_format (not response_format — that is the gpt-image-1 parameter).
    // Sending response_format to gpt-image-2 returns a 400 unknown-parameter error.
    expect(body.output_format).toBe('png');
  });

  it('prompt is extracted from the last user message in the conversation', async () => {
    const firstPrompt = 'An earlier user message.';
    const lastPrompt = 'The most recent user message — this is the prompt.';

    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const fetchMock = vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const messages: Message[] = [
      makeUserMessage(firstPrompt),
      makeAssistantMessage('Here is an image.', 'gpt-5.5'),
      makeUserMessage(lastPrompt),
    ];

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(messages, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.prompt).toBe(lastPrompt);
  });

  it('gpt-image-1 also routes to the image endpoint (legacy model support)', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const fetchMock = vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, 'gpt-image-1', undefined, true);

    const [url] = fetchMock.mock.calls[0] as [string, ...unknown[]];
    expect(url).toContain('/v1/images/generations');
    expect(acc.doneChunks[0].images).toHaveLength(1);
  });
});

// ─── revised_prompt → altText mapping ────────────────────────────────────────

describe('GPT image gen — revised_prompt → altText (#377)', () => {
  it('uses revised_prompt as altText when present in the response', async () => {
    const revisedPrompt = 'A dramatic sunset with orange and purple hues over a mountain range.';
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64, revised_prompt: revisedPrompt }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.doneChunks[0].images![0].altText).toBe(revisedPrompt);
  });

  it('altText is absent when revised_prompt is not in the response', async () => {
    // No revised_prompt field — altText must be absent (not set to the original prompt).
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ b64_json: SAMPLE_BASE64 }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.doneChunks[0].images![0].altText).toBeUndefined();
  });
});

// ─── Routing fall-through: conditions not met ─────────────────────────────────

describe('GPT image gen — fall-through when conditions are not met (#377)', () => {
  it('requestImageGeneration false → falls through to chat completions; image endpoint never called', async () => {
    // No credential set — the base path will emit auth_failure before fetching.
    // This lets us confirm the image-gen endpoint was NOT reached.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    // requestImageGeneration === false — should NOT route to generateImage()
    await provider.sendMessage(
      SAMPLE_MESSAGES,
      undefined,
      acc.onChunk,
      IMAGE_GEN_MODEL,
      undefined,
      false
    );

    // fetch should never have been called — auth_failure fires before any network request
    expect(fetchMock).not.toHaveBeenCalled();
    // Auth failure emitted via the base path, not image-gen path
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
  });

  it('requestImageGeneration undefined → falls through to chat completions', async () => {
    // Omitting requestImageGeneration (undefined) must not trigger image gen.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(
      SAMPLE_MESSAGES,
      undefined,
      acc.onChunk,
      IMAGE_GEN_MODEL,
      undefined,
      undefined
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
  });

  it('non-image model string → falls through to chat completions even when requestImageGeneration is true', async () => {
    // 'gpt-4o' is not in IMAGE_GEN_MODEL_STRINGS — must fall through regardless of toggle.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(
      SAMPLE_MESSAGES,
      undefined,
      acc.onChunk,
      'gpt-4o',
      undefined,
      true
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
  });

  it('default model (no selectedVersionId) + requestImageGeneration true → chat completions path', async () => {
    // Omitting selectedVersionId resolves to defaultModel ('gpt-5.5') which is not
    // in IMAGE_GEN_MODEL_STRINGS — confirms the gate requires BOTH conditions.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, undefined, undefined, true);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
  });
});

// ─── Missing API key ──────────────────────────────────────────────────────────

describe('GPT image gen — missing API key (#377)', () => {
  it('emits auth_failure when no openai key is stored', async () => {
    // No credential in localStorage — key check fires before any fetch.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    expect(acc.errorFor('gpt-5.5')!.code).toBe('auth_failure');
    // fetch must not have been called — the key guard fires before any network attempt.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('auth_failure emits a priming chunk then a done error chunk', async () => {
    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    // emitErrorChunk emits: [priming non-done, done+error].
    expect(acc.contentChunks).toHaveLength(1);
    expect(acc.contentChunks[0].content).toBe('');
    expect(acc.doneChunks).toHaveLength(1);
  });

  it('auth_failure error message mentions API key', async () => {
    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.errorFor('gpt-5.5')!.message).toMatch(/API key/i);
  });

  it('sendMessage resolves (does not throw) when key is missing', async () => {
    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await expect(
      provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true)
    ).resolves.toBeDefined();
  });
});

// ─── HTTP error codes ─────────────────────────────────────────────────────────

describe('GPT image gen — HTTP error codes (#377)', () => {
  it('HTTP 401 → auth_failure error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'bad-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeErrorResponse(401, 'Incorrect API key provided.')
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('auth_failure');
    expect(error!.message).toContain('Incorrect API key');
  });

  it('HTTP 429 → rate_limit error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeErrorResponse(429, 'Rate limit reached for requests.')
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('rate_limit');
    expect(error!.message).toContain('Rate limit');
  });

  it('HTTP 400 → context_length_exceeded error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeErrorResponse(400, 'Your prompt is too long.')
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('context_length_exceeded');
  });

  it('HTTP 500 → unknown error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeErrorResponse(500, 'Internal server error.')
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('unknown');
  });

  it('error message from response body is propagated to the error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const apiMessage = 'The selected model does not support image generation.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeErrorResponse(400, apiMessage)
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.errorFor('gpt-5.5')!.message).toContain(apiMessage);
  });

  it('sendMessage resolves (does not throw) on HTTP errors', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse(401, 'Unauthorized')));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await expect(
      provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true)
    ).resolves.toBeDefined();
  });
});

// ─── Network error ────────────────────────────────────────────────────────────

describe('GPT image gen — network errors (#377)', () => {
  it('fetch throw → network_error chunk (non-AbortError)', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network request failed')));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('network_error');
    expect(error!.message).toContain('Network request failed');
  });

  it('network error message from thrown Error is included in the chunk', async () => {
    const specificMessage = 'ERR_CONNECTION_REFUSED';
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error(specificMessage)));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    expect(acc.errorFor('gpt-5.5')!.message).toContain(specificMessage);
  });

  it('JSON parse failure on successful response → network_error chunk', async () => {
    // The API returned 200 but the body is not valid JSON.
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response('not-json-at-all', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('network_error');
    expect(error!.message).toContain('parse');
  });

  it('sendMessage resolves (does not throw) on network errors', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection refused')));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await expect(
      provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true)
    ).resolves.toBeDefined();
  });
});

// ─── AbortError re-throw ──────────────────────────────────────────────────────

describe('GPT image gen — AbortError re-throw (#377)', () => {
  it('AbortError from fetch is re-thrown rather than emitted as a chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const abortError = new Error('The user aborted a request.');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    // sendMessage must reject (re-throw), not resolve with an error chunk.
    // Match on error.name ('AbortError'), not the message, which can vary.
    let thrownError: Error | undefined;
    try {
      await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);
    } catch (err) {
      thrownError = err as Error;
    }
    expect(thrownError).toBeDefined();
    expect(thrownError!.name).toBe('AbortError');

    // No chunks should have been emitted for the abort.
    expect(acc.all).toHaveLength(0);
  });

  it('AbortError does not emit any chunk (not swallowed, not wrapped)', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    try {
      await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);
    } catch {
      // Expected — swallow for this assertion.
    }

    expect(acc.doneChunks).toHaveLength(0);
    expect(acc.contentChunks).toHaveLength(0);
  });
});

// ─── Empty data array ─────────────────────────────────────────────────────────

describe('GPT image gen — empty data array → unknown error (#377)', () => {
  it('empty data array emits an unknown error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('unknown');
    expect(error!.message).toContain('no images');
  });

  it('data array with entries that have no b64_json → treated as empty → unknown error', async () => {
    // The data array has an item but b64_json is absent — filter removes it, leaving empty.
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      makeImageGenResponse([{ revised_prompt: 'A sunset.' }])
    ));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('unknown');
  });

  it('sendMessage resolves (does not throw) when data is empty', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeImageGenResponse([])));

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await expect(
      provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true)
    ).resolves.toBeDefined();
  });
});

// ─── No user message in conversation ─────────────────────────────────────────

describe('GPT image gen — no user message in conversation → unknown error (#377)', () => {
  it('all-assistant history → unknown error chunk (no prompt to extract)', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    // No fetch mock needed — error fires before any network call.

    const allAssistantMessages: Message[] = [
      makeAssistantMessage('I generated something earlier.', 'gpt-5.5'),
    ];

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(allAssistantMessages, undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('unknown');
    expect(error!.message).toMatch(/no user message/i);
  });

  it('empty message array → unknown error chunk', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage([], undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true);

    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('unknown');
  });

  it('no user message: fetch is not called — error fires before any network request', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(
      [makeAssistantMessage('Previous response.', 'gpt-5.5')],
      undefined,
      acc.onChunk,
      IMAGE_GEN_MODEL,
      undefined,
      true
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
  });

  it('sendMessage resolves (does not throw) when no user message exists', async () => {
    globalThis.localStorage.setItem('roundtable:key:openai', 'sk-test');

    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await expect(
      provider.sendMessage([], undefined, acc.onChunk, IMAGE_GEN_MODEL, undefined, true)
    ).resolves.toBeDefined();
  });
});
