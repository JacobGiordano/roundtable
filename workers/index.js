/**
 * Roundtable API Proxy — Cloudflare Workers
 *
 * Routes Roundtable provider API calls to their respective upstream endpoints.
 * Handles CORS preflight and injects Access-Control-Allow-Origin: * on all
 * forwarded responses so browser clients on any origin can reach the APIs.
 *
 * Deploy:    wrangler deploy
 * Local dev: wrangler dev
 *
 * ─── SECURITY NOTE ─────────────────────────────────────────────────────────────
 * This script does NOT log headers or body content. Logging request headers would
 * expose API keys (e.g. Authorization, x-api-key). Logging response bodies would
 * expose private conversation content. No console.log, wrangler bindings, or any
 * other mechanism in this file reads or records header values or body data.
 * ───────────────────────────────────────────────────────────────────────────────
 *
 * Route table — URL prefix → upstream base URL:
 *   /anthropic  →  https://api.anthropic.com
 *   /openai     →  https://api.openai.com
 *   /gemini     →  https://generativelanguage.googleapis.com
 *   /grok       →  https://api.x.ai
 *   /deepseek   →  https://api.deepseek.com
 *   /mistral    →  https://api.mistral.ai
 *
 * Streaming: upstream.body is passed directly to the Response constructor —
 * the response body is never buffered. This is critical for LLM SSE streaming
 * where the client must receive tokens as they are generated.
 */

// Route table: [urlPrefix, upstreamBase]
// Order matters — prefixes are matched left-to-right on the full pathname.
const ROUTES = [
  ['/anthropic', 'https://api.anthropic.com'],
  ['/openai',    'https://api.openai.com'],
  ['/gemini',    'https://generativelanguage.googleapis.com'],
  ['/grok',      'https://api.x.ai'],
  ['/deepseek',  'https://api.deepseek.com'],
  ['/mistral',   'https://api.mistral.ai'],
];

// CORS headers applied to every response (preflight and forwarded).
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
};

export default {
  /**
   * @param {Request} request
   * @param {unknown} env
   * @param {ExecutionContext} ctx
   * @returns {Response}
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // ── CORS preflight ──────────────────────────────────────────────────────
    // Respond immediately to OPTIONS without forwarding to the upstream.
    // Browsers send a preflight before POST/PATCH/PUT with custom headers
    // (e.g. Authorization, x-api-key, anthropic-version).
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // ── Route matching ──────────────────────────────────────────────────────
    for (const [prefix, upstreamBase] of ROUTES) {
      // Match exact prefix (e.g. "/anthropic") or prefix + "/" (e.g. "/anthropic/v1/...").
      if (url.pathname === prefix || url.pathname.startsWith(prefix + '/')) {
        // Strip the route prefix to get the upstream path.
        // e.g. /anthropic/v1/messages → /v1/messages
        const upstreamPath = url.pathname.slice(prefix.length) || '/';
        // Preserve the full query string (e.g. ?key=... for Gemini, ?alt=sse).
        const upstreamUrl = `${upstreamBase}${upstreamPath}${url.search}`;

        // Forward all request headers to the upstream unchanged.
        // This includes Authorization, x-api-key, Content-Type,
        // anthropic-version, and any other provider-specific headers.
        // SECURITY: Do not log or inspect header values — they include API keys.
        const upstreamRequest = new Request(upstreamUrl, {
          method: request.method,
          headers: request.headers,
          body: request.body,
        });

        const upstreamResponse = await fetch(upstreamRequest);

        // Copy all upstream response headers, then set the CORS header.
        // Do not log or inspect response headers or body.
        const responseHeaders = new Headers(upstreamResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        // Pass upstream.body directly — never buffer.
        // Buffering would break SSE streaming and cause the client to wait
        // for the entire LLM response before rendering any tokens.
        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      }
    }

    // ── Unrecognized route ──────────────────────────────────────────────────
    return new Response(
      'Unknown provider route. Valid prefixes: /anthropic, /openai, /gemini, /grok, /deepseek, /mistral',
      {
        status: 400,
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*',
        },
      },
    );
  },
};
