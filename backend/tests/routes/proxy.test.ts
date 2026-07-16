/**
 * tests/routes/proxy.test.ts — Anthropic proxy route tests.
 *
 * Covers POST /api/proxy/anthropic/v1/messages (and any sub-path).
 *
 * Design notes carried from anthropicProxy.ts:
 *   - The proxy does NOT authenticate callers. The Anthropic API key is the
 *     access credential. Unauthenticated access is INTENTIONAL. See security
 *     notes in anthropicProxy.ts.
 *   - The x-api-key header from the browser request is forwarded verbatim to
 *     Anthropic. The proxy never stores or logs it.
 *   - Network errors from Anthropic return 502.
 *
 * Fetch stubbing:
 *   vi.stubGlobal('fetch', vi.fn()) replaces the global fetch for the duration
 *   of each test. vi.unstubAllGlobals() in afterEach restores the real fetch so
 *   other tests are not affected.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestApp } from '../helpers/createTestApp';
import { clearDatabase } from '../helpers/createTestApp';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal fake Response object that satisfies the fetch Response API
 * used by the proxy: status, headers.get(), body (ReadableStream via getReader).
 */
function makeFakeResponse(
  status: number,
  body: string,
  contentType = 'application/json',
): Response {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(body);

  // Build a minimal ReadableStream that yields the body once then signals done.
  let consumed = false;
  const stream = {
    getReader(): ReadableStreamDefaultReader<Uint8Array> {
      return {
        read() {
          if (!consumed) {
            consumed = true;
            return Promise.resolve({ done: false, value: encoded });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
        releaseLock() {},
        closed: Promise.resolve(undefined),
        cancel() { return Promise.resolve(); },
      } as unknown as ReadableStreamDefaultReader<Uint8Array>;
    },
  } as unknown as ReadableStream<Uint8Array>;

  return {
    status,
    headers: {
      get(name: string) {
        if (name === 'content-type') return contentType;
        return null;
      },
    },
    body: stream,
  } as unknown as Response;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/proxy/anthropic/* — route exists', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
    // Stub fetch so no real network call is made.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(200, JSON.stringify({ id: 'msg_test', type: 'message' })),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('POST /api/proxy/anthropic/v1/messages returns non-404', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });
    // The proxy forwards to Anthropic — as long as it is mounted correctly,
    // the status will NOT be 404 (even if Anthropic's fake response returns 4xx).
    expect(res.status).not.toBe(404);
  });
});

describe('POST /api/proxy/anthropic/* — unauthenticated access is intentional', () => {
  /**
   * DOCUMENTED DESIGN DECISION:
   *   The Anthropic proxy route does NOT require a JWT. The Anthropic API key
   *   passed in x-api-key is the sole access credential — the proxy trusts the
   *   upstream Anthropic authorization model.
   *
   *   This is intentional for single-user self-hosted deployments. In a
   *   multi-user deployment, add requireAuth middleware to this route in
   *   index.ts (and createTestApp.ts). See anthropicProxy.ts security notes.
   *
   *   If this test starts returning 401, the intentional design has changed —
   *   update this comment and the createTestApp mount accordingly.
   */
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(200, JSON.stringify({ id: 'msg_test', type: 'message' })),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns non-401 with no Authorization header — no auth required by design', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      // No Authorization header — intentionally unauthenticated.
      .send({ model: 'claude-3-haiku-20240307', messages: [] });
    // INTENTIONAL: proxy is unauthenticated. If this starts returning 401,
    // auth has been added to the proxy route — update this test.
    expect(res.status).not.toBe(401);
  });
});

describe('POST /api/proxy/anthropic/* — upstream network error returns 502', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 502 when the upstream fetch throws a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED — upstream unreachable')),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.type).toBe('proxy_error');
  });
});

describe('POST /api/proxy/anthropic/* — passes through Anthropic response body', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relays the Anthropic response body to the caller', async () => {
    const anthropicPayload = {
      id: 'msg_abc123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Anthropic' }],
      model: 'claude-3-haiku-20240307',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(200, JSON.stringify(anthropicPayload)),
      ),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(200);
    // The proxy pipes bytes directly — the body arrives as the Anthropic payload.
    const parsed = typeof res.body === 'object' ? res.body : JSON.parse(res.text);
    expect(parsed.id).toBe('msg_abc123');
    expect(parsed.type).toBe('message');
  });
});

describe('POST /api/proxy/anthropic/* — x-api-key header forwarded to Anthropic', () => {
  let app: ReturnType<typeof createTestApp>;
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();

    fetchStub = vi.fn().mockResolvedValue(
      makeFakeResponse(200, JSON.stringify({ id: 'msg_forwarded', type: 'message' })),
    );
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards x-api-key from the request to the upstream Anthropic call', async () => {
    const userApiKey = 'sk-ant-test-key-12345';

    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('x-api-key', userApiKey)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    // The stub must have been called exactly once.
    expect(fetchStub).toHaveBeenCalledOnce();

    // Extract the headers argument passed to fetch.
    const [_url, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;

    expect(headers['x-api-key']).toBe(userApiKey);
  });

  it('does not forward x-api-key when the request omits it', async () => {
    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      // No x-api-key header.
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [_url, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;

    // When no key is provided, the header must not appear in the forwarded request.
    expect(headers['x-api-key']).toBeUndefined();
  });
});
