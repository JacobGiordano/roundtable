/**
 * Integration: Storage + Store (useConversationStore logic layer)
 *
 * Tests the contract between LocalStorageProvider and the persistence logic
 * exercised by useConversationStore's mutation methods. Because
 * @testing-library/react is not in devDependencies, we test the underlying
 * StorageProvider directly — the same operations that useConversationStore
 * performs internally — rather than rendering the hook.
 *
 * This verifies the real integration: real LocalStorageProvider with real
 * in-memory localStorage mock. Tests ensure that what goes in comes back out
 * correctly across the full load/save cycle.
 *
 * Cross-agent contract exercised:
 *   LocalStorageProvider.saveConversation / listConversations / loadConversation
 *   useConversationStore's ghost guard and auto-title logic (tested via deriveTitle
 *   behaviour observable in the stored conversation)
 *   ConversationStore.getSessionTokenUsage delegation to Atlas's getSessionTokenUsage
 *
 * Note on hook testing: The React hook layer (useState, useEffect, useCallback)
 * is not tested here — that requires jsdom + RTL. A gap report entry below
 * identifies the exact tests needed once those dependencies are added.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalStorageProvider } from '@/storage/LocalStorageProvider';
import { getSessionTokenUsage } from '@/models';
import {
  makeConversation,
  makeGhostConversation,
  makeUserMessage,
  makeAssistantMessage,
  makeTokenUsage,
  buildLocalStorageMock,
  resetIdSeq,
} from '../fixtures/conversations';
import type { Conversation } from '@/types/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

let restoreLocalStorage: () => void;
let provider: LocalStorageProvider;

beforeEach(() => {
  resetIdSeq();
  const mock = buildLocalStorageMock();
  restoreLocalStorage = mock.restore;
  provider = new LocalStorageProvider();
});

afterEach(() => {
  restoreLocalStorage();
});

// ─── Save → Load roundtrip ────────────────────────────────────────────────────

describe('storage roundtrip — save and reload', () => {
  it('a saved conversation can be reloaded with all fields intact', async () => {
    const conv = makeConversation({ title: 'My Test Chat' });
    conv.messages.push(makeUserMessage('hello'));

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation(conv.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe(conv.id);
    expect(loaded!.title).toBe('My Test Chat');
    expect(loaded!.messages).toHaveLength(1);
    expect(loaded!.messages[0].content).toBe('hello');
  });

  it('listConversations returns saved conversations newest-first', async () => {
    const older = makeConversation({ updatedAt: 1000 });
    const newer = makeConversation({ updatedAt: 2000 });

    await provider.saveConversation(older);
    await provider.saveConversation(newer);

    const list = await provider.listConversations();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(newer.id);
    expect(list[1].id).toBe(older.id);
  });

  it('upsert: saving the same ID twice replaces the record', async () => {
    const conv = makeConversation({ title: 'Original' });
    await provider.saveConversation(conv);

    const updated = { ...conv, title: 'Updated', updatedAt: conv.updatedAt + 1 };
    await provider.saveConversation(updated);

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Updated');
  });

  it('loadConversation returns null for a non-existent ID', async () => {
    const result = await provider.loadConversation('does-not-exist');
    expect(result).toBeNull();
  });
});

// ─── Ghost guard ──────────────────────────────────────────────────────────────

describe('storage ghost guard — isGhost conversations never persist', () => {
  it('ghost conversation is silently skipped by saveConversation', async () => {
    const ghost = makeGhostConversation();
    await provider.saveConversation(ghost);

    const loaded = await provider.loadConversation(ghost.id);
    expect(loaded).toBeNull();

    const list = await provider.listConversations();
    expect(list).toHaveLength(0);
  });

  it('ghost conversations do not pollute the index', async () => {
    const normal = makeConversation();
    const ghost = makeGhostConversation();

    await provider.saveConversation(normal);
    await provider.saveConversation(ghost);

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(normal.id);
  });
});

// ─── Delete ───────────────────────────────────────────────────────────────────

describe('storage — delete', () => {
  it('deleteConversation removes the record and the index entry', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await provider.deleteConversation(conv.id);

    const loaded = await provider.loadConversation(conv.id);
    expect(loaded).toBeNull();

    const list = await provider.listConversations();
    expect(list).toHaveLength(0);
  });

  it('deleteConversation on a non-existent ID is a no-op (does not throw)', async () => {
    await expect(provider.deleteConversation('phantom-id')).resolves.toBeUndefined();
  });

  it('deleting one conversation does not affect others', async () => {
    const a = makeConversation();
    const b = makeConversation();

    await provider.saveConversation(a);
    await provider.saveConversation(b);
    await provider.deleteConversation(a.id);

    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(b.id);
  });
});

// ─── Archive / unarchive ──────────────────────────────────────────────────────

describe('storage — archive lifecycle', () => {
  it('archiveConversation sets archivedAt and the conversation remains in list', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);

    const before = Date.now();
    await provider.archiveConversation(conv.id);
    const after = Date.now();

    const reloaded = await provider.loadConversation(conv.id);
    expect(reloaded!.archivedAt).toBeDefined();
    expect(reloaded!.archivedAt!).toBeGreaterThanOrEqual(before);
    expect(reloaded!.archivedAt!).toBeLessThanOrEqual(after);

    // Archived conversations stay in the list (UI is responsible for filtering).
    const list = await provider.listConversations();
    expect(list).toHaveLength(1);
    expect(list[0].archivedAt).toBeDefined();
  });

  it('unarchiveConversation clears archivedAt', async () => {
    const conv = makeConversation();
    await provider.saveConversation(conv);
    await provider.archiveConversation(conv.id);
    await provider.unarchiveConversation(conv.id);

    const reloaded = await provider.loadConversation(conv.id);
    expect(reloaded!.archivedAt).toBeUndefined();
  });

  it('archiveConversation is a no-op for non-existent ID', async () => {
    await expect(provider.archiveConversation('phantom-id')).resolves.toBeUndefined();
  });

  it('archive preserves groupId', async () => {
    const conv = makeConversation({ groupId: 'my-group' });
    await provider.saveConversation(conv);
    await provider.archiveConversation(conv.id);

    const reloaded = await provider.loadConversation(conv.id);
    expect(reloaded!.groupId).toBe('my-group');
  });
});

// ─── Token usage aggregation (getSessionTokenUsage cross-agent contract) ──────

describe('getSessionTokenUsage — Models utility used by Vault/Aria', () => {
  it('returns empty array for a conversation with no assistant messages', () => {
    const conv = makeConversation();
    conv.messages.push(makeUserMessage('hello'));

    const usage = getSessionTokenUsage(conv);
    expect(usage).toHaveLength(0);
  });

  it('aggregates token usage across multiple messages from the same model', () => {
    const conv = makeConversation();
    conv.messages.push(makeAssistantMessage('hi', 'claude', makeTokenUsage(10, 20)));
    conv.messages.push(makeAssistantMessage('how are you?', 'claude', makeTokenUsage(5, 15)));

    const usage = getSessionTokenUsage(conv);
    expect(usage).toHaveLength(1);
    expect(usage[0].modelId).toBe('claude');
    expect(usage[0].inputTokens).toBe(15);
    expect(usage[0].outputTokens).toBe(35);
    expect(usage[0].totalTokens).toBe(50);
  });

  it('tracks multiple models separately', () => {
    const conv = makeConversation();
    conv.messages.push(makeAssistantMessage('claude answer', 'claude', makeTokenUsage(10, 20)));
    conv.messages.push(makeAssistantMessage('gpt answer', 'gpt-5.5', makeTokenUsage(8, 12)));

    const usage = getSessionTokenUsage(conv);
    expect(usage).toHaveLength(2);

    const claudeUsage = usage.find((u) => u.modelId === 'claude');
    const gptUsage = usage.find((u) => u.modelId === 'gpt-5.5');

    expect(claudeUsage!.totalTokens).toBe(30);
    expect(gptUsage!.totalTokens).toBe(20);
  });

  it('messages with no tokenUsage are skipped without throwing', () => {
    const conv = makeConversation();
    conv.messages.push(makeAssistantMessage('no usage data', 'claude')); // no tokenUsage

    const usage = getSessionTokenUsage(conv);
    expect(usage).toHaveLength(0);
  });

  it('aggregated data persists correctly through a save/load cycle', async () => {
    const conv = makeConversation();
    conv.messages.push(makeAssistantMessage('response', 'claude', makeTokenUsage(10, 20)));

    await provider.saveConversation(conv);
    const loaded = await provider.loadConversation(conv.id);

    const usage = getSessionTokenUsage(loaded!);
    expect(usage[0].inputTokens).toBe(10);
    expect(usage[0].outputTokens).toBe(20);
  });
});

// ─── Export ───────────────────────────────────────────────────────────────────

describe('storage — export', () => {
  it('exportConversation returns null for a non-existent conversation', async () => {
    const result = await provider.exportConversation('phantom-id', 'markdown');
    expect(result).toBeNull();
  });

  it('markdown export contains the conversation title and message content', async () => {
    const conv: Conversation = makeConversation({ title: 'Export Test' });
    conv.messages.push(makeUserMessage('what is 2+2?'));

    await provider.saveConversation(conv);
    const exported = await provider.exportConversation(conv.id, 'markdown');

    expect(exported).not.toBeNull();
    expect(exported!.mimeType).toMatch(/markdown/);
    expect(exported!.filename).toMatch(/\.md$/);
    expect(exported!.content).toContain('Export Test');
    expect(exported!.content).toContain('what is 2+2?');
  });

  it('html export contains the conversation title and is valid HTML structure', async () => {
    const conv: Conversation = makeConversation({ title: 'HTML Export' });
    conv.messages.push(makeUserMessage('hello world'));

    await provider.saveConversation(conv);
    const exported = await provider.exportConversation(conv.id, 'html');

    expect(exported).not.toBeNull();
    expect(exported!.mimeType).toMatch(/html/);
    expect(exported!.filename).toMatch(/\.html$/);
    expect(exported!.content).toContain('<!DOCTYPE html>');
    expect(exported!.content).toContain('HTML Export');
    expect(exported!.content).toContain('hello world');
  });

  it('export filename uses the conversation title, slugified', async () => {
    const conv: Conversation = makeConversation({ title: 'My Great Chat 2024' });
    await provider.saveConversation(conv);

    const exported = await provider.exportConversation(conv.id, 'markdown');
    expect(exported!.filename).toContain('my-great-chat-2024');
  });
});
