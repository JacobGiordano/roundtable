/**
 * anthropicProxy.ts — Server-side proxy for the Anthropic Messages API.
 *
 * Anthropic does not allow browser-direct API calls — all Origins receive a 400
 * "Disallowed CORS origin" on the OPTIONS preflight. This Express router acts as
 * a thin pass-through proxy: the browser calls this backend, which forwards the
 * request to api.anthropic.com server-side and streams the response back.
 *
 * Security notes:
 *   - The API key travels in the x-api-key header, which is passed through
 *     from the browser. This is the same key the browser would use directly —
 *     the proxy does not store, log, or modify it.
 *   - The proxy does not authenticate callers. It relies on the Anthropic API
 *     key itself as the access credential. In a multi-user deployment, add
 *     requireAuth middleware to this route.
 *   - Streams from Anthropic are piped directly to the response; no buffering.
 *
 * Mounted at: /api/proxy/anthropic
 * Usage: set VITE_ANTHROPIC_PROXY_URL=/api/proxy/anthropic in the frontend's
 * production environment so claude.ts resolves to this endpoint instead of
 * api.anthropic.com directly.
 *
 * The backend's CORS middleware (in index.ts) handles the browser preflight.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';

export const anthropicProxyRouter = Router();

// Forward all POST requests (streaming or non-streaming) to Anthropic.
// The path after /api/proxy/anthropic is preserved:
//   /api/proxy/anthropic/v1/messages → https://api.anthropic.com/v1/messages
anthropicProxyRouter.post('/*', async (req: Request, res: Response) => {
  // Reconstruct the Anthropic URL from the path suffix.
  // Express strips the router's mount prefix, so req.path starts with '/'.
  const anthropicUrl = `https://api.anthropic.com${req.path}`;

  // Forward relevant headers — pass through auth headers and API versioning.
  // Never log the x-api-key value.
  const forwardHeaders: Record<string, string> = {
    'content-type': 'application/json',
  };

  const apiKey = req.headers['x-api-key'];
  if (typeof apiKey === 'string' && apiKey.length > 0) {
    forwardHeaders['x-api-key'] = apiKey;
  }

  const anthropicVersion = req.headers['anthropic-version'];
  if (typeof anthropicVersion === 'string') {
    forwardHeaders['anthropic-version'] = anthropicVersion;
  }

  let anthropicResponse: globalThis.Response;
  try {
    anthropicResponse = await fetch(anthropicUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(req.body),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream network error';
    res.status(502).json({ error: { type: 'proxy_error', message } });
    return;
  }

  // Relay the status code and content-type from Anthropic.
  res.status(anthropicResponse.status);
  const contentType = anthropicResponse.headers.get('content-type');
  if (contentType) {
    res.setHeader('Content-Type', contentType);
  }

  if (!anthropicResponse.body) {
    res.end();
    return;
  }

  // Pipe the response body. For streaming requests (stream: true), Anthropic
  // returns text/event-stream — we pipe it directly to avoid buffering.
  const reader = anthropicResponse.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
});
