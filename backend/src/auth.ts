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
 */

import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
 * Errors: 400 (missing fields), 401 (bad credentials)
 */
authRouter.post('/login', (req: Request, res: Response): void => {
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
 * Errors: 401 (missing or invalid token)
 */
authRouter.post('/refresh', requireAuth, (_req: Request, res: Response): void => {
  const user = res.locals['user'] as JwtPayload;
  const token = issueToken(user.sub, user.username);
  res.json({ token });
});
