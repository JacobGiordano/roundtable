/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import type { Plugin } from 'vite';

// Generic dev-only forward proxy.
//
// Path format: /dev-proxy/<full-url>
// Example:     /dev-proxy/https://some-api.com/v1/chat/completions
//
// The middleware strips the /dev-proxy/ prefix and forwards the request to the
// full URL through Vite's Node.js process. Because iptables in the dev container
// only restricts browser-originated traffic, the Node.js process can reach
// arbitrary external endpoints without a firewall change.
//
// Zero prod surface area — configureServer is only called by the Vite dev server,
// never by the production build pipeline.
//
// Named per-provider proxies (/anthropic-proxy, /openrouter-proxy, etc.) in
// server.proxy remain for backward compatibility.
const devProxyPlugin: Plugin = {
  name: 'roundtable-dev-proxy',
  configureServer(server) {
    // Hop-by-hop headers that must not be forwarded to the upstream or back
    // to the client (RFC 7230 §6.1).
    const REQUEST_HOP_BY_HOP = new Set([
      'host',
      'connection',
      'keep-alive',
      'transfer-encoding',
      'te',
      'trailer',
      'upgrade',
      'proxy-authorization',
      'proxy-authenticate',
    ]);
    const RESPONSE_HOP_BY_HOP = new Set([
      'connection',
      'keep-alive',
      'transfer-encoding',
      'trailer',
      'upgrade',
    ]);

    server.middlewares.use('/dev-proxy', (req, res) => {
      void (async () => {
        // Handle CORS preflight — some APIs (e.g. Anthropic) send OPTIONS before POST.
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'access-control-allow-headers':
              (req.headers['access-control-request-headers'] as string) ?? '*',
            'access-control-max-age': '86400',
          });
          res.end();
          return;
        }

        // Connect strips the mount path from req.url, leaving /https://...
        // slice(1) removes the leading '/'.
        const rawTarget = req.url?.slice(1) ?? '';
        if (!rawTarget) {
          res.writeHead(400);
          res.end('dev-proxy: missing target URL');
          return;
        }

        let targetUrl: URL;
        try {
          targetUrl = new URL(rawTarget);
        } catch {
          res.writeHead(400);
          res.end('dev-proxy: invalid target URL');
          return;
        }

        if (targetUrl.protocol !== 'https:' && targetUrl.protocol !== 'http:') {
          res.writeHead(400);
          res.end('dev-proxy: only http/https targets are allowed');
          return;
        }

        // Collect the request body before forwarding.
        const body = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: Buffer) => chunks.push(chunk));
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', reject);
        });

        // Build the upstream request headers, stripping hop-by-hop entries.
        const forwardHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
          if (!REQUEST_HOP_BY_HOP.has(key.toLowerCase()) && typeof value === 'string') {
            forwardHeaders[key] = value;
          }
        }

        try {
          const upstream = await fetch(targetUrl.toString(), {
            method: req.method ?? 'GET',
            headers: forwardHeaders,
            body: body.length > 0 ? body : undefined,
            // Node 20 fetch requires duplex: 'half' when sending a body on a
            // streaming request. Not in the TS lib yet — suppress the error.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            duplex: 'half',
          });

          // Build the response headers, stripping hop-by-hop entries and
          // injecting a permissive CORS header so the browser accepts the response.
          const responseHeaders: Record<string, string> = {
            'access-control-allow-origin': '*',
          };
          upstream.headers.forEach((value, key) => {
            if (!RESPONSE_HOP_BY_HOP.has(key.toLowerCase())) {
              responseHeaders[key] = value;
            }
          });

          res.writeHead(upstream.status, responseHeaders);

          if (!upstream.body) {
            res.end();
            return;
          }

          // Stream the response body back to the browser.
          // This preserves SSE / chunked LLM streaming without buffering.
          const reader = upstream.body.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } finally {
            reader.releaseLock();
            res.end();
          }
        } catch (err) {
          if (!res.headersSent) {
            res.writeHead(502);
          }
          res.end(`dev-proxy: upstream error: ${String(err)}`);
        }
      })();
    });
  },
};

export default defineConfig({
  // base is set at build time for deployment targets:
  //   - GitHub Pages (project page): VITE_BASE=/roundtable/
  //   - Local dev (unset):           defaults to '/'
  // process.env is available here because vite.config.ts runs in Node.js at
  // build time. Do NOT use import.meta.env (that is browser-side only).
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), devProxyPlugin],
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
      // OpenAI — CORS behavior changed; browser-direct calls now fail preflight
      // in many environments. Proxy through Node.js server-side to avoid CORS.
      // VITE_OPENAI_PROXY_URL overrides this for production deployments.
      '/openai-proxy': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
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
      // OpenRouter — custom endpoint users should point to /openrouter-proxy/api/v1/chat/completions
      // instead of https://openrouter.ai/api/v1/chat/completions when running in the dev container.
      '/openrouter-proxy': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/openrouter-proxy/, ''),
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
    // Belt-and-suspenders: also exclude any .spec.ts files that land in
    // tests/a11y/keyboard/ — those are Playwright tests run via
    // playwright.a11y.config.ts, not Vitest (Playwright's test.describe() API
    // conflicts with Vitest's globals and crashes the suite).
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/backend/**', '**/.claude/worktrees/**', '**/tests/a11y/keyboard/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: { lines: 80, functions: 80, branches: 70 },
      reporter: ['text', 'lcov'],
    },
  },
});
