/**
 * Integration: Image content streaming pipeline (#367)
 *
 * Tests that Claude and Gemini providers correctly parse image content from
 * SSE streams and emit GeneratedImage objects on StreamChunk.images.
 *
 * Cross-agent contracts exercised:
 *   ClaudeModelProvider.sendMessage()  — Atlas's Anthropic SSE parser
 *   GeminiModelProvider.sendMessage()  — Atlas's Google SSE parser
 *   GeneratedImage interface            — Arch's type contract
 *   StreamChunk.images field            — Arch's type contract
 *
 * Mocking strategy: mock at the network boundary (fetch) — not at the
 * ModelProvider interface. This exercises the real parser code in claude.ts
 * and gemini.ts, not a stub. The SSE payloads are constructed to match the
 * actual provider wire formats exactly.
 *
 * What these tests do NOT cover:
 *   - StreamChunk.images → Message.generatedImages wiring: this happens in
 *     Aria's useStreamingMessages hook (/src/ui), outside Scout's domain.
 *   - Storage persistence: covered by LocalStorageProvider.test.ts (Vault's
 *     unit tests) and image-pipeline-storage.test.ts.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeModelProvider } from '@/models/claude';
import { GeminiModelProvider } from '@/models/gemini';
import { buildLocalStorageMock, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { Message } from '@/types/index';

// ─── UUID format guard ────────────────────────────────────────────────────────

/**
 * Validates that a string is a UUID (version 4 lowercase form).
 * crypto.randomUUID() always produces this format.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── SSE mock helper ──────────────────────────────────────────────────────────

/**
 * Build a mock fetch Response whose body is a ReadableStream of SSE events.
 *
 * Each payload string is emitted as `data: {payload}\n\n` (standard SSE line
 * format). parseSSEStream (openai-sse.ts) reads from response.body.getReader()
 * and yields the payload strings — this helper satisfies that interface.
 *
 * The full SSE text is enqueued in a single ReadableStream chunk to keep the
 * mock simple; parseSSEStream handles partial-line buffering but a single chunk
 * covering the entire response is the common real-world flush pattern.
 */
function makeSseResponse(payloads: string[]): Response {
  const encoder = new TextEncoder();
  const sseText = payloads.map((p) => `data: ${p}\n\n`).join('');
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

// ─── Claude SSE event builders ────────────────────────────────────────────────
//
// These mirror the Anthropic Messages API streaming wire format exactly.
// Each function returns a JSON string for use as an SSE `data:` payload.

function claudeMessageStart(inputTokens = 10): string {
  return JSON.stringify({
    type: 'message_start',
    message: { usage: { input_tokens: inputTokens, output_tokens: 0 } },
  });
}

function claudeBase64ImageBlock(mimeType: string, base64: string, index = 0): string {
  return JSON.stringify({
    type: 'content_block_start',
    index,
    content_block: {
      type: 'image',
      source: { type: 'base64', media_type: mimeType, data: base64 },
    },
  });
}

function claudeUrlImageBlock(index = 0): string {
  // URL-source blocks should be ignored — only base64 sources are collected.
  return JSON.stringify({
    type: 'content_block_start',
    index,
    content_block: {
      type: 'image',
      source: { type: 'url', url: 'https://example.com/image.png' },
    },
  });
}

function claudeTextDelta(text: string, index = 1): string {
  return JSON.stringify({
    type: 'content_block_delta',
    index,
    delta: { type: 'text_delta', text },
  });
}

function claudeMessageDelta(outputTokens = 5): string {
  return JSON.stringify({
    type: 'message_delta',
    delta: { stop_reason: 'end_turn' },
    usage: { output_tokens: outputTokens },
  });
}

// ─── Gemini SSE event builders ────────────────────────────────────────────────

function geminiTextChunk(text: string): string {
  return JSON.stringify({
    candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }],
  });
}

function geminiInlineImageChunk(
  mimeType: string,
  base64: string,
  includeUsage = false
): string {
  return JSON.stringify({
    candidates: [
      {
        content: {
          parts: [{ inlineData: { mimeType, data: base64 } }],
          role: 'model',
        },
        index: 0,
      },
    ],
    ...(includeUsage
      ? {
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 5,
            totalTokenCount: 15,
          },
        }
      : {}),
  });
}

function geminiTextAndImageChunk(
  text: string,
  mimeType: string,
  base64: string
): string {
  return JSON.stringify({
    candidates: [
      {
        content: {
          parts: [{ text }, { inlineData: { mimeType, data: base64 } }],
          role: 'model',
        },
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 8,
      totalTokenCount: 18,
    },
  });
}

function geminiTextOnlyFinalChunk(text: string): string {
  return JSON.stringify({
    candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }],
    usageMetadata: {
      promptTokenCount: 10,
      candidatesTokenCount: 5,
      totalTokenCount: 15,
    },
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

// A 1×1 transparent PNG in base64 — realistic-length, no data-URL prefix.
// This is the actual binary content of a 1×1 PNG, matching GeneratedImage.base64 contract.
const SAMPLE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const SAMPLE_MIME = 'image/png';

const SAMPLE_MESSAGES: Message[] = [makeUserMessage('Generate an image for me.')];

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
  // Set credentials so providers pass the auth guard and reach the SSE parser.
  globalThis.localStorage.setItem('roundtable:key:anthropic', 'test-key-claude');
  globalThis.localStorage.setItem('roundtable:key:google', 'test-key-gemini');
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Claude provider — image content block parsing ────────────────────────────

describe('Claude provider — content_block_start image block → GeneratedImage (#367)', () => {
  it('emits a GeneratedImage on the done chunk when the stream contains a base64 image block', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock(SAMPLE_MIME, SAMPLE_BASE64),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const done = acc.doneChunks[0];
    expect(done.images).toBeDefined();
    expect(done.images).toHaveLength(1);
  });

  it('GeneratedImage.mimeType matches block source.media_type', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock('image/jpeg', SAMPLE_BASE64),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images![0].mimeType).toBe('image/jpeg');
  });

  it('GeneratedImage.base64 matches block source.data exactly — no data-URL prefix added', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock(SAMPLE_MIME, SAMPLE_BASE64),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const image = acc.doneChunks[0].images![0];
    expect(image.base64).toBe(SAMPLE_BASE64);
    // Atlas must NOT prepend a data-URL prefix — that's Aria's job when rendering.
    expect(image.base64).not.toMatch(/^data:/);
  });

  it('GeneratedImage.id is a UUID assigned by the provider at parse time', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock(SAMPLE_MIME, SAMPLE_BASE64),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images![0].id).toMatch(UUID_RE);
  });

  it('collects multiple image blocks: each gets its own mimeType, base64, and UUID', async () => {
    const base64_a = 'aGVsbG8='; // short test string
    const base64_b = 'd29ybGQ=';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock('image/png', base64_a, 0),
          claudeBase64ImageBlock('image/jpeg', base64_b, 1),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const images = acc.doneChunks[0].images!;
    expect(images).toHaveLength(2);
    expect(images[0].mimeType).toBe('image/png');
    expect(images[0].base64).toBe(base64_a);
    expect(images[1].mimeType).toBe('image/jpeg');
    expect(images[1].base64).toBe(base64_b);
    // Each image gets its own UUID.
    expect(images[0].id).toMatch(UUID_RE);
    expect(images[1].id).toMatch(UUID_RE);
    expect(images[0].id).not.toBe(images[1].id);
  });

  it('text content streams as incremental content chunks independently of image blocks', async () => {
    const expectedText = 'Here is the image I generated.';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeBase64ImageBlock(SAMPLE_MIME, SAMPLE_BASE64, 0),
          claudeTextDelta(expectedText, 1),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    // Text accumulated from content (non-done) chunks.
    expect(acc.textFor('claude')).toBe(expectedText);
    // Image emitted on the done chunk only — not in content chunks.
    expect(acc.doneChunks[0].images).toHaveLength(1);
    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });

  it('ignores URL-source image blocks — only base64 source images are supported', async () => {
    // The Anthropic API can emit image blocks with source.type = 'url'.
    // claude.ts deliberately skips these (downloading remote URLs is out of scope).
    // This test guards against accidentally collecting URL-source blocks.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeUrlImageBlock(0),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    // URL-source image must NOT produce a GeneratedImage.
    expect(acc.doneChunks[0].images).toBeUndefined();
  });

  it('done chunk images is undefined (not []) when stream contains no image blocks', async () => {
    // Regression guard: the images field must be absent when no images were returned.
    // An empty array would be truthy and break downstream `if (chunk.images)` guards.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          claudeMessageStart(),
          claudeTextDelta('A text-only response.'),
          claudeMessageDelta(),
        ])
      )
    );

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images).toBeUndefined();
  });
});

// ─── Gemini provider — inlineData parsing ─────────────────────────────────────

describe('Gemini provider — inlineData candidate part → GeneratedImage (#367)', () => {
  it('emits a GeneratedImage on the done chunk when a candidate part has inlineData', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          geminiInlineImageChunk(SAMPLE_MIME, SAMPLE_BASE64, true),
        ])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const done = acc.doneChunks[0];
    expect(done.images).toBeDefined();
    expect(done.images).toHaveLength(1);
  });

  it('GeneratedImage.mimeType matches inlineData.mimeType', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([geminiInlineImageChunk('image/webp', SAMPLE_BASE64, true)])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images![0].mimeType).toBe('image/webp');
  });

  it('GeneratedImage.base64 matches inlineData.data exactly — no prefix added', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([geminiInlineImageChunk(SAMPLE_MIME, SAMPLE_BASE64, true)])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const image = acc.doneChunks[0].images![0];
    expect(image.base64).toBe(SAMPLE_BASE64);
    expect(image.base64).not.toMatch(/^data:/);
  });

  it('GeneratedImage.id is a UUID assigned by the provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([geminiInlineImageChunk(SAMPLE_MIME, SAMPLE_BASE64, true)])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images![0].id).toMatch(UUID_RE);
  });

  it('text parts stream as content chunks while inlineData parts arrive on the done chunk', async () => {
    const expectedText = 'Here is the image:';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          geminiTextChunk(expectedText),
          geminiInlineImageChunk(SAMPLE_MIME, SAMPLE_BASE64, true),
        ])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.textFor('gemini')).toBe(expectedText);
    expect(acc.doneChunks[0].images).toHaveLength(1);
  });

  it('handles a single candidate chunk containing both text and inlineData parts', async () => {
    // Gemini may return text and image in the same parts array.
    const expectedText = 'Combined response:';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          geminiTextAndImageChunk(expectedText, SAMPLE_MIME, SAMPLE_BASE64),
        ])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.textFor('gemini')).toBe(expectedText);
    expect(acc.doneChunks[0].images).toHaveLength(1);
    expect(acc.doneChunks[0].images![0].mimeType).toBe(SAMPLE_MIME);
  });

  it('collects inlineData parts across multiple stream chunks into a single images array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          geminiInlineImageChunk('image/png', 'aGVsbG8=', false),
          geminiInlineImageChunk('image/jpeg', 'd29ybGQ=', true),
        ])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const images = acc.doneChunks[0].images!;
    expect(images).toHaveLength(2);
    expect(images[0].mimeType).toBe('image/png');
    expect(images[1].mimeType).toBe('image/jpeg');
  });

  it('done chunk images is undefined (not []) when stream contains only text parts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeSseResponse([
          geminiTextOnlyFinalChunk('A purely text response.'),
        ])
      )
    );

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images).toBeUndefined();
  });
});
