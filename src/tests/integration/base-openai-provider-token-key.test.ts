/**
 * Unit: BaseOpenAIProvider — max_completion_tokens vs max_tokens selection (#304)
 *
 * Guards the fix shipped in #304: gpt-5.5, o3, o1, and o1-mini must send
 * `max_completion_tokens` in the request body; gpt-4o and gpt-4o-mini must
 * send `max_tokens`. The two keys are mutually exclusive — sending the wrong
 * one returns a 400 from the OpenAI API:
 *   "Unsupported parameter: 'max_tokens' is not supported with this model.
 *    Use 'max_completion_tokens' instead."
 *
 * The selection lives in BaseOpenAIProvider.ts — a module-level Set called
 * MAX_COMPLETION_TOKENS_MODELS drives a computed property key on the request
 * body. This test exercises that path through GPT55ModelProvider, which
 * extends BaseOpenAIProvider and accepts all six model version strings via
 * the `selectedVersionId` parameter.
 *
 * Mocking strategy: stub fetch at the network boundary, set a fake credential
 * so the provider clears the auth guard, and inspect the raw JSON body that
 * the provider sends. The stub returns a 500 so the provider emits a
 * network_error chunk and exits cleanly — no SSE ReadableStream needed.
 *
 * Cross-agent contract exercised:
 *   BaseOpenAIProvider.sendMessage() — Atlas's token-key selection logic
 *   GPT55ModelProvider — concrete subclass under test
 *   getCredentials('openai') — Gate's auth check (real implementation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GPT55ModelProvider } from '@/models/gpt';
import { buildLocalStorageMock, makeUserMessage, resetIdSeq } from '../fixtures/conversations';
import type { Message } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
  // Credential must be present so the provider clears the auth guard and reaches
  // the fetch call. Without it, sendMessage returns early with auth_failure before
  // the request body is ever built.
  globalThis.localStorage.setItem('roundtable:key:openai', 'test-key-abc123');
});

afterEach(() => {
  restoreLocalStorage();
  vi.restoreAllMocks();
});

const SAMPLE_MESSAGES: Message[] = [makeUserMessage('Hello')];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Stubs globalThis.fetch so it captures the request body and immediately
 * returns a 500. The 500 causes BaseOpenAIProvider to emit a network_error
 * chunk and exit cleanly — no SSE stream setup required.
 *
 * Returns a getter that retrieves the parsed JSON body from the most recent
 * fetch call. Call it after `await provider.sendMessage(...)` completes.
 */
function stubFetchCapture(): () => Record<string, unknown> {
  let lastBody: Record<string, unknown> = {};

  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      lastBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return {
        ok: false,
        status: 500,
        json: async () => ({}),
      };
    }),
  );

  return () => lastBody;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BaseOpenAIProvider — token limit key selection (#304)', () => {
  const provider = new GPT55ModelProvider();
  const noop = () => {};

  // ─── Models that require max_completion_tokens ──────────────────────────

  describe('models that require max_completion_tokens', () => {
    const models = ['gpt-5.5', 'o3', 'o1', 'o1-mini'];

    for (const model of models) {
      it(`${model}: sends max_completion_tokens, not max_tokens`, async () => {
        const getBody = stubFetchCapture();

        await provider.sendMessage(SAMPLE_MESSAGES, undefined, noop, model);

        const body = getBody();
        // The request body must carry max_completion_tokens with a positive value.
        expect(body).toHaveProperty('max_completion_tokens');
        expect(typeof body.max_completion_tokens).toBe('number');
        expect(body.max_completion_tokens as number).toBeGreaterThan(0);
        // max_tokens must be absent — sending it to these models returns a 400.
        expect(body).not.toHaveProperty('max_tokens');
        // Confirm the model string was forwarded correctly.
        expect(body.model).toBe(model);
      });
    }
  });

  // ─── Models that require max_tokens ────────────────────────────────────

  describe('models that require max_tokens', () => {
    const models = ['gpt-4o', 'gpt-4o-mini'];

    for (const model of models) {
      it(`${model}: sends max_tokens, not max_completion_tokens`, async () => {
        const getBody = stubFetchCapture();

        await provider.sendMessage(SAMPLE_MESSAGES, undefined, noop, model);

        const body = getBody();
        // The request body must carry max_tokens with a positive value.
        expect(body).toHaveProperty('max_tokens');
        expect(typeof body.max_tokens).toBe('number');
        expect(body.max_tokens as number).toBeGreaterThan(0);
        // max_completion_tokens must be absent — it is not accepted by these models.
        expect(body).not.toHaveProperty('max_completion_tokens');
        // Confirm the model string was forwarded correctly.
        expect(body.model).toBe(model);
      });
    }
  });
});
