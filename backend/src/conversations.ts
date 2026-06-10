/**
 * conversations.ts — CRUD route handlers for conversations.
 *
 * All routes require a valid JWT (requireAuth middleware applied in index.ts).
 *
 * Endpoint map (mirrors ServerStorageProvider exactly):
 *   GET    /conversations              → list all (supports ?archived=true)
 *   GET    /conversations/:id          → get one (404 if not found)
 *   PUT    /conversations/:id          → upsert full Conversation JSON
 *   DELETE /conversations/:id          → delete (idempotent: 204 even if not found)
 *   PATCH  /conversations/:id          { archived: boolean } → archive/unarchive
 *   GET    /conversations/:id/export   → handled in export.ts
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import type { Conversation } from './types';

// ─── DB row type ──────────────────────────────────────────────────────────────

interface ConversationRow {
  id: string;
  data: string;
  archived: number;  // 0 | 1 (SQLite stores booleans as integers)
  created_at: number;
  updated_at: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a conversation row's data blob. Returns null on parse failure so the
 * list endpoint can silently omit corrupt rows (matches StorageProvider contract).
 */
function parseRow(row: ConversationRow): Conversation | null {
  try {
    return JSON.parse(row.data) as Conversation;
  } catch {
    return null;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const conversationsRouter = Router();

/**
 * GET /conversations
 * Query params:
 *   ?archived=true  — return only archived conversations
 *   (omitted)       — return all conversations, newest-first
 *
 * Corrupt rows are silently omitted.
 */
conversationsRouter.get('/', (req: Request, res: Response): void => {
  const archivedParam = req.query['archived'];
  const filterArchived = archivedParam === 'true';

  let rows: ConversationRow[];
  if (filterArchived) {
    rows = db
      .prepare('SELECT * FROM conversations WHERE archived = 1 ORDER BY updated_at DESC')
      .all() as ConversationRow[];
  } else {
    rows = db
      .prepare('SELECT * FROM conversations ORDER BY updated_at DESC')
      .all() as ConversationRow[];
  }

  const conversations = rows
    .map(parseRow)
    .filter((c): c is Conversation => c !== null);

  res.json(conversations);
});

/**
 * GET /conversations/:id
 * Returns the full Conversation JSON.
 * 404 if not found.
 */
conversationsRouter.get('/:id', (req: Request, res: Response): void => {
  const row = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(req.params['id']) as ConversationRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const conversation = parseRow(row);
  if (!conversation) {
    res.status(500).json({ error: 'parse_error', message: 'Stored conversation data is corrupt' });
    return;
  }

  res.json(conversation);
});

/**
 * PUT /conversations/:id
 * Body: full Conversation JSON.
 * Upserts (creates or replaces) the conversation. Returns 200.
 */
conversationsRouter.put('/:id', (req: Request, res: Response): void => {
  const id = req.params['id'];
  const body = req.body as Conversation;

  // Basic validation: body must be an object with an id field.
  if (!body || typeof body !== 'object' || !('id' in body)) {
    res.status(400).json({ error: 'invalid_body', message: 'Request body must be a Conversation object' });
    return;
  }

  // Prefer the URL param id over the body id to match REST conventions.
  const data = JSON.stringify({ ...body, id });
  const now = Date.now();
  const createdAt = body.createdAt ?? now;
  const updatedAt = body.updatedAt ?? now;
  const archived = body.archivedAt ? 1 : 0;

  db.prepare(`
    INSERT INTO conversations (id, data, archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data       = excluded.data,
      archived   = excluded.archived,
      updated_at = excluded.updated_at
  `).run(id, data, archived, createdAt, updatedAt);

  res.status(200).json({ ok: true });
});

/**
 * DELETE /conversations/:id
 * Idempotent: returns 204 whether or not the row existed.
 * ServerStorageProvider treats 404 as success, so we always return 204.
 */
conversationsRouter.delete('/:id', (req: Request, res: Response): void => {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params['id']);
  res.status(204).end();
});

/**
 * PATCH /conversations/:id
 * Body: { archived: boolean }
 * Updates the archived column. 404 if conversation not found.
 */
conversationsRouter.patch('/:id', (req: Request, res: Response): void => {
  const id = req.params['id'];
  const body = req.body as Record<string, unknown>;

  if (typeof body['archived'] !== 'boolean') {
    res.status(400).json({ error: 'invalid_body', message: '"archived" must be a boolean' });
    return;
  }

  // Check the row exists first.
  const existing = db
    .prepare('SELECT id, data FROM conversations WHERE id = ?')
    .get(id) as ConversationRow | undefined;

  if (!existing) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  const archivedBool = body['archived'] as boolean;
  const archivedInt = archivedBool ? 1 : 0;
  const now = Date.now();

  // Also update the archivedAt field inside the JSON blob so the full
  // Conversation object remains consistent with the archived column.
  let conversation: Conversation | null = null;
  try {
    conversation = JSON.parse(existing.data) as Conversation;
  } catch {
    res.status(500).json({ error: 'parse_error', message: 'Stored conversation data is corrupt' });
    return;
  }

  if (archivedBool) {
    conversation.archivedAt = now;
  } else {
    delete conversation.archivedAt;
  }
  conversation.updatedAt = now;

  const updatedData = JSON.stringify(conversation);

  db.prepare(`
    UPDATE conversations
    SET archived = ?, data = ?, updated_at = ?
    WHERE id = ?
  `).run(archivedInt, updatedData, now, id);

  res.status(200).json({ ok: true });
});
