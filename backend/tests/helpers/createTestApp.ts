/**
 * tests/helpers/createTestApp.ts — Creates an isolated Express app for testing.
 *
 * WHY THIS EXISTS:
 *   index.ts (the production entry point) calls process.exit(1) if JWT_SECRET is
 *   missing and starts an HTTP listener — neither is appropriate for tests.
 *   This helper assembles the same Express app from its constituent route modules
 *   without the startup side effects.
 *
 * DATABASE ISOLATION:
 *   The db singleton in db.ts is initialized once per module registry. Because
 *   vitest.config.ts uses isolate:true and pool:'forks', each test file gets a
 *   fresh module registry and therefore a fresh in-memory SQLite database.
 *   Within a single test file, tests share the db — use clearDatabase() in
 *   beforeEach to reset state between tests.
 *
 * USAGE:
 *   import { createTestApp, clearDatabase } from '../helpers/createTestApp'
 *
 *   beforeEach(() => clearDatabase())
 *
 *   it('returns 200 on GET /health', async () => {
 *     const { request } = createTestApp()
 *     const res = await request.get('/health')
 *     expect(res.status).toBe(200)
 *   })
 */

import express from 'express';
import supertest from 'supertest';
import { db } from '../../src/db';
import { authRouter, requireAuth } from '../../src/auth';
import { conversationsRouter } from '../../src/conversations';
import { exportRouter } from '../../src/export';
import { anthropicProxyRouter } from '../../src/anthropicProxy';

/**
 * Build and return an Express app wired identically to the production server
 * (minus the HTTP listener and startup side effects).
 *
 * Returns a Supertest request agent bound to the app.
 */
export function createTestApp() {
  const app = express();

  app.use(express.json());

  // Anthropic proxy — no auth required (mirrors index.ts mount order).
  // Tests stub globalThis.fetch via vi.stubGlobal to avoid real network calls.
  app.use('/api/proxy/anthropic', express.json({ limit: '2mb' }), anthropicProxyRouter);

  // Auth routes — unprotected (mirrors index.ts mount order).
  app.use('/auth', authRouter);

  // Conversation routes — JWT required.
  app.use('/conversations', requireAuth, conversationsRouter);

  // Export route — nested under /conversations/:id/export (JWT required).
  app.use('/conversations/:id/export', requireAuth, exportRouter);

  // Health check.
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // 404 catch-all.
  app.use((_req, res) => {
    res.status(404).json({ error: 'not_found' });
  });

  return {
    request: supertest(app),
    // Expose db so tests can make direct assertions on database state (e.g.,
    // verifying password_hash is bcrypt, not plaintext).
    db,
  };
}

/**
 * Wipe all rows from all application tables.
 *
 * Call this in beforeEach to reset database state between tests within a file.
 * Schema (CREATE TABLE) is preserved — only data is removed.
 */
export function clearDatabase(): void {
  db.prepare('DELETE FROM conversations').run();
  db.prepare('DELETE FROM users').run();
}
