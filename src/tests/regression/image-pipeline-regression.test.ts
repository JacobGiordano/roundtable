/**
 * Regression: Image pipeline — text-only and attachment paths unaffected (#367)
 *
 * Guards against the new image-handling code in Atlas (issue #364) breaking
 * existing behavior on text-only streaming paths and user attachment handling.
 *
 * Regressions this file prevents:
 *   - Text-only streaming chunks accidentally gaining an `images` property
 *   - Text-only done chunks having `images: []` instead of `images: undefined`
 *   - The `FakeStreamingProvider` (existing test fixture) being broken by the
 *     new images contract — ensures the fixture doesn't need to populate images
 *   - User `Attachment` data accidentally surfacing in `StreamChunk.images`
 *   - `StreamChunk.images` appearing on non-done (content) chunks
 *
 * What these tests do NOT duplicate:
 *   - Provider image parsing correctness — that's in image-pipeline-streaming.test.ts
 *   - Storage round-trip — that's in image-pipeline-storage.test.ts
 *   - Vault's generatedImages unit tests — those live in LocalStorageProvider.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeModelProvider } from '@/models/claude';
import { GeminiModelProvider } from '@/models/gemini';
import { buildLocalStorageMock, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import { FakeStreamingProvider, ChunkAccumulator } from '../fixtures/mockProviders';
import type { Attachment, Message } from '@/types/index';

// ─── SSE mock helper (minimal — text-only responses) ─────────────────────────

function makeSseResponse(payloads: string[]): Response {
  const encoder = new TextEncoder();
  const sseText = payloads.map((p) => `data: ${p}\n\n`).join('');
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function claudeTextOnlySseResponse(text: string): Response {
  return makeSseResponse([
    JSON.stringify({
      type: 'message_start',
      message: { usage: { input_tokens: 5, output_tokens: 0 } },
    }),
    JSON.stringify({
      type: 'content_block_delta',
      index: 0,
      delta: { type: 'text_delta', text },
    }),
    JSON.stringify({
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { output_tokens: 3 },
    }),
  ]);
}

function geminiTextOnlySseResponse(text: string): Response {
  return makeSseResponse([
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }], role: 'model' }, index: 0 }],
      usageMetadata: {
        promptTokenCount: 5,
        candidatesTokenCount: 3,
        totalTokenCount: 8,
      },
    }),
  ]);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

const TEXT_MESSAGES: Message[] = [makeUserMessage('Tell me about the weather today.')];

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
  globalThis.localStorage.setItem('roundtable:key:anthropic', 'test-key');
  globalThis.localStorage.setItem('roundtable:key:google', 'test-key');
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

// ─── Text-only streaming paths unaffected ─────────────────────────────────────

describe('regression: text-only Claude stream — no images field on any chunk (#367)', () => {
  it('text-only done chunk has images: undefined, not images: []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      claudeTextOnlySseResponse('The weather is sunny today.')
    ));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    // Done chunk must NOT have images — not undefined assignment, not empty array.
    expect(acc.doneChunks[0].images).toBeUndefined();
  });

  it('text content chunks do not have an images property', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      claudeTextOnlySseResponse('Sunny with a chance of rain.')
    ));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    // Every content (non-done) chunk must have no images field.
    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });

  it('text still accumulates correctly in text-only mode (no regression on text delivery)', async () => {
    const expectedText = 'The weather is partly cloudy.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      claudeTextOnlySseResponse(expectedText)
    ));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    expect(acc.textFor('claude')).toBe(expectedText);
    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.doneChunks[0].isDone).toBe(true);
  });
});

describe('regression: text-only Gemini stream — no images field on any chunk (#367)', () => {
  it('text-only done chunk has images: undefined, not images: []', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      geminiTextOnlySseResponse('It is raining heavily.')
    ));

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images).toBeUndefined();
  });

  it('text content chunks do not have an images property', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      geminiTextOnlySseResponse('Mild temperatures expected.')
    ));

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });

  it('text still accumulates correctly (no regression on text delivery)', async () => {
    const expectedText = 'Expect snow flurries later.';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      geminiTextOnlySseResponse(expectedText)
    ));

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(TEXT_MESSAGES, undefined, acc.onChunk);

    expect(acc.textFor('gemini')).toBe(expectedText);
    expect(acc.doneChunks).toHaveLength(1);
  });
});

// ─── FakeStreamingProvider unaffected ─────────────────────────────────────────

describe('regression: FakeStreamingProvider — images field absent from all chunks (#367)', () => {
  it('FakeStreamingProvider done chunk has no images field', async () => {
    // FakeStreamingProvider is used across the test suite and was written before
    // StreamChunk.images existed. It must not inadvertently gain an images field.
    const provider = new FakeStreamingProvider('claude', ['Hello', ' world']);
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    expect(acc.doneChunks[0].images).toBeUndefined();
  });

  it('FakeStreamingProvider content chunks have no images field', async () => {
    const provider = new FakeStreamingProvider('gpt-5.5', ['A', 'B', 'C']);
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });

  it('FakeStreamingProvider text accumulation is unaffected by images contract', async () => {
    const provider = new FakeStreamingProvider('claude', ['The', ' weather', ' is', ' fine.']);
    const acc = new ChunkAccumulator();

    await provider.sendMessage([], undefined, acc.onChunk);

    expect(acc.textFor('claude')).toBe('The weather is fine.');
    expect(acc.doneChunks).toHaveLength(1);
  });
});

// ─── User attachments not leaked into StreamChunk.images ─────────────────────

describe('regression: user Attachment data does not appear in StreamChunk.images (#367)', () => {
  it('a user message with attachments does not produce images on the Claude done chunk', async () => {
    // An Attachment is user input (image → model); a GeneratedImage is model output.
    // These are entirely separate fields and must never cross-contaminate.
    const attachment: Attachment = {
      id: 'att-1',
      mimeType: 'image/png',
      base64: 'dXNlci11cGxvYWQ=', // "user-upload"
      sizeBytes: 1024,
    };
    const messagesWithAttachment: Message[] = [
      {
        id: 'msg-user',
        role: 'user',
        content: 'What is in this image?',
        timestamp: Date.now(),
        attachments: [attachment],
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      claudeTextOnlySseResponse('I can see a landscape.')
    ));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(messagesWithAttachment, undefined, acc.onChunk);

    // The attachment was sent as input — it must not appear on the response chunks.
    expect(acc.doneChunks[0].images).toBeUndefined();
    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });

  it('a user message with attachments does not produce images on the Gemini done chunk', async () => {
    const attachment: Attachment = {
      id: 'att-2',
      mimeType: 'image/jpeg',
      base64: 'dXNlci1waG90bw==', // "user-photo"
      sizeBytes: 2048,
    };
    const messagesWithAttachment: Message[] = [
      {
        id: 'msg-user',
        role: 'user',
        content: 'Describe this image.',
        timestamp: Date.now(),
        attachments: [attachment],
      },
    ];

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      geminiTextOnlySseResponse('The image shows a mountain range.')
    ));

    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();
    await provider.sendMessage(messagesWithAttachment, undefined, acc.onChunk);

    expect(acc.doneChunks[0].images).toBeUndefined();
    for (const chunk of acc.contentChunks) {
      expect(chunk.images).toBeUndefined();
    }
  });
});
