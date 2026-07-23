/**
 * Atlas — openai-sse.ts
 *
 * Shared helpers for SSE (Server-Sent Events) streaming and HTTP error
 * classification. Previously duplicated across claude.ts, gemini.ts,
 * BaseOpenAIProvider.ts, and generic.ts — extracted here as part of #133.
 *
 * Exports:
 *   parseSSEStream        — yields raw SSE data payloads from a fetch Response
 *   mapHttpStatusToErrorCode — maps HTTP status codes to ModelErrorCode values (status only)
 *   classifyHttpError     — body-aware classification; prefer over mapHttpStatusToErrorCode
 *   buildModelError       — constructs a ModelError from a code + message
 *   emitErrorChunk        — emits a priming non-done chunk then an error done chunk
 *   filterMessagesForApi  — strips error-only assistant messages from history
 *
 * The raw SSE protocol (line buffering, `data:` prefix stripping, `[DONE]`
 * sentinel handling) is identical across all provider implementations. Each
 * provider is responsible for parsing the yielded JSON strings according to
 * its own event schema.
 *
 * Security: no API keys flow through this module. Key retrieval stays in each
 * provider via getCredentials() — that boundary is not moved here.
 */

import type { Message, ModelError, ModelErrorCode, ModelId, StreamHandler } from '@/types';

// ─── Error helpers ─────────────────────────────────────────────────────────────

/**
 * Map an HTTP status code to the closest ModelErrorCode (status only, no body).
 *
 * Covers the four meaningful cases from the Roundtable error contract:
 *   401, 403  → auth_failure   (invalid or missing API key)
 *   429       → rate_limit     (too many requests)
 *   400       → context_length_exceeded (request body was rejected; most
 *               commonly a context window overflow — use classifyHttpError
 *               when the response body is available to distinguish auth
 *               failures that some providers surface as 400, e.g. xAI/Grok)
 *   anything else → unknown
 *
 * Prefer classifyHttpError when the response body is available.
 */
export function mapHttpStatusToErrorCode(status: number): ModelErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 429) return 'rate_limit';
  if (status === 400) return 'context_length_exceeded';
  return 'unknown';
}

/**
 * Keywords in a provider error message body that indicate an authentication
 * failure even when the HTTP status is 400 (as xAI/Grok does for bad API keys).
 * Matched case-insensitively against the full error message string.
 *
 * Patterns cover confirmed xAI behavior and common OpenAI-compatible formulations:
 *   - "invalid api key" / "invalid_api_key" / "invalid x-api-key"
 *   - "incorrect api key"
 *   - "no api key" / "api key not" / "api key missing"
 *   - "authentication" — catches "authentication failed", "unauthenticated", etc.
 *   - "unauthorized"   — xAI may include this in the 400 body
 *   - "api key"        — broad fallback for novel provider formulations; acceptable
 *                        because a 400 with "api key" in the message is almost
 *                        certainly an auth problem, not a context-length overflow
 */
const AUTH_ERROR_KEYWORDS = [
  'invalid api key',
  'invalid_api_key',
  'incorrect api key',
  'no api key',
  'api key not',
  'api key missing',
  'authentication',
  'unauthorized',
  'invalid x-api-key',
  'api key',
];

/**
 * Keywords in a 400 error message that signal a context-length overflow.
 * Matched case-insensitively against the error message text. Used by
 * classifyHttpError to distinguish true context-length failures from other 400
 * causes (invalid model string, malformed request, unsupported parameter) that
 * should surface as `unknown` rather than the misleading `context_length_exceeded`
 * (issue #426).
 *
 * The OpenAI structured error code 'context_length_exceeded' is checked separately
 * via the errorCode parameter — these keywords serve as a message-text fallback
 * when no structured code is available.
 */
const CONTEXT_LENGTH_KEYWORDS = [
  'too many tokens',
  'prompt is too long',
  'maximum context length',
  'context_length_exceeded',
  'max_tokens',
];

/**
 * Classify an HTTP error into a ModelErrorCode using the status code, the
 * provider error message text, and the structured error code / type from the
 * response body.
 *
 * This is the preferred function when the response body has already been read.
 * It handles two known non-standard cases:
 *   - Grok/xAI returns HTTP 400 for a bad API key (issue #544).
 *   - Unrecognized 400s (invalid model string, malformed request, unsupported
 *     parameter) previously mapped to context_length_exceeded — they now map to
 *     `unknown` unless a context-length signal is present (issue #426).
 *
 * Classification logic:
 *   401, 403                               → auth_failure
 *   429                                    → rate_limit
 *   400 + auth keywords in message         → auth_failure
 *   400 + context-length signal*           → context_length_exceeded
 *   400 (no recognized signal)             → unknown
 *   anything else                          → unknown
 *
 * * Context-length signal (any one is sufficient):
 *     - errorCode === 'context_length_exceeded' (OpenAI structured code)
 *     - errorType === 'invalid_request_error' + context-length keyword in
 *       message (Anthropic: uses invalid_request_error for all bad requests,
 *       so the message check distinguishes context overflows from other causes)
 *     - context-length keyword in message with no structured code/type present
 *       (generic fallback for OpenAI-compatible providers that omit those fields)
 *
 * @param status       - The HTTP response status code.
 * @param errorMessage - The error message string from the parsed response body
 *                       (e.g. body.error?.message). Pass undefined or empty
 *                       string when no body was readable.
 * @param errorCode    - The structured error code from the body, if present
 *                       (e.g. body.error?.code). OpenAI uses 'context_length_exceeded'.
 * @param errorType    - The structured error type from the body, if present
 *                       (e.g. body.error?.type). Anthropic uses 'invalid_request_error'.
 */
export function classifyHttpError(
  status: number,
  errorMessage: string | undefined,
  errorCode?: string,
  errorType?: string,
): ModelErrorCode {
  if (status === 401 || status === 403) return 'auth_failure';
  if (status === 429) return 'rate_limit';
  if (status === 400) {
    // Check whether the error body indicates an authentication failure.
    // xAI/Grok returns HTTP 400 for a bad API key instead of the conventional 401.
    // Inspect the lowercased message text for auth-related keywords first.
    if (errorMessage) {
      const lower = errorMessage.toLowerCase();
      if (AUTH_ERROR_KEYWORDS.some((kw) => lower.includes(kw))) {
        return 'auth_failure';
      }
    }

    // Determine whether this is a genuine context-length overflow before
    // falling back to `unknown`. Previously all unrecognized 400s were mapped
    // to `context_length_exceeded`, which is actively misleading for cases like
    // invalid model strings, malformed requests, or unsupported parameters
    // (issue #426).
    //
    // Three signals — any one is sufficient to conclude context_length_exceeded:
    //   1. OpenAI structured error code: body.error.code === 'context_length_exceeded'
    //   2. Anthropic: body.error.type === 'invalid_request_error' + context-length
    //      keyword in the message (Anthropic uses this type for all invalid requests,
    //      so the keyword check narrows it to actual context overflows)
    //   3. Generic fallback: context-length keyword in message with no structured
    //      code or type present (covers OpenAI-compatible providers that omit them)
    const messageLower = errorMessage?.toLowerCase() ?? '';
    const hasContextKeyword = CONTEXT_LENGTH_KEYWORDS.some((kw) => messageLower.includes(kw));

    if (errorCode === 'context_length_exceeded') return 'context_length_exceeded';
    if (errorType === 'invalid_request_error' && hasContextKeyword) return 'context_length_exceeded';
    if (!errorCode && !errorType && hasContextKeyword) return 'context_length_exceeded';

    return 'unknown';
  }
  return 'unknown';
}

/**
 * Construct a ModelError from a code and message string.
 * Thin wrapper — exists so call sites read as `buildModelError(code, msg)`
 * rather than `{ code, message }` literals, keeping the shape in one place.
 */
export function buildModelError(code: ModelErrorCode, message: string): ModelError {
  return { code, message, source: 'model' };
}

/**
 * Emit an error as a visible StreamChunk sequence.
 *
 * Problem: `useStreamingMessages` in Aria only creates an accumulator entry when
 * it sees a non-done chunk (isDone: false). A done chunk (isDone: true) finalizes
 * an existing entry. If the first chunk for a model is already isDone: true (which
 * is the pattern for all error paths in every provider — auth failure, HTTP error,
 * network error), `useStreamingMessages` silently drops it because there is no
 * accumulator entry to finalize. The result is complete UI silence with no error
 * shown and nothing persisted to the conversation.
 *
 * Fix: emit a non-done priming chunk (isDone: false, content: '') first so the
 * accumulator gets an entry, then emit the error done chunk (isDone: true, error).
 * The done chunk will now finalize the entry, fire onMessageComplete, and persist
 * the error message to the conversation store so the UI can render it.
 *
 * All providers must call this helper instead of directly emitting a lone
 * isDone: true error chunk.
 */
export function emitErrorChunk(modelId: ModelId, error: ModelError, onChunk: StreamHandler): void {
  // Priming non-done chunk — creates the accumulator entry in useStreamingMessages.
  onChunk({ modelId, content: '', isDone: false });
  // Done chunk with error — finalizes the entry, triggers onMessageComplete.
  onChunk({ modelId, content: '', isDone: true, error });
}

/**
 * Filter the message history before sending to an AI provider API.
 *
 * Error-only assistant messages (content: '', error: set) are produced when
 * a previous API call failed. These messages have no useful content and must not
 * be forwarded to the provider because:
 *
 *   1. Anthropic, OpenAI, and Gemini APIs reject requests that contain assistant
 *      messages with empty content, returning a 400 error. Forwarding them would
 *      silently break all subsequent sends in a conversation.
 *   2. The content of an error message is not a real model response — it carries
 *      no semantic value for the next turn's context.
 *
 * Filter rule: skip assistant messages where msg.error is set AND msg.content is
 * empty or whitespace-only. Assistant messages with real content (e.g. a partial
 * response before a rate-limit error) are preserved — the content is meaningful
 * context even if the response was cut short.
 *
 * The companion user message that prompted the failed assistant reply is also
 * preserved: it is a legitimate part of the conversation context.
 */
export function filterMessagesForApi(messages: Message[]): Message[] {
  return messages.filter((msg) => {
    // Always include user messages.
    if (msg.role !== 'assistant') return true;
    // Exclude assistant messages that are error-only (no real content).
    if (msg.error && !msg.content.trim()) return false;
    return true;
  });
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
