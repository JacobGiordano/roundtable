/**
 * tests/setup.ts — Global test setup for the Roundtable backend test suite.
 *
 * This file is loaded by Vitest before any test file is imported (via setupFiles
 * in vitest.config.ts). It sets environment variables that the application reads
 * at module load time — setting them here ensures the app modules initialize
 * correctly without needing a real .env file on disk.
 *
 * DATABASE ISOLATION:
 *   db.ts detects ':memory:' and passes it directly to better-sqlite3 without
 *   going through path.resolve(), so each Vitest worker (pool: 'forks') gets a
 *   true SQLite in-memory database that is destroyed when the process exits.
 *   No temp files are created on disk.
 *
 * IMPORTANT: This file must be the first thing Vitest loads before any
 * application module imports, because db.ts reads DATABASE_PATH at module
 * initialization time.
 */

// Must be set before any import of db.ts, auth.ts, conversations.ts, or export.ts.
process.env['JWT_SECRET'] = 'test-jwt-secret-not-for-production';
process.env['DATABASE_PATH'] = ':memory:';
