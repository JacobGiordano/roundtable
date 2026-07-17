/**
 * auth.ts — JWT authentication: login, refresh, and middleware.
 *
 * POST /auth/login   — validate username+password, issue 7-day JWT
 * POST /auth/refresh — validate existing JWT, issue fresh 7-day JWT
 *
 * requireAuth middleware — verifies the Bearer token on protected routes.
 * On success: attaches decoded payload to res.locals.user, calls next().
 * On failure: 401 { error: 'unauthorized' }.
 *
 * JWT_SECRET is read from the environment. The server refuses to start if it
 * is missing or still set to the placeholder value in production — see index.ts.
 *
 * Rate limiting:
 *   /auth/login and /auth/refresh share an IP-based rate limiter:
 *   max 5 requests per 15-minute window per IP. Exceeding the limit returns
 *   HTTP 429 with { error: 'too_many_requests' }. The window resets after 15 minutes.
 *   This defends self-hosted instances against brute-force password guessing.
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number;   // user id
  username: string;
}

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return secret;
}

function issueToken(userId: number, username: string): string {
  const payload: JwtPayload = { sub: userId, username };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

// ─── Rate limiter ─────────────────────────────────────────────────────────────

/**
 * Shared rate limiter for auth credential endpoints.
 *
 * Applied to POST /auth/login and POST /auth/refresh.
 * Limits to 5 requests per IP per 15-minute window.
 * Returns HTTP 429 with { error: 'too_many_requests' } when exceeded.
 *
 * Design note: /auth/refresh already requires a valid Bearer token, so rate
 * limiting it prevents an attacker who has compromised one token from using it
 * to probe the system at high volume (e.g., timing attacks against other routes).
 *
 * Skip flag: in test environments (NODE_ENV=test) the limiter is a no-op so
 * existing auth tests are not affected by the 5-request cap. The skip is
 * intentionally narrow — it does not disable bcrypt timing protection or any
 * other auth behaviour.
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                   // max 5 requests per window per IP
  standardHeaders: 'draft-7', // emit RateLimit-* headers per RFC 9110 draft-7
  legacyHeaders: false,
  message: { error: 'too_many_requests' },
  skip: () => process.env['NODE_ENV'] === 'test',
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

/**
 * Express middleware that verifies the Authorization: Bearer <token> header.
 *
 * On success: attaches the decoded JWT payload to res.locals.user, calls next().
 * On failure: responds 401 { error: 'unauthorized' } without calling next().
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, getJwtSecret()) as unknown as JwtPayload;
    res.locals['user'] = payload;
    next();
  } catch {
    res.status(401).json({ error: 'unauthorized' });
  }
}

// ─── Auth router ─────────────────────────────────────────────────────────────

export const authRouter = Router();

/**
 * POST /auth/login
 * Body: { username: string, password: string }
 * Returns: { token: string }
 * Errors: 400 (missing fields), 401 (bad credentials), 429 (rate limit exceeded)
 */
authRouter.post('/login', authRateLimiter, (req: Request, res: Response): void => {
  const { username, password } = req.body as Record<string, unknown>;

  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const user = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username) as UserRow | undefined;

  if (!user) {
    // Perform a dummy compare to avoid timing attacks that reveal username existence.
    bcrypt.compareSync('dummy', '$2a$12$invalidhashpadding000000000000000000000000000000000000');
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'invalid credentials' });
    return;
  }

  const token = issueToken(user.id, user.username);
  res.json({ token });
});

/**
 * POST /auth/refresh
 * Requires Authorization: Bearer <token>
 * Returns: { token: string } with fresh 7-day expiry
 * Errors: 401 (missing or invalid token), 429 (rate limit exceeded)
 */
authRouter.post('/refresh', authRateLimiter, requireAuth, (_req: Request, res: Response): void => {
  const user = res.locals['user'] as JwtPayload;
  const token = issueToken(user.sub, user.username);
  res.json({ token });
});
