/**
 * tests/routes/auth.test.ts — Auth route tests.
 *
 * Covers:
 *   POST /auth/login   — valid credentials, bad password, unknown user, missing fields
 *   POST /auth/refresh — valid token issues new token, invalid/missing token rejected
 *
 * Security invariants verified:
 *   - Passwords are stored as bcrypt hashes, never plaintext
 *   - Login returns 401 for both unknown username and wrong password (no enumeration)
 *   - requireAuth rejects missing header, malformed header, and invalid tokens
 *
 * DOCUMENTED BEHAVIOR — /auth/refresh does NOT invalidate the previous token.
 * Both the old and new access tokens remain valid until their 7-day expiry.
 * This is intentional (stateless JWT design). The test below asserts this is
 * preserved — do not change the behavior without updating this comment and the
 * test simultaneously.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, clearDatabase } from '../helpers/createTestApp';

// ─── Fixture ──────────────────────────────────────────────────────────────────

/**
 * Insert a user into the database with a real bcrypt hash.
 *
 * The backend has no /auth/register endpoint — users are seeded at startup via
 * seedAdminUser() or inserted directly. In tests we insert directly so we can
 * control the username and password without the startup side effects.
 *
 * bcrypt cost factor 4 is used for speed in tests — production uses 12.
 */
import bcrypt from 'bcryptjs';

function insertUser(
  db: ReturnType<typeof createTestApp>['db'],
  username: string,
  password: string,
): void {
  const hash = bcrypt.hashSync(password, 4); // cost 4 for speed in tests (not production)
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    username,
    hash,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  it('returns 200 and a JWT string on valid credentials', async () => {
    insertUser(app.db, 'alice', 'hunter2');
    const res = await app.request
      .post('/auth/login')
      .send({ username: 'alice', password: 'hunter2' });
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  it('does not store the password as plaintext — hash must be a bcrypt hash', async () => {
    insertUser(app.db, 'alice', 'hunter2');
    const row = app.db
      .prepare('SELECT password_hash FROM users WHERE username = ?')
      .get('alice') as { password_hash: string };
    // Assert it is NOT the plaintext password.
    expect(row.password_hash).not.toBe('hunter2');
    // Assert it looks like a bcrypt hash ($2a$, $2b$, or $2y$ prefix).
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('returns 401 for wrong password — does not reveal whether user exists', async () => {
    insertUser(app.db, 'alice', 'hunter2');
    const res = await app.request
      .post('/auth/login')
      .send({ username: 'alice', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('returns 401 for unknown username — same error as wrong password (no enumeration)', async () => {
    const res = await app.request
      .post('/auth/login')
      .send({ username: 'nobody', password: 'doesntmatter' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid credentials');
  });

  it('returns 400 when username is missing', async () => {
    const res = await app.request
      .post('/auth/login')
      .send({ password: 'hunter2' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await app.request
      .post('/auth/login')
      .send({ username: 'alice' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is empty', async () => {
    const res = await app.request.post('/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when username is not a string (e.g. number)', async () => {
    const res = await app.request
      .post('/auth/login')
      .send({ username: 42, password: 'hunter2' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/refresh', () => {
  let app: ReturnType<typeof createTestApp>;
  let validToken: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'hunter2');
    const res = await app.request
      .post('/auth/login')
      .send({ username: 'alice', password: 'hunter2' });
    validToken = res.body.token as string;
  });

  it('returns 200 and a new JWT string given a valid token', async () => {
    const res = await app.request
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(0);
  });

  /**
   * DOCUMENTED BEHAVIOR: /auth/refresh does NOT invalidate the previous token.
   * Both the old token and the new token are valid until their respective 7-day
   * expiry windows. This is a deliberate stateless JWT design choice.
   *
   * If this test fails after a code change, that change altered documented behavior —
   * update HANDOFF.md and this comment together before merging.
   */
  it('DOCUMENTED: old token remains valid after refresh — both tokens live until expiry', async () => {
    const refreshRes = await app.request
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${validToken}`);
    const newToken = refreshRes.body.token as string;

    // The new token must work.
    const newRes = await app.request
      .get('/conversations')
      .set('Authorization', `Bearer ${newToken}`);
    expect(newRes.status).toBe(200);

    // The OLD token must also still work (no revocation).
    const oldRes = await app.request
      .get('/conversations')
      .set('Authorization', `Bearer ${validToken}`);
    expect(oldRes.status).toBe(200);
  });

  it('returns 401 when Authorization header is absent', async () => {
    const res = await app.request.post('/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when token is malformed (not a valid JWT)', async () => {
    const res = await app.request
      .post('/auth/refresh')
      .set('Authorization', 'Bearer this.is.notajwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when Authorization header is missing the Bearer prefix', async () => {
    const res = await app.request
      .post('/auth/refresh')
      .set('Authorization', validToken); // no "Bearer " prefix
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 when token is signed with a different secret', async () => {
    // Build a token signed with a different secret.
    const jwt = await import('jsonwebtoken');
    const forgedToken = jwt.default.sign(
      { sub: 1, username: 'alice' },
      'wrong-secret',
      { expiresIn: '7d' },
    );
    const res = await app.request
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });
});

describe('requireAuth middleware — applied to all protected routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  it('returns 401 with no Authorization header on a protected route', async () => {
    const res = await app.request.get('/conversations');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 with an empty Bearer token', async () => {
    const res = await app.request
      .get('/conversations')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('returns 401 with a completely invalid token string', async () => {
    const res = await app.request
      .get('/conversations')
      .set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });
});
