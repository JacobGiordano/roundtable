/**
 * Regression: error-sentinel filtering parity — issue #344
 *
 * Guards that filterMessagesForApi (openai-sse.ts) and buildAttributedMessages
 * (attribution.ts) use the exact same predicate to exclude error-sentinel messages
 * from the history sent to an AI provider API.
 *
 * Prior bug: buildAttributedMessages stripped only messages with content === 'Error'
 * (a literal string match), while filterMessagesForApi stripped messages where
 * error is set AND content is empty/whitespace-only. The predicates were inconsistent:
 *   - content:'' messages were excluded by filterMessagesForApi but NOT by
 *     buildAttributedMessages (the real failure mode — emitErrorChunk writes content:'')
 *   - content:'Error' messages were excluded by buildAttributedMessages but NOT by
 *     filterMessagesForApi (incorrect exclusion — 'Error' is non-empty content)
 *
 * Fix: both functions now use `msg.error && !msg.content.trim()`.
 *
 * Test coverage:
 *   1. Error sentinel with content:'' — excluded by both filter paths
 *   2. Error sentinel with content:'Error' (old pattern) — preserved by both paths
 *      since 'Error' is non-empty content (not a UI-only sentinel in the new model)
 *   3. Partial response with error set and real content — preserved by both paths
 *   4. Normal assistant messages (no error) — always preserved
 *   5. User messages — always preserved regardless of error field
 */

import { describe, it, expect } from 'vitest';
import { filterMessagesForApi } from '@/models/openai-sse';
import { buildAttributedMessages } from '@/models/attribution';
import type { Message, ModelError } from '@/types/index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SENTINEL_ERROR: ModelError = { code: 'auth_failure', message: 'Auth failed', source: 'model' };

/** Error sentinel as emitErrorChunk writes it — empty content, error set. */
const makeErrorSentinelEmpty = (modelId = 'claude'): Message => ({
  id: 'msg-error-empty',
  role: 'assistant',
  content: '',
  modelId,
  timestamp: 1000,
  error: SENTINEL_ERROR,
});

/** Error sentinel with whitespace-only content — should also be excluded. */
const makeErrorSentinelWhitespace = (modelId = 'claude'): Message => ({
  id: 'msg-error-ws',
  role: 'assistant',
  content: '   ',
  modelId,
  timestamp: 1001,
  error: SENTINEL_ERROR,
});

/** Old-pattern error sentinel with content:'Error' — has non-empty content, should be PRESERVED. */
const makeErrorSentinelLegacy = (modelId = 'claude'): Message => ({
  id: 'msg-error-legacy',
  role: 'assistant',
  content: 'Error',
  modelId,
  timestamp: 1002,
  error: SENTINEL_ERROR,
});

/** Partial response — error set but real content present — must be PRESERVED. */
const makePartialWithError = (modelId = 'claude'): Message => ({
  id: 'msg-partial',
  role: 'assistant',
  content: 'Partial response before rate limit hit',
  modelId,
  timestamp: 1003,
  error: { code: 'rate_limit', message: 'Rate limited', source: 'model' },
});

/** Normal assistant message — no error, always preserved. */
const makeNormalAssistant = (modelId = 'claude'): Message => ({
  id: 'msg-normal',
  role: 'assistant',
  content: 'Normal response text',
  modelId,
  timestamp: 1004,
});

/** User message — always preserved regardless of any fields. */
const makeUserMsg = (): Message => ({
  id: 'msg-user',
  role: 'user',
  content: 'User prompt',
  timestamp: 1005,
});

// Model roster for buildAttributedMessages
const MODELS = [
  { modelId: 'claude', name: 'Claude', color: 'violet', isActive: true },
  { modelId: 'gpt-5.5', name: 'GPT', color: 'emerald', isActive: true },
];

// ─── Helper: run buildAttributedMessages and extract the model IDs that survive ─

function attributedIds(messages: Message[]): string[] {
  return buildAttributedMessages(messages, 'claude', MODELS).map((m) => m.id);
}

function filteredIds(messages: Message[]): string[] {
  return filterMessagesForApi(messages).map((m) => m.id);
}

// ─── 1. Error sentinel with content:'' — excluded by BOTH paths ───────────────

describe('error sentinel — content:"" is excluded by both filter paths', () => {
  it('filterMessagesForApi strips an assistant error message with empty content', () => {
    const sentinel = makeErrorSentinelEmpty();
    const result = filterMessagesForApi([sentinel]);
    expect(result).toHaveLength(0);
  });

  it('buildAttributedMessages strips an assistant error message with empty content', () => {
    const sentinel = makeErrorSentinelEmpty();
    const result = buildAttributedMessages([sentinel], 'claude', MODELS);
    expect(result).toHaveLength(0);
  });

  it('both paths agree: error sentinel with content:"" is excluded', () => {
    const sentinel = makeErrorSentinelEmpty();
    const msgs = [makeUserMsg(), sentinel, makeNormalAssistant()];
    const filterResult = filteredIds(msgs);
    const attrResult = attributedIds(msgs);
    // Both must exclude the sentinel
    expect(filterResult).not.toContain(sentinel.id);
    expect(attrResult).not.toContain(sentinel.id);
    // Both must agree on which IDs survive
    expect(filterResult).toEqual(attrResult);
  });

  it('both paths strip whitespace-only content error sentinels', () => {
    const sentinel = makeErrorSentinelWhitespace();
    const msgs = [makeUserMsg(), sentinel, makeNormalAssistant()];
    const filterResult = filteredIds(msgs);
    const attrResult = attributedIds(msgs);
    expect(filterResult).not.toContain(sentinel.id);
    expect(attrResult).not.toContain(sentinel.id);
    expect(filterResult).toEqual(attrResult);
  });
});

// ─── 2. Partial response with error and real content — preserved by BOTH paths ─

describe('partial response — error set with real content is preserved by both filter paths', () => {
  it('filterMessagesForApi preserves a partial response with error and real content', () => {
    const partial = makePartialWithError();
    const result = filterMessagesForApi([partial]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(partial.id);
  });

  it('buildAttributedMessages preserves a partial response with error and real content', () => {
    const partial = makePartialWithError();
    const result = buildAttributedMessages([partial], 'claude', MODELS);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(partial.id);
  });

  it('both paths agree: partial response with error and real content survives', () => {
    const partial = makePartialWithError();
    const msgs = [makeUserMsg(), partial];
    const filterResult = filteredIds(msgs);
    const attrResult = attributedIds(msgs);
    expect(filterResult).toContain(partial.id);
    expect(attrResult).toContain(partial.id);
    expect(filterResult).toEqual(attrResult);
  });

  it('both paths preserve content:"Error" (non-empty string) — legacy pattern is now kept', () => {
    // Pre-fix: buildAttributedMessages incorrectly stripped content:'Error'.
    // Post-fix: both paths treat 'Error' as non-empty content and preserve the message.
    const legacy = makeErrorSentinelLegacy();
    const filterResult = filterMessagesForApi([legacy]);
    const attrResult = buildAttributedMessages([legacy], 'claude', MODELS);
    // Both must PRESERVE it — 'Error' is non-empty real content
    expect(filterResult).toHaveLength(1);
    expect(attrResult).toHaveLength(1);
  });
});

// ─── 3. Normal messages — always preserved ────────────────────────────────────

describe('non-error messages — always preserved by both paths', () => {
  it('both paths preserve a normal assistant message with no error', () => {
    const normal = makeNormalAssistant();
    const filterResult = filterMessagesForApi([normal]);
    const attrResult = buildAttributedMessages([normal], 'claude', MODELS);
    expect(filterResult).toHaveLength(1);
    expect(attrResult).toHaveLength(1);
  });

  it('both paths preserve user messages regardless of content', () => {
    const user = makeUserMsg();
    const filterResult = filterMessagesForApi([user]);
    const attrResult = buildAttributedMessages([user], 'claude', MODELS);
    expect(filterResult).toHaveLength(1);
    expect(attrResult).toHaveLength(1);
  });

  it('mixed history: error sentinels stripped, real messages preserved — both paths agree', () => {
    const user = makeUserMsg();
    const sentinel = makeErrorSentinelEmpty();
    const partial = makePartialWithError();
    const normal = makeNormalAssistant();
    const msgs = [user, sentinel, partial, normal];

    const filterResult = filteredIds(msgs);
    const attrResult = attributedIds(msgs);

    // Sentinel excluded from both
    expect(filterResult).not.toContain(sentinel.id);
    expect(attrResult).not.toContain(sentinel.id);

    // Real content messages present in both
    expect(filterResult).toContain(user.id);
    expect(filterResult).toContain(partial.id);
    expect(filterResult).toContain(normal.id);
    expect(attrResult).toContain(user.id);
    expect(attrResult).toContain(partial.id);
    expect(attrResult).toContain(normal.id);

    // Both must agree on the survivor set
    expect(filterResult).toEqual(attrResult);
  });
});
