/**
 * tests/routes/proxy.test.ts — Anthropic proxy route tests (#472).
 *
 * Covers POST /api/proxy/anthropic/v1/messages (and any sub-path).
 *
 * Auth contract (wave 5 / #441):
 *   requireAuth middleware was added to the proxy route in wave 5 (#441).
 *   Unauthenticated requests now return 401. All test cases that exercise
 *   the proxy handler itself include a valid JWT obtained via loginAs().
 *
 *   If the auth requirement is removed in future, update:
 *     - createTestApp.ts (remove requireAuth from the proxy mount)
 *     - the auth-enforcement describe block below
 *
 * Rate limit contract:
 *   The production route applies a 60 req/60s per-IP rate limiter
 *   (proxyRateLimiter in index.ts). The limiter's skip() flag returns true
 *   when NODE_ENV=test, so 429 behaviour cannot be exercised in this suite.
 *   The contract is documented in the dedicated describe block at the bottom.
 *
 * Fetch stubbing:
 *   vi.stubGlobal('fetch', vi.fn()) replaces the global fetch for the duration
 *   of each test. vi.unstubAllGlobals() in afterEach restores the real fetch so
 *   other tests are not affected.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createTestApp, clearDatabase } from '../helpers/createTestApp';
import { insertUser, loginAs } from '../helpers/fixtures';

// --- Helpers -----------------------------------------------------------------

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

// --- Auth enforcement --------------------------------------------------------

describe('POST /api/proxy/anthropic/* -- auth enforcement (wave 5 / #441)', () => {
  /**
   * requireAuth was added to the proxy route in wave 5 (#441).
   * All requests without a valid Bearer token must return 401.
   *
   * If these tests start returning non-401 for unauthenticated requests,
   * auth has been removed from the proxy route -- update createTestApp.ts
   * and this describe block, and re-evaluate the security posture.
   */
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
    // Stub fetch so any requests that bypass auth do not hit the network.
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

  it('returns 401 with no Authorization header', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 with a malformed Bearer token', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', 'Bearer not-a-valid-jwt')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 with a non-Bearer scheme', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });
});

// --- Authenticated access ----------------------------------------------------

describe('POST /api/proxy/anthropic/* -- authenticated access', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    token = await loginAs(app.request, 'alice', 'hunter2');

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

  it('returns non-404 with a valid JWT -- route is mounted and reachable', async () => {
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    // The route is correctly mounted -- it does not 404.
    expect(res.status).not.toBe(404);
  });

  it('returns 200 and relays the Anthropic response body', async () => {
    const anthropicPayload = {
      id: 'msg_abc123',
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: 'Hello from Anthropic' }],
      model: 'claude-3-haiku-20240307',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeFakeResponse(200, JSON.stringify(anthropicPayload))),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(200);
    const parsed = typeof res.body === 'object' ? res.body : JSON.parse(res.text);
    expect(parsed.id).toBe('msg_abc123');
    expect(parsed.type).toBe('message');
  });
});

// --- Upstream network error --------------------------------------------------

describe('POST /api/proxy/anthropic/* -- upstream network error returns 502', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    token = await loginAs(app.request, 'alice', 'hunter2');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 502 with error.type=proxy_error when upstream fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ECONNREFUSED -- upstream unreachable')),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(502);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.type).toBe('proxy_error');
  });

  it('502 body includes the upstream error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('ETIMEDOUT')),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain('ETIMEDOUT');
  });
});

// --- Header forwarding -------------------------------------------------------

describe('POST /api/proxy/anthropic/* -- header forwarding to upstream', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    token = await loginAs(app.request, 'alice', 'hunter2');

    fetchStub = vi.fn().mockResolvedValue(
      makeFakeResponse(200, JSON.stringify({ id: 'msg_forwarded', type: 'message' })),
    );
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards x-api-key from the caller to the upstream Anthropic call', async () => {
    const userApiKey = 'sk-ant-test-key-12345';

    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .set('x-api-key', userApiKey)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe(userApiKey);
  });

  it('does not forward x-api-key when the caller omits it', async () => {
    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      // No x-api-key header.
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers['x-api-key']).toBeUndefined();
  });

  it('forwards anthropic-version when present', async () => {
    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .set('anthropic-version', '2023-06-01')
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('does not forward anthropic-version when the caller omits it', async () => {
    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [, fetchInit] = fetchStub.mock.calls[0] as [string, RequestInit];
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers['anthropic-version']).toBeUndefined();
  });
});

// --- URL construction --------------------------------------------------------

describe('POST /api/proxy/anthropic/* -- upstream URL construction', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    token = await loginAs(app.request, 'alice', 'hunter2');

    fetchStub = vi.fn().mockResolvedValue(
      makeFakeResponse(200, JSON.stringify({ id: 'msg_url', type: 'message' })),
    );
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards to https://api.anthropic.com/v1/messages for the standard endpoint', async () => {
    await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(fetchStub).toHaveBeenCalledOnce();
    const [url] = fetchStub.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
  });
});

// --- Upstream non-200 passthrough --------------------------------------------

describe('POST /api/proxy/anthropic/* -- upstream non-200 status passthrough', () => {
  /**
   * When Anthropic returns a 4xx or 5xx, the proxy must relay that status
   * verbatim to the caller rather than masking it as 200 or converting to 502.
   * 502 is reserved for fetch() failures (network errors / DNS failures).
   */
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    token = await loginAs(app.request, 'alice', 'hunter2');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('relays 429 from Anthropic when the upstream API key is rate-limited', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(429, JSON.stringify({ error: { type: 'rate_limit_error' } })),
      ),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(429);
  });

  it('relays 401 from Anthropic when the x-api-key is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(401, JSON.stringify({ error: { type: 'authentication_error' } })),
      ),
    );

    // requireAuth already passed (our JWT is valid) -- this 401 is from Anthropic upstream.
    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(401);
  });

  it('relays 500 from Anthropic when the upstream has a server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeFakeResponse(500, JSON.stringify({ error: { type: 'api_error' } })),
      ),
    );

    const res = await app.request
      .post('/api/proxy/anthropic/v1/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ model: 'claude-3-haiku-20240307', messages: [] });

    expect(res.status).toBe(500);
  });
});

// --- Rate limit contract (documented) ----------------------------------------

describe('POST /api/proxy/anthropic/* -- rate limit contract (documented, not exercised)', () => {
  /**
   * DOCUMENTED DESIGN:
   *   The production proxy route (index.ts line 94) applies proxyRateLimiter:
   *   60 requests per 60s per IP, returning HTTP 429 with { error: 'too_many_requests' }
   *   when exceeded.
   *
   *   The limiter's skip() flag returns true when NODE_ENV=test, so the 429
   *   behaviour cannot be reproduced in this test environment.
   *
   *   The rate limiter is distinct from Anthropic's own per-key rate limit:
   *   - proxyRateLimiter (ours): 60 req/60s per IP, { error: 'too_many_requests' }
   *   - Anthropic upstream rate limit: relayed verbatim as a 429 from Anthropic
   *     (tested above in "upstream non-200 passthrough")
   */
  it('rate limiter skip() is true in NODE_ENV=test -- 429 contract documented but not exercised here', () => {
    expect(process.env['NODE_ENV']).toBe('test');
  });
});
