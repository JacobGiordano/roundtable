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

import { db, seedAdminUser } from './db';
import { authRouter } from './auth';
import { conversationsRouter } from './conversations';
import { exportRouter } from './export';
import { requireAuth } from './auth';

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

// CORS — allow all origins by default for self-hosted convenience.
// Users who need stricter CORS can set CORS_ORIGIN in their .env.
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use(cors({ origin: corsOrigin }));

// ─── Routes ───────────────────────────────────────────────────────────────────

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
