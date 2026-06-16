/**
 * Atlas — openai-sse.ts
 *
 * Shared helpers for SSE (Server-Sent Events) streaming and HTTP error
 * classification. Previously duplicated across claude.ts, gemini.ts,
 * BaseOpenAIProvider.ts, and generic.ts — extracted here as part of #133.
 *
 * Exports:
 *   parseSSEStream   — yields raw SSE data payloads from a fetch Response
 *   mapHttpStatusToErrorCode — maps HTTP status codes to ModelErrorCode values
 *   buildModelError  — constructs a ModelError from a code + message
 *
 * The raw SSE protocol (line buffering, `data:` prefix stripping, `[DONE]`
 * sentinel handling) is identical across all provider implementations. Each
 * provider is responsible for parsing the yielded JSON strings according to
 * its own event schema.
 *
 * Security: no API keys flow through this module. Key retrieval stays in each
 * provider via getCredentials() — that boundary is not moved here.
 */

import type { ModelError, ModelErrorCode } from '@/types';

// ─── Error helpers ─────────────────────────────────────────────────────────────

/**
 * Map an HTTP status code to the closest ModelErrorCode.
 *
 * Covers the four meaningful cases from the Roundtable error contract:
 *   401, 403  → auth_failure   (invalid or missing API key)
 *   429       → rate_limit     (too many requests)
 *   400       → context_length_exceeded (request body was rejected; most
 *               commonly a context window overflow, but also covers other
 *               malformed-request cases — the cleanest single-code mapping
 *               we can make without reading the response body)
 *   anything else → unknown
 */
export function mapHttpStatusToErrorCode(status: number): ModelErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 429) return 'rate_limit';
  if (status === 400) return 'context_length_exceeded';
  return 'unknown';
}

/**
 * Construct a ModelError from a code and message string.
 * Thin wrapper — exists so call sites read as `buildModelError(code, msg)`
 * rather than `{ code, message }` literals, keeping the shape in one place.
 */
export function buildModelError(code: ModelErrorCode, message: string): ModelError {
  return { code, message };
}

// ─── SSE stream parser ─────────────────────────────────────────────────────────

/**
 * Parse a streaming fetch Response body as Server-Sent Events and yield the
 * raw data payload of each `data:` line.
 *
 * Behaviour:
 *   - Reads the response body incrementally via a ReadableStreamDefaultReader.
 *   - Buffers partial lines across chunk boundaries.
 *   - Skips lines that do not start with `data: `.
 *   - Skips the `[DONE]` sentinel line (common in OpenAI-compatible APIs).
 *   - Yields the trimmed string after the `data: ` prefix.
 *   - Each provider parses the yielded string as its own JSON schema.
 *
 * Throws:
 *   - Propagates any error thrown by `reader.read()` — callers should wrap
 *     the iteration in try/finally and call `reader.releaseLock()`.
 *   - Throws a TypeError if `response.body` is null (i.e. the response has no
 *     readable body). Callers should guard with `if (!response.body)` before
 *     iterating if they want explicit control over that error path.
 *
 * Usage:
 *   ```ts
 *   for await (const payload of parseSSEStream(response)) {
 *     // payload is the raw string after "data: "
 *     const event = JSON.parse(payload) as MyEventType;
 *     // ... handle event ...
 *   }
 *   ```
 */
export async function* parseSSEStream(response: Response): AsyncIterable<string> {
  if (!response.body) {
    throw new TypeError('Response body is not readable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // Keep the last (potentially incomplete) line in the buffer.
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        // Skip the [DONE] sentinel and empty payloads.
        if (!data || data === '[DONE]') continue;
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
