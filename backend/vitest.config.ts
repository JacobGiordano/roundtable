/**
 * vitest.config.ts — Vitest configuration for the Roundtable backend test suite.
 *
 * Key decisions:
 * - environment: 'node'  — backend tests run in Node, not jsdom
 * - setupFiles           — sets JWT_SECRET and DATABASE_PATH before any module imports
 * - isolate: true (default) — each test file gets a fresh module registry, which means
 *   a fresh in-memory SQLite database per file
 * - pool: 'forks'        — better isolation for native modules (better-sqlite3 is a
 *   native addon; threads pool can cause issues with it)
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    pool: 'forks',
    // Each test file gets its own module registry (and therefore its own db singleton).
    isolate: true,
    // Use the test-specific tsconfig so tests/ files typecheck alongside src/.
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
});
