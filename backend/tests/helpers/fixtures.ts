/**
 * tests/helpers/fixtures.ts — Shared test fixture factories for backend route tests.
 *
 * Extracted from auth.test.ts, conversations.test.ts, and export.test.ts to
 * eliminate duplication. All three files previously defined insertUser() locally;
 * conversations.test.ts and export.test.ts also duplicated loginAs() and
 * makeConversation().
 *
 * USAGE:
 *   import { insertUser, loginAs, makeConversation, makeConversationWithMessages }
 *     from '../helpers/fixtures'
 */

import bcrypt from 'bcryptjs';
import type { Conversation, Message } from '../../src/types';
import { createTestApp } from './createTestApp';

// ─── User fixtures ────────────────────────────────────────────────────────────

/**
 * Insert a user into the database with a real bcrypt hash.
 *
 * The backend has no /auth/register endpoint — users are seeded at startup via
 * seedAdminUser() or inserted directly. In tests we insert directly so we can
 * control the username and password without the startup side effects.
 *
 * bcrypt cost factor 4 is used for speed in tests — production uses 12.
 */
export function insertUser(
  db: ReturnType<typeof createTestApp>['db'],
  username: string,
  password: string,
): void {
  const hash = bcrypt.hashSync(password, 4); // cost 4 for speed in tests (not production)
  db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(
    username,
    hash,
  );
}

// ─── Auth fixtures ────────────────────────────────────────────────────────────

/** Log in and return the Bearer token. */
export async function loginAs(
  request: ReturnType<typeof createTestApp>['request'],
  username: string,
  password: string,
): Promise<string> {
  const res = await request
    .post('/auth/login')
    .send({ username, password });
  return res.body.token as string;
}

// ─── Conversation fixtures ────────────────────────────────────────────────────

/**
 * A minimal valid Conversation object for upsert and CRUD tests.
 * Defaults to empty messages.
 */
export function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-test-1',
    title: 'Test Conversation',
    messages: [],
    models: [],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

/**
 * A Conversation with a realistic message thread — suitable for export tests
 * that need content in the rendered output (markdown/html/json).
 */
export function makeConversationWithMessages(
  overrides: Partial<Conversation> = {},
): Conversation {
  const messages: Message[] = [
    {
      id: 'msg-1',
      role: 'user',
      content: 'Hello world',
      timestamp: 1700000000000,
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content: 'Hi there!',
      modelId: 'claude',
      timestamp: 1700000001000,
    },
  ];

  return {
    id: 'export-conv-1',
    title: 'My Test Conversation',
    messages,
    models: [],
    interactionMode: 'parallel',
    isGhost: false,
    createdAt: 1700000000000,
    updatedAt: 1700000001000,
    ...overrides,
  };
}
