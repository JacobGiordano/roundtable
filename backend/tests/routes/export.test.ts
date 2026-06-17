/**
 * tests/routes/export.test.ts — Export route tests.
 *
 * Covers:
 *   GET /conversations/:id/export?format=json
 *   GET /conversations/:id/export?format=markdown
 *   GET /conversations/:id/export?format=html
 *
 * Validates:
 *   - All three formats return the ExportedConversation shape { content, filename, mimeType }
 *   - content is non-empty and parseable for the appropriate format
 *   - filename has the correct extension for each format
 *   - mimeType matches the format
 *   - 400 on missing or unsupported format
 *   - 404 on unknown conversation id
 *   - 401 with no token
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, clearDatabase } from '../helpers/createTestApp';
import { insertUser, loginAs, makeConversationWithMessages } from '../helpers/fixtures';
import type { Conversation, ExportedConversation } from '../../src/types';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /conversations/:id/export — auth enforcement', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await app.request.get('/conversations/any-id/export?format=json');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.request
      .get('/conversations/any-id/export?format=json')
      .set('Authorization', 'Bearer bad-token');
    expect(res.status).toBe(401);
  });
});

describe('GET /conversations/:id/export — format validation', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');

    // Seed a conversation to export.
    const conv = makeConversationWithMessages();
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
  });

  it('returns 400 when format query param is missing', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_format');
  });

  it('returns 400 when format is unsupported', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=pdf')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_format');
  });

  it('returns 400 when format is empty string', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_format');
  });
});

describe('GET /conversations/:id/export — 404 on missing conversation', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 404 when conversation does not exist', async () => {
    const res = await app.request
      .get('/conversations/does-not-exist/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

describe('GET /conversations/:id/export?format=json', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');

    const conv = makeConversationWithMessages();
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
  });

  it('returns 200 with ExportedConversation shape', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const body = res.body as ExportedConversation;
    expect(typeof body.content).toBe('string');
    expect(typeof body.filename).toBe('string');
    expect(typeof body.mimeType).toBe('string');
  });

  it('content is valid JSON that parses to a Conversation object', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=json')
      .set('Authorization', `Bearer ${token}`);

    const body = res.body as ExportedConversation;
    const parsed = JSON.parse(body.content) as Conversation;
    expect(parsed.id).toBe('export-conv-1');
    expect(parsed.title).toBe('My Test Conversation');
  });

  it('filename has .json extension', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).filename).toMatch(/\.json$/);
  });

  it('mimeType is application/json', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=json')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).mimeType).toContain('application/json');
  });
});

describe('GET /conversations/:id/export?format=markdown', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');

    const conv = makeConversationWithMessages();
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
  });

  it('returns 200 with ExportedConversation shape', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=markdown')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const body = res.body as ExportedConversation;
    expect(typeof body.content).toBe('string');
    expect(body.content.length).toBeGreaterThan(0);
  });

  it('content includes the conversation title as an H1 heading', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=markdown')
      .set('Authorization', `Bearer ${token}`);
    const body = res.body as ExportedConversation;
    expect(body.content).toContain('# My Test Conversation');
  });

  it('content includes message content', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=markdown')
      .set('Authorization', `Bearer ${token}`);
    const body = res.body as ExportedConversation;
    expect(body.content).toContain('Hello world');
    expect(body.content).toContain('Hi there!');
  });

  it('filename has .md extension', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=markdown')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).filename).toMatch(/\.md$/);
  });

  it('mimeType is text/markdown', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=markdown')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).mimeType).toContain('text/markdown');
  });
});

describe('GET /conversations/:id/export?format=html', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');

    const conv = makeConversationWithMessages();
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
  });

  it('returns 200 with ExportedConversation shape', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=html')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const body = res.body as ExportedConversation;
    expect(typeof body.content).toBe('string');
    expect(body.content.length).toBeGreaterThan(0);
  });

  it('content starts with <!DOCTYPE html> and contains a <title> tag', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=html')
      .set('Authorization', `Bearer ${token}`);
    const body = res.body as ExportedConversation;
    expect(body.content).toContain('<!DOCTYPE html>');
    expect(body.content).toContain('<title>');
  });

  it('content contains the conversation title in the <title> tag', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=html')
      .set('Authorization', `Bearer ${token}`);
    const body = res.body as ExportedConversation;
    expect(body.content).toContain('My Test Conversation');
  });

  it('filename has .html extension', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=html')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).filename).toMatch(/\.html$/);
  });

  it('mimeType is text/html', async () => {
    const res = await app.request
      .get('/conversations/export-conv-1/export?format=html')
      .set('Authorization', `Bearer ${token}`);
    expect((res.body as ExportedConversation).mimeType).toContain('text/html');
  });

  it('HTML-escapes special characters in title to prevent XSS', async () => {
    clearDatabase();
    // Re-create app with a title containing HTML special chars.
    const app2 = createTestApp();
    insertUser(app2.db, 'bob', 'pw-bob');
    const tok2 = await loginAs(app2.request, 'bob', 'pw-bob');

    const xssConv = makeConversationWithMessages({
      id: 'xss-conv',
      title: '<script>alert("xss")</script>',
    });
    await app2.request
      .put(`/conversations/${xssConv.id}`)
      .set('Authorization', `Bearer ${tok2}`)
      .send(xssConv);

    const res = await app2.request
      .get(`/conversations/${xssConv.id}/export?format=html`)
      .set('Authorization', `Bearer ${tok2}`);
    const body = res.body as ExportedConversation;

    // The raw <script> tag must NOT appear verbatim in the HTML output.
    expect(body.content).not.toContain('<script>alert("xss")</script>');
    // The escaped version should appear instead.
    expect(body.content).toContain('&lt;script&gt;');
  });
});
