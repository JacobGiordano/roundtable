/**
 * index.ts — Express application entry point.
 *
 * Mounts routers:
 *   /auth            → authRouter (login, refresh — unprotected)
 *   /conversations   → conversationsRouter (CRUD — JWT required)
 *   /conversations/:id/export → exportRouter (JWT required)
 *
 * Startup sequence:
 *   1. Load environment variables from .env (dotenv)
 *   2. Seed admin user if users table is empty
 *   3. Mount routers
 *   4. Listen on PORT (default 3001)
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import { db, seedAdminUser } from './db';
import { authRouter } from './auth';
import { conversationsRouter } from './conversations';
import { exportRouter } from './export';
import { requireAuth } from './auth';
import { anthropicProxyRouter } from './anthropicProxy';

// ─── Startup checks ───────────────────────────────────────────────────────────

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.error('[startup] FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
if (jwtSecret === 'change-me-in-production') {
  console.warn(
    '[startup] WARNING: JWT_SECRET is set to the example placeholder. ' +
    'Change it before exposing this server to the internet.'
  );
}

// Seed admin user on first run.
seedAdminUser();

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Parse JSON bodies on all routes.
app.use(express.json());

// CORS — no wildcard default. When CORS_ORIGIN is unset, cross-origin requests
// are blocked by the browser's built-in same-origin policy. Self-hosters must
// set CORS_ORIGIN to the exact frontend origin (e.g. https://app.example.com).
const corsOrigin = process.env.CORS_ORIGIN ?? undefined;
if (!corsOrigin) {
  console.warn(
    '[startup] WARNING: CORS_ORIGIN is not set. Cross-origin requests will be ' +
    'blocked by the browser. Set CORS_ORIGIN to your frontend origin ' +
    '(e.g. CORS_ORIGIN=https://app.example.com) before exposing this server.'
  );
}
app.use(cors({ origin: corsOrigin }));

// ─── Proxy rate limiter ───────────────────────────────────────────────────────

/**
 * Circuit-breaker rate limiter for the Anthropic proxy.
 *
 * Limits each IP to 60 requests per minute. The Anthropic API enforces its own
 * per-key rate limits upstream, but this prevents a single authenticated client
 * from monopolising the proxy or triggering upstream throttling for all users.
 *
 * Returns HTTP 429 with { error: 'too_many_requests' } when exceeded.
 * Skipped in test environments (NODE_ENV=test) so Bastion tests are unaffected.
 */
const proxyRateLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute
  max: 60,                     // 60 requests per window per IP
  standardHeaders: 'draft-7',  // emit RateLimit-* headers per RFC 9110 draft-7
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
  skip: () => process.env['NODE_ENV'] === 'test',
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Anthropic proxy — server-side pass-through for browser clients.
// Anthropic blocks browser-direct calls (CORS 400). This route forwards
// POST /api/proxy/anthropic/v1/messages → https://api.anthropic.com/v1/messages.
// Requires a valid JWT (requireAuth) — callers must be authenticated backend
// users. The proxy rate limiter (proxyRateLimiter) adds a 60 req/min circuit-
// breaker per IP on top of the upstream Anthropic API limits.
app.use('/api/proxy/anthropic', proxyRateLimiter, requireAuth, express.json({ limit: '2mb' }), anthropicProxyRouter);

// Auth routes — unprotected.
app.use('/auth', authRouter);

// Conversation routes — all require a valid JWT.
app.use('/conversations', requireAuth, conversationsRouter);

// Export route — nested under /conversations/:id/export (JWT required).
app.use('/conversations/:id/export', requireAuth, exportRouter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'not_found' });
});

// ─── Listen ───────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10);

app.listen(PORT, () => {
  console.log(`[server] Roundtable backend listening on http://localhost:${PORT}`);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on('SIGTERM', () => {
  console.log('[server] SIGTERM received, closing database and shutting down.');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[server] SIGINT received, closing database and shutting down.');
  db.close();
  process.exit(0);
});
