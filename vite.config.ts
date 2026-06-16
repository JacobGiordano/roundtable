/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // Exclude Playwright e2e specs and backend tests — backend has its own
    // vitest config and node_modules; running them here fails module resolution.
    // Also exclude agent worktrees — stale path references in the transform cache
    // cause loadAndTransform noise after `git worktree remove` (#123).
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/backend/**', '**/.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 70 },
      reporter: ['text', 'lcov'],
    },
  },
});
