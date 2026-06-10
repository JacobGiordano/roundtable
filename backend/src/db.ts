/**
 * db.ts — SQLite database setup and schema migrations.
 *
 * Uses better-sqlite3 (synchronous SQLite bindings for Node.js).
 * The database path is read from the DATABASE_PATH environment variable.
 * On first startup, if the users table is empty, the admin user is seeded
 * from ADMIN_USERNAME + ADMIN_PASSWORD environment variables.
 */

import DatabaseConstructor, { Database } from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const DATABASE_PATH = process.env.DATABASE_PATH ?? './roundtable.db';

// Resolve relative paths from the working directory.
const resolvedPath = path.resolve(process.cwd(), DATABASE_PATH);

export const db: Database = new DatabaseConstructor(resolvedPath);

// Enable WAL mode for better concurrent read performance.
db.pragma('journal_mode = WAL');
// Enforce foreign keys.
db.pragma('foreign_keys = ON');

// ─── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id         TEXT    PRIMARY KEY,
    data       TEXT    NOT NULL,
    archived   INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password_hash TEXT    NOT NULL
  );
`);

// ─── Admin user seed ──────────────────────────────────────────────────────────

/**
 * Seed the admin user if the users table is empty.
 * Called once at startup. After the first run this is a no-op.
 */
export function seedAdminUser(): void {
  const count = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (count > 0) return;

  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? 'changeme';

  if (password === 'changeme') {
    console.warn(
      '[db] WARNING: using default admin password "changeme". ' +
      'Set ADMIN_PASSWORD in your .env before exposing this server.'
    );
  }

  const saltRounds = 12;
  const passwordHash = bcrypt.hashSync(password, saltRounds);

  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    username,
    passwordHash
  );

  console.log(`[db] Admin user "${username}" created.`);
}
