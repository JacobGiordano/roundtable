/**
 * tests/routes/conversations.test.ts — Conversation CRUD route tests.
 *
 * Covers:
 *   GET    /conversations           — list (all, archived filter)
 *   GET    /conversations/:id       — get one
 *   PUT    /conversations/:id       — upsert
 *   DELETE /conversations/:id       — delete (idempotent)
 *   PATCH  /conversations/:id       — archive/unarchive
 *
 * Auth enforcement:
 *   Every route requires a valid JWT. All auth-absent cases return 401.
 *
 * SINGLE-TENANT DESIGN NOTE:
 *   The backend conversations table has no userId column. Every authenticated
 *   user can read and modify every conversation. This is intentional — the backend
 *   is designed for self-hosted single-user or trusted-household deployments, not
 *   multi-tenant SaaS. The cross-user "isolation" test below documents this design
 *   explicitly: user B CAN read user A's conversation. If multi-tenancy is ever
 *   added, that test must be updated (and a userId column added to the schema).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestApp, clearDatabase } from '../helpers/createTestApp';
import { insertUser, loginAs, makeConversation } from '../helpers/fixtures';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /conversations — auth enforcement', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    clearDatabase();
    app = createTestApp();
  });

  it('returns 401 with no Authorization header', async () => {
    const res = await app.request.get('/conversations');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 with an invalid token', async () => {
    const res = await app.request
      .get('/conversations')
      .set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });
});

describe('GET /conversations — list', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 200 with an empty array when no conversations exist', async () => {
    const res = await app.request
      .get('/conversations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 200 with all conversations when conversations exist', async () => {
    const conv = makeConversation({ id: 'conv-1', title: 'First' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const res = await app.request
      .get('/conversations')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('conv-1');
  });

  it('returns only archived conversations when ?archived=true', async () => {
    // Create two conversations.
    const active = makeConversation({ id: 'active-1', title: 'Active' });
    const archived = makeConversation({ id: 'archived-1', title: 'Archived', archivedAt: Date.now() });

    await app.request
      .put(`/conversations/${active.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(active);
    await app.request
      .put(`/conversations/${archived.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(archived);

    const res = await app.request
      .get('/conversations?archived=true')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // Only the archived conversation should appear.
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe('archived-1');
  });
});

describe('GET /conversations/:id', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 200 with the full conversation when it exists', async () => {
    const conv = makeConversation({ id: 'conv-get-1' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const res = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('conv-get-1');
    expect(res.body.title).toBe('Test Conversation');
  });

  it('returns 404 for a non-existent conversation id', async () => {
    const res = await app.request
      .get('/conversations/does-not-exist')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 401 with no token', async () => {
    const res = await app.request.get('/conversations/any-id');
    expect(res.status).toBe(401);
  });
});

describe('PUT /conversations/:id — upsert', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 200 and creates a new conversation', async () => {
    const conv = makeConversation({ id: 'new-conv' });
    const res = await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Verify it is retrievable.
    const get = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe('new-conv');
  });

  it('returns 200 and updates an existing conversation (upsert)', async () => {
    const conv = makeConversation({ id: 'upsert-conv', title: 'Original' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const updated = { ...conv, title: 'Updated Title' };
    const res = await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(updated);
    expect(res.status).toBe(200);

    const get = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.body.title).toBe('Updated Title');
  });

  it('uses the URL :id param over any id field in the body', async () => {
    const conv = makeConversation({ id: 'body-id', title: 'Body id test' });
    await app.request
      .put('/conversations/url-id')
      .set('Authorization', `Bearer ${token}`)
      .send(conv); // body.id = 'body-id', URL id = 'url-id'

    // Must be retrievable by URL id.
    const get = await app.request
      .get('/conversations/url-id')
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe('url-id');
  });

  it('returns 400 when body is missing the id field', async () => {
    const res = await app.request
      .put('/conversations/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'no id field' }); // no `id` property
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('returns 400 when body is not an object', async () => {
    const res = await app.request
      .put('/conversations/some-id')
      .set('Authorization', `Bearer ${token}`)
      .send('"just a string"');
    expect(res.status).toBe(400);
  });

  it('returns 401 with no token', async () => {
    const res = await app.request
      .put('/conversations/some-id')
      .send(makeConversation());
    expect(res.status).toBe(401);
  });
});

describe('DELETE /conversations/:id', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 204 and removes an existing conversation', async () => {
    const conv = makeConversation({ id: 'to-delete' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const res = await app.request
      .delete(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);

    // Confirm it's gone.
    const get = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  it('returns 204 even when the conversation does not exist (idempotent)', async () => {
    const res = await app.request
      .delete('/conversations/never-existed')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('returns 401 with no token', async () => {
    const res = await app.request.delete('/conversations/some-id');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /conversations/:id — archive/unarchive', () => {
  let app: ReturnType<typeof createTestApp>;
  let token: string;

  beforeEach(async () => {
    clearDatabase();
    app = createTestApp();
    insertUser(app.db, 'alice', 'pw123');
    token = await loginAs(app.request, 'alice', 'pw123');
  });

  it('returns 200 and sets archivedAt when archiving', async () => {
    const conv = makeConversation({ id: 'archive-me' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const res = await app.request
      .patch(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: true });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // The retrieved conversation must have archivedAt set.
    const get = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(typeof get.body.archivedAt).toBe('number');
  });

  it('returns 200 and removes archivedAt when unarchiving', async () => {
    // Archive first.
    const conv = makeConversation({ id: 'unarchive-me' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);
    await app.request
      .patch(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: true });

    // Now unarchive.
    const res = await app.request
      .patch(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: false });
    expect(res.status).toBe(200);

    const get = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.body.archivedAt).toBeUndefined();
  });

  it('returns 404 when patching a non-existent conversation', async () => {
    const res = await app.request
      .patch('/conversations/ghost-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: true });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });

  it('returns 400 when archived is not a boolean', async () => {
    const conv = makeConversation({ id: 'patch-bad-body' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(conv);

    const res = await app.request
      .patch(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ archived: 'yes' }); // string instead of boolean
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('returns 401 with no token', async () => {
    const res = await app.request
      .patch('/conversations/some-id')
      .send({ archived: true });
    expect(res.status).toBe(401);
  });
});

describe('SINGLE-TENANT DESIGN — cross-user access is permitted by design', () => {
  /**
   * This test documents an explicit design decision: the backend has no per-user
   * data isolation. Any authenticated user can read any conversation.
   *
   * This is intentional for a self-hosted single-user deployment.
   * If multi-tenancy is ever required, this test must be CHANGED (not just
   * deleted) and a userId column must be added to the conversations table.
   * At that point, open a ticket and involve Atlas.
   */
  it('user B can read user A conversations — single-tenant, no row-level isolation', async () => {
    clearDatabase();
    const app = createTestApp();

    insertUser(app.db, 'alice', 'pw-alice');
    insertUser(app.db, 'bob', 'pw-bob');

    const aliceToken = await loginAs(app.request, 'alice', 'pw-alice');
    const bobToken = await loginAs(app.request, 'bob', 'pw-bob');

    // Alice creates a conversation.
    const conv = makeConversation({ id: 'alice-conv', title: 'Alice only' });
    await app.request
      .put(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send(conv);

    // Bob reads it — by design this returns 200, not 404 or 403.
    const res = await app.request
      .get(`/conversations/${conv.id}`)
      .set('Authorization', `Bearer ${bobToken}`);

    // INTENTIONAL: 200 here means single-tenant design is preserved.
    // If this starts returning 404 or 403, multi-tenancy has been added —
    // update this test and remove this comment.
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('alice-conv');
  });
});
