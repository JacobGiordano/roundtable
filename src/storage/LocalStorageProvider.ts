/**
 * LocalStorageProvider — Vault implementation of StorageProvider.
 *
 * Storage layout:
 *   roundtable:conv:{id}   → JSON-serialised StoredConversation envelope
 *                            (or bare Conversation for legacy version 0 records)
 *   roundtable:index       → JSON-serialised string[] of conversation IDs
 *
 * Ghost-mode conversations must never reach this layer — isGhost is the first
 * guard on every write path, before any index or data key is touched.
 *
 * Schema versioning:
 *   All writes go through the StoredConversation envelope defined in migration.ts.
 *   All reads go through parseStoredConversation(), which detects the envelope,
 *   identifies bare (version 0) records, and runs migrations as needed.
 *   See migration.ts for how to add a new schema version.
 */

import type {
  Conversation,
  ExportedConversation,
  ExportFormat,
  StorageProvider,
} from '@/types/index';

import { conversationToMarkdown, conversationToHtml } from './exporters';
import { wrapForStorage, parseStoredConversation } from './migration';

// ─── Constants ────────────────────────────────────────────────────────────────

const NS = 'roundtable';
const INDEX_KEY = `${NS}:index`;

function convKey(id: string): string {
  return `${NS}:conv:${id}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wraps localStorage.setItem and converts QuotaExceededError into a
 * descriptive Error so callers can surface it gracefully.
 */
function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    if (
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        // Firefox legacy name
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw new Error(
        'Storage quota exceeded. Please delete some conversations to free space.'
      );
    }
    throw err;
  }
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    // Corrupted index — treat as empty; existing conversations remain accessible
    // by direct key lookup but won't appear in list until re-saved.
    return [];
  }
}

function writeIndex(ids: string[]): void {
  safeSet(INDEX_KEY, JSON.stringify(ids));
}

/**
 * Parse a raw localStorage value into a Conversation, running schema
 * migrations as needed. Delegates to migration.ts — see parseStoredConversation()
 * for the full behaviour (envelope detection, version 0 legacy path, error handling).
 */
function parseConversation(raw: string | null): Conversation | null {
  return parseStoredConversation(raw);
}

function triggerDownload(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── LocalStorageProvider ─────────────────────────────────────────────────────

export class LocalStorageProvider implements StorageProvider {
  /**
   * Persist a conversation. Ghost-mode conversations are silently skipped —
   * isGhost is the first guard on this write path; nothing is ever written to
   * storage for ghost conversations.
   *
   * Writes a StoredConversation envelope (schemaVersion + data) so the read
   * path can detect the schema version and run migrations if needed.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    // Ghost-mode guard — first line, before any index or data key is touched.
    if (conversation.isGhost) return;

    const ids = readIndex();
    if (!ids.includes(conversation.id)) {
      ids.push(conversation.id);
      writeIndex(ids);
    }

    // Wrap in the StoredConversation envelope before writing.
    // This records the current schemaVersion so the read path can migrate
    // stale records written by older builds.
    const envelope = wrapForStorage(conversation);
    safeSet(convKey(conversation.id), JSON.stringify(envelope));
  }

  /** Returns null if the conversation does not exist or the stored data is corrupt. */
  async loadConversation(id: string): Promise<Conversation | null> {
    const raw = localStorage.getItem(convKey(id));
    return parseConversation(raw);
  }

  /**
   * Returns all conversations referenced by the index, in insertion order.
   * Entries whose underlying data is missing or corrupt are silently skipped
   * to keep the list consistent even if storage is partially cleared.
   */
  async listConversations(): Promise<Conversation[]> {
    const ids = readIndex();
    const conversations: Conversation[] = [];

    for (const id of ids) {
      const conv = parseConversation(localStorage.getItem(convKey(id)));
      if (conv !== null) {
        conversations.push(conv);
      }
    }

    // Sort newest-first by updatedAt so the UI gets a sensible default order.
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    return conversations;
  }

  /** Removes the conversation from both the index and its storage key. */
  async deleteConversation(id: string): Promise<void> {
    const ids = readIndex().filter((i) => i !== id);
    writeIndex(ids);
    localStorage.removeItem(convKey(id));
  }

  /**
   * Sets archivedAt on the stored conversation. No-op if it does not exist.
   * Archived conversations remain in the index — filtering is the UI's
   * responsibility. Group membership (groupId) is preserved.
   */
  async archiveConversation(id: string): Promise<void> {
    const conv = await this.loadConversation(id);
    if (!conv) return;

    const archived: Conversation = {
      ...conv,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    };

    await this.saveConversation(archived);
  }

  /**
   * Clears the archivedAt timestamp, returning the conversation to active
   * status. No-op if the conversation does not exist or was not archived.
   */
  async unarchiveConversation(id: string): Promise<void> {
    const conv = await this.loadConversation(id);
    if (!conv) return;
    if (conv.archivedAt === undefined) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { archivedAt: _archivedAt, ...rest } = conv;
    const unarchived: Conversation = {
      ...rest,
      updatedAt: Date.now(),
    };

    await this.saveConversation(unarchived);
  }

  /**
   * Serializes the conversation to the requested format and returns the result.
   * Returns null if the conversation does not exist.
   *
   * Does NOT trigger a browser download — that is handled by
   * `downloadExportedConversation`, a separate utility exported from this
   * module. This separation allows ServerStorageProvider to use the same
   * interface without browser DOM access.
   */
  async exportConversation(id: string, format: ExportFormat): Promise<ExportedConversation | null> {
    const conv = await this.loadConversation(id);
    if (!conv) return null;

    const slug = (conv.title ?? `conversation-${id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60);

    if (format === 'markdown') {
      return {
        content: conversationToMarkdown(conv),
        filename: `${slug}.md`,
        mimeType: 'text/markdown;charset=utf-8',
      };
    } else {
      return {
        content: conversationToHtml(conv),
        filename: `${slug}.html`,
        mimeType: 'text/html;charset=utf-8',
      };
    }
  }
}

// ─── Download trigger — browser-only utility ──────────────────────────────────

/**
 * Triggers a browser download from an `ExportedConversation` returned by
 * `StorageProvider.exportConversation`. This is intentionally separate from
 * the interface method so that non-browser consumers (tests, server) can call
 * `exportConversation` without touching the DOM.
 *
 * Aria calls this after receiving the serialized result from Vault.
 */
export function downloadExportedConversation(exported: ExportedConversation): void {
  triggerDownload(exported.filename, exported.content, exported.mimeType);
}
