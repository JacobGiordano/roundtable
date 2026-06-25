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
    proxy: {
      // Anthropic does not support browser-direct API calls — all Origins receive
      // a 400 "Disallowed CORS origin" on the OPTIONS preflight. This proxy rule
      // routes browser fetches to /anthropic-proxy through Vite's Node.js server,
      // which then forwards them to api.anthropic.com server-side (no CORS issue).
      // The x-api-key, anthropic-version, and Content-Type headers pass through
      // unchanged. This proxy is active in development only — production builds
      // require a backend proxy (see /backend) or the VITE_ANTHROPIC_PROXY_URL
      // environment variable.
      '/anthropic-proxy': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/anthropic-proxy/, ''),
        secure: true,
      },
      // Google Gemini API does not reliably support browser-direct calls — CORS
      // behavior on the generativelanguage.googleapis.com domain varies by
      // endpoint and key type. Proxy for consistent dev behaviour.
      '/google-proxy': {
        target: 'https://generativelanguage.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/google-proxy/, ''),
        secure: true,
      },
      // xAI (Grok) — CORS stance undocumented; proxy conservatively.
      '/xai-proxy': {
        target: 'https://api.x.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xai-proxy/, ''),
        secure: true,
      },
      // DeepSeek — CORS stance undocumented; proxy conservatively.
      '/deepseek-proxy': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/deepseek-proxy/, ''),
        secure: true,
      },
      // Mistral — CORS stance undocumented; proxy conservatively.
      '/mistral-proxy': {
        target: 'https://api.mistral.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mistral-proxy/, ''),
        secure: true,
      },
    },
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
