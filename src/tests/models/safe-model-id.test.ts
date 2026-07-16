/**
 * Tests for SAFE_MODEL_ID validation — closes #475
 *
 * SAFE_MODEL_ID is a module-private regex in src/models/catalog.ts that gates
 * all model IDs received from external sources (OpenRouter, models.json, etc.)
 * before they are included in catalog entries. This prevents path-traversal
 * characters from propagating into provider request URLs (issue #387).
 *
 * Regex (from HANDOFF.md and catalog.ts source):
 *   /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/
 *
 * Rules:
 *   - Must start with alphanumeric (no path separator as first char)
 *   - Remaining chars: alphanumeric + . _ : - only
 *   - Total length: 1–128 characters (first char + 0–127 more)
 *
 * Since SAFE_MODEL_ID is not exported, these tests exercise it through
 * fetchRemoteCatalog(), which filters invalid IDs before building catalog entries.
 * A valid ID appears in the returned array; an invalid one is silently dropped.
 *
 * Source: src/models/catalog.ts (Atlas owns)
 * This test file lives in src/tests/models/ (Scout owns — read-only)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRemoteCatalog } from '@/models/catalog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a fetchRemoteCatalog-compatible fetch mock that returns a single entry
 * array containing a model with the given id. Returns the catalog entries —
 * the id is present if SAFE_MODEL_ID accepted it, absent if rejected.
 */
async function catalogAccepts(modelId: string): Promise<boolean> {
  const payload = [{ id: modelId, displayName: 'Test Model' }];
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(payload),
  }) as unknown as typeof fetch;

  const entries = await fetchRemoteCatalog('https://example.com/models.json');
  return entries.some((e) => e.id === modelId);
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Valid IDs ─────────────────────────────────────────────────────────────────

describe('SAFE_MODEL_ID — valid IDs are accepted', () => {
  it('accepts a typical hyphenated model ID (claude-sonnet-4-6)', async () => {
    expect(await catalogAccepts('claude-sonnet-4-6')).toBe(true);
  });

  it('accepts a model ID with dots (gpt-4.1)', async () => {
    expect(await catalogAccepts('gpt-4.1')).toBe(true);
  });

  it('accepts a model ID with colons (anthropic:claude)', async () => {
    expect(await catalogAccepts('anthropic:claude')).toBe(true);
  });

  it('accepts a model ID with underscores (gemini_pro)', async () => {
    expect(await catalogAccepts('gemini_pro')).toBe(true);
  });

  it('accepts a single alphanumeric character (minimum valid length)', async () => {
    expect(await catalogAccepts('a')).toBe(true);
  });

  it('accepts a model ID with mixed allowed chars (gpt-4.1:turbo_2024)', async () => {
    expect(await catalogAccepts('gpt-4.1:turbo_2024')).toBe(true);
  });

  it('accepts a model ID exactly 128 characters long (maximum valid length)', async () => {
    // First char: 'a'; remaining 127 chars: all alphanumeric.
    const maxLength = 'a' + 'b'.repeat(127);
    expect(maxLength.length).toBe(128);
    expect(await catalogAccepts(maxLength)).toBe(true);
  });
});

// ─── Invalid IDs ──────────────────────────────────────────────────────────────

describe('SAFE_MODEL_ID — invalid IDs are rejected', () => {
  it('rejects an empty string', async () => {
    expect(await catalogAccepts('')).toBe(false);
  });

  it('rejects an ID with a leading hyphen (-bad)', async () => {
    // Leading hyphen is a common path-traversal prefix candidate.
    expect(await catalogAccepts('-bad')).toBe(false);
  });

  it('rejects an ID with a leading dot (.hidden)', async () => {
    expect(await catalogAccepts('.hidden')).toBe(false);
  });

  it('rejects an ID containing a space (has space)', async () => {
    expect(await catalogAccepts('has space')).toBe(false);
  });

  it('rejects an ID containing a forward slash (path/model)', async () => {
    // Slashes are the primary path-traversal character — must be rejected.
    expect(await catalogAccepts('path/model')).toBe(false);
  });

  it('rejects an ID containing a backslash (path\\\\model)', async () => {
    expect(await catalogAccepts('path\\model')).toBe(false);
  });

  it('rejects an ID containing angle brackets (<script>)', async () => {
    // Angle brackets are XSS vectors — must be rejected.
    expect(await catalogAccepts('<script>')).toBe(false);
  });

  it('rejects an ID longer than 128 characters', async () => {
    // 129 chars: 'a' + 128 more alphanumeric chars.
    const tooLong = 'a' + 'b'.repeat(128);
    expect(tooLong.length).toBe(129);
    expect(await catalogAccepts(tooLong)).toBe(false);
  });

  it('rejects an ID containing a null byte', async () => {
    expect(await catalogAccepts('model\x00id')).toBe(false);
  });

  it('rejects an ID containing a question mark (query?param)', async () => {
    expect(await catalogAccepts('query?param')).toBe(false);
  });
});
