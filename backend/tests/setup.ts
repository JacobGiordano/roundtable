/**
 * tests/setup.ts — Global test setup for the Roundtable backend test suite.
 *
 * This file is loaded by Vitest before any test file is imported (via setupFiles
 * in vitest.config.ts). It sets environment variables that the application reads
 * at module load time — setting them here ensures the app modules initialize
 * correctly without needing a real .env file on disk.
 *
 * DATABASE ISOLATION:
 *   db.ts runs path.resolve(cwd, DATABASE_PATH) before opening the file, which
 *   means ':memory:' is treated as a literal filename, not the SQLite in-memory
 *   sentinel. To work around this without modifying db.ts, we create a unique
 *   temp file per worker process (Vitest uses pool:'forks', so each test file
 *   runs in its own OS process). Using process.pid guarantees no two workers
 *   share a file.
 *
 *   The temp file is created at /tmp/roundtable-test-<pid>.db.
 *   It will persist until the OS clears /tmp, which is acceptable for test
 *   artifacts.
 *
 * IMPORTANT: This file must be the first thing Vitest loads before any
 * application module imports, because db.ts reads DATABASE_PATH at module
 * initialization time.
 */

import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Must be set before any import of db.ts, auth.ts, conversations.ts, or export.ts.
process.env['JWT_SECRET'] = 'test-jwt-secret-not-for-production';

// Use a unique absolute path per worker process to avoid cross-worker collisions.
// path.resolve() in db.ts will pass this through unchanged since it is already absolute.
const testDbPath = join(tmpdir(), `roundtable-test-${process.pid}.db`);

// Ensure /tmp exists (it always does on Linux/macOS, but be defensive).
try {
  mkdirSync(tmpdir(), { recursive: true });
} catch {
  // already exists — ignore
}

process.env['DATABASE_PATH'] = testDbPath;
