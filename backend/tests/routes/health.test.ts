/**
 * tests/routes/health.test.ts — Smoke tests for infrastructure and the health endpoint.
 *
 * These are the first tests to run. If they fail, the test setup itself is broken —
 * diagnose setup.ts, createTestApp.ts, or the Vitest config before continuing.
 */

import { describe, it, expect } from 'vitest';
import { createTestApp } from '../helpers/createTestApp';

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const { request } = createTestApp();
    const res = await request.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('unknown routes', () => {
  it('returns 404 with { error: "not_found" } for an unknown path', async () => {
    const { request } = createTestApp();
    const res = await request.get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
  });
});
