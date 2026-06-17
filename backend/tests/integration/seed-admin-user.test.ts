/**
 * tests/integration/seed-admin-user.test.ts — Tests for seedAdminUser().
 *
 * seedAdminUser() is called at every backend startup (index.ts line 41) but
 * had zero test coverage. This file closes that gap.
 *
 * CONTRACT (from /backend/src/db.ts):
 *   - On first run: inserts one row into the users table with the bcrypt-hashed
 *     password from ADMIN_USERNAME / ADMIN_PASSWORD env vars (defaults: admin / changeme).
 *   - Idempotent: if the users table is non-empty, returns immediately — no
 *     duplicate insert, no error.
 *   - Uses bcrypt cost factor 12 (production-grade, unlike the test fixtures
 *     which use cost 4).
 *   - Falls back to username='admin' and password='changeme' when env vars
 *     are absent.
 *
 * ISOLATION STRATEGY:
 *   Each test uses clearDatabase() to wipe state before running, then calls
 *   seedAdminUser() directly against the shared in-memory db. Because vitest
 *   runs each file in its own worker (pool: 'forks'), no cross-file state leaks.
 *   Within this file, clearDatabase() + explicit env var manipulation keeps
 *   each test self-contained.
 *
 * ENV VARS:
 *   ADMIN_USERNAME and ADMIN_PASSWORD are read at call-time by seedAdminUser()
 *   (not at module import time), so they can be set/unset between tests safely.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { db, seedAdminUser } from '../../src/db';
import { clearDatabase } from '../helpers/createTestApp';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countUsers(): number {
  return (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
}

function getUser(username: string): { id: number; username: string; password_hash: string } | undefined {
  return db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string } | undefined;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('seedAdminUser() — first run (empty users table)', () => {
  let savedUsername: string | undefined;
  let savedPassword: string | undefined;

  beforeEach(() => {
    clearDatabase();
    // Save and clear env vars so each test starts clean.
    savedUsername = process.env['ADMIN_USERNAME'];
    savedPassword = process.env['ADMIN_PASSWORD'];
    delete process.env['ADMIN_USERNAME'];
    delete process.env['ADMIN_PASSWORD'];
  });

  afterEach(() => {
    // Restore env vars to their pre-test state.
    if (savedUsername !== undefined) {
      process.env['ADMIN_USERNAME'] = savedUsername;
    } else {
      delete process.env['ADMIN_USERNAME'];
    }
    if (savedPassword !== undefined) {
      process.env['ADMIN_PASSWORD'] = savedPassword;
    } else {
      delete process.env['ADMIN_PASSWORD'];
    }
  });

  it('creates exactly one user row when the table is empty', () => {
    expect(countUsers()).toBe(0);
    seedAdminUser();
    expect(countUsers()).toBe(1);
  });

  it('uses "admin" as the default username when ADMIN_USERNAME is not set', () => {
    seedAdminUser();
    const user = getUser('admin');
    expect(user).toBeDefined();
    expect(user!.username).toBe('admin');
  });

  it('uses "changeme" as the default password when ADMIN_PASSWORD is not set', () => {
    seedAdminUser();
    const user = getUser('admin');
    expect(user).toBeDefined();
    // The stored hash must verify against the default password.
    expect(bcrypt.compareSync('changeme', user!.password_hash)).toBe(true);
  });

  it('uses ADMIN_USERNAME env var when set', () => {
    process.env['ADMIN_USERNAME'] = 'superadmin';
    process.env['ADMIN_PASSWORD'] = 'securepassword';
    seedAdminUser();
    const user = getUser('superadmin');
    expect(user).toBeDefined();
    expect(user!.username).toBe('superadmin');
  });

  it('uses ADMIN_PASSWORD env var when set', () => {
    process.env['ADMIN_USERNAME'] = 'admin';
    process.env['ADMIN_PASSWORD'] = 'my-secure-password-123';
    seedAdminUser();
    const user = getUser('admin');
    expect(user).toBeDefined();
    expect(bcrypt.compareSync('my-secure-password-123', user!.password_hash)).toBe(true);
  });

  it('stores a bcrypt hash — not the plaintext password', () => {
    process.env['ADMIN_PASSWORD'] = 'plaintext-test';
    seedAdminUser();
    const user = getUser('admin');
    expect(user).toBeDefined();
    // Must NOT be the plaintext value.
    expect(user!.password_hash).not.toBe('plaintext-test');
    // Must look like a bcrypt hash.
    expect(user!.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('produces a hash that is verifiable by bcrypt.compareSync', () => {
    process.env['ADMIN_PASSWORD'] = 'verify-me';
    seedAdminUser();
    const user = getUser('admin');
    expect(user).toBeDefined();
    expect(bcrypt.compareSync('verify-me', user!.password_hash)).toBe(true);
    expect(bcrypt.compareSync('wrong-password', user!.password_hash)).toBe(false);
  });

  it('emits a console.warn when the default password "changeme" is used', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedAdminUser();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('changeme');
    warnSpy.mockRestore();
  });

  it('does NOT emit a console.warn when a non-default password is set', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env['ADMIN_PASSWORD'] = 'a-real-password';
    seedAdminUser();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe('seedAdminUser() — idempotency (users table already has rows)', () => {
  beforeEach(() => {
    clearDatabase();
    // Pre-populate the table with one user so seedAdminUser() should no-op.
    const hash = bcrypt.hashSync('existing-pass', 4);
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
      'existing-user',
      hash,
    );
  });

  it('does NOT insert a second row when a user already exists', () => {
    expect(countUsers()).toBe(1);
    seedAdminUser();
    expect(countUsers()).toBe(1);
  });

  it('does NOT overwrite the existing user', () => {
    seedAdminUser();
    const user = getUser('existing-user');
    expect(user).toBeDefined();
    // The original hash must still be valid.
    expect(bcrypt.compareSync('existing-pass', user!.password_hash)).toBe(true);
  });

  it('does NOT insert the admin user when another user is present', () => {
    seedAdminUser();
    // 'admin' must not have been inserted.
    const adminUser = getUser('admin');
    expect(adminUser).toBeUndefined();
  });

  it('is safe to call multiple times — row count stays at 1', () => {
    seedAdminUser();
    seedAdminUser();
    seedAdminUser();
    expect(countUsers()).toBe(1);
  });
});
