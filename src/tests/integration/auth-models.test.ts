/**
 * Integration: Auth + Models
 *
 * Tests that missing or invalid API keys produce the correct ModelErrorCode
 * through the real model provider implementations. This exercises the boundary
 * where Gate (credentials.ts) meets Atlas (model providers).
 *
 * Cross-agent contract exercised:
 *   getCredentials() from @/auth — Gate's implementation
 *   ClaudeModelProvider.sendMessage() — Atlas's implementation
 *   ModelErrorCode 'auth_failure' — Arch's type contract
 *   StreamChunk.error field — Arch's type contract
 *
 * Mocking strategy: mock at the network boundary (fetch) — NOT at the
 * ModelProvider interface. This ensures the real auth check and error mapping
 * code is exercised, not bypassed.
 *
 * localStorage is mocked to control what getCredentials() returns.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeModelProvider } from '@/models/claude';
import { GPT55ModelProvider } from '@/models/gpt';
import { GeminiModelProvider } from '@/models/gemini';
import { GrokModelProvider } from '@/models/grok';
import { DeepSeekModelProvider } from '@/models/deepseek';
import { MistralModelProvider } from '@/models/mistral';
import { buildLocalStorageMock, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import { ChunkAccumulator } from '../fixtures/mockProviders';
import type { Message } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
  // Start every test with no credentials stored.
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

const SAMPLE_MESSAGES: Message[] = [makeUserMessage('Hello')];

// ─── Missing API key tests ────────────────────────────────────────────────────

describe('auth + models — missing API key produces auth_failure', () => {
  it('ClaudeModelProvider emits auth_failure when anthropic key is absent', async () => {
    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.doneChunks).toHaveLength(1);
    expect(acc.hasErrorFor('claude')).toBe(true);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('auth_failure');
    expect(error!.message).toMatch(/API key/i);
  });

  it('GPT55ModelProvider emits auth_failure when openai key is absent', async () => {
    const provider = new GPT55ModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('gpt-5.5')).toBe(true);
    const error = acc.errorFor('gpt-5.5');
    expect(error!.code).toBe('auth_failure');
  });

  it('GeminiModelProvider emits auth_failure when google key is absent', async () => {
    const provider = new GeminiModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('gemini')).toBe(true);
    const error = acc.errorFor('gemini');
    expect(error!.code).toBe('auth_failure');
  });

  it('GrokModelProvider emits auth_failure when xai key is absent', async () => {
    const provider = new GrokModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('grok')).toBe(true);
    const error = acc.errorFor('grok');
    expect(error!.code).toBe('auth_failure');
  });

  it('DeepSeekModelProvider emits auth_failure when deepseek key is absent', async () => {
    const provider = new DeepSeekModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('deepseek')).toBe(true);
    const error = acc.errorFor('deepseek');
    expect(error!.code).toBe('auth_failure');
  });

  it('MistralModelProvider emits auth_failure when mistral key is absent', async () => {
    const provider = new MistralModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    expect(acc.hasErrorFor('mistral')).toBe(true);
    const error = acc.errorFor('mistral');
    expect(error!.code).toBe('auth_failure');
  });
});

describe('auth + models — done chunk structure on auth failure', () => {
  it('auth failure emits a priming chunk then a done error chunk', async () => {
    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    // emitErrorChunk emits a non-done priming chunk (isDone:false, content:'') first so
    // useStreamingMessages creates an accumulator entry, then the done error chunk.
    // The priming chunk has empty content — it is not a partial model response.
    expect(acc.contentChunks).toHaveLength(1);
    expect(acc.contentChunks[0].content).toBe('');
    expect(acc.doneChunks).toHaveLength(1);
  });

  it('auth failure done chunk has empty content field', async () => {
    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const done = acc.doneChunks[0];
    expect(done.content).toBe('');
    expect(done.isDone).toBe(true);
  });

  it('sendMessage resolves (does not throw) even when auth fails', async () => {
    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    // Must resolve — auth errors are surfaced via chunks, not rejections.
    await expect(
      provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk)
    ).resolves.toBeDefined();
  });
});

/**
 * Regression guard for #544 / #546 — classifyHttpError body-inspection.
 *
 * xAI/Grok returns HTTP 400 for an invalid API key instead of the conventional
 * 401. classifyHttpError() inspects the response body to distinguish an auth
 * failure ("Invalid API key provided") from a genuine context-length overflow
 * ("Your prompt is too long").
 *
 * These tests exercise the full GrokModelProvider code path (real provider +
 * mocked fetch at the network boundary) to guard against regressions where the
 * body-inspection branch is accidentally removed or bypassed.
 */
describe('auth + models — Grok 400 body-inspection (regression #546)', () => {
  it('Grok HTTP 400 with auth error body maps to auth_failure', async () => {
    // Provide a credential so we pass the "no key" early-exit guard.
    globalThis.localStorage.setItem('roundtable:key:xai', 'invalid-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid API key provided' } }),
    }));

    const provider = new GrokModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('grok');
    expect(error).not.toBeNull();
    expect(error!.code).toBe('auth_failure');
    expect(error!.message).toContain('Invalid API key provided');
  });

  it('Grok HTTP 400 with context-length error body maps to context_length_exceeded', async () => {
    globalThis.localStorage.setItem('roundtable:key:xai', 'valid-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Your prompt is too long' } }),
    }));

    const provider = new GrokModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('grok');
    expect(error).not.toBeNull();
    expect(error!.code).toBe('context_length_exceeded');
    expect(error!.message).toContain('Your prompt is too long');
  });
});

describe('auth + models — network error classification (401/403 → auth_failure)', () => {
  it('HTTP 401 response maps to auth_failure error code', async () => {
    // Set a credential so we get past the "no key" guard and reach the HTTP layer.
    globalThis.localStorage.setItem('roundtable:key:anthropic', 'invalid-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    }));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('auth_failure');
    expect(error!.message).toContain('Invalid API key');
  });

  it('HTTP 403 response maps to auth_failure error code', async () => {
    globalThis.localStorage.setItem('roundtable:key:anthropic', 'forbidden-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    }));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('auth_failure');
  });

  it('HTTP 429 response maps to rate_limit error code', async () => {
    globalThis.localStorage.setItem('roundtable:key:anthropic', 'real-key');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    }));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('rate_limit');
  });

  it('network failure (fetch throws) maps to network_error code', async () => {
    globalThis.localStorage.setItem('roundtable:key:anthropic', 'real-key');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));

    const provider = new ClaudeModelProvider();
    const acc = new ChunkAccumulator();

    await provider.sendMessage(SAMPLE_MESSAGES, undefined, acc.onChunk);

    const error = acc.errorFor('claude');
    expect(error!.code).toBe('network_error');
    expect(error!.message).toContain('Failed to fetch');
  });
});
