/**
 * LocalStorageProvider — Vault implementation of StorageProvider.
 *
 * Storage layout:
 *   roundtable:conv:{id}   → JSON-serialised Conversation
 *   roundtable:index       → JSON-serialised string[] of conversation IDs
 *
 * Ghost-mode conversations must never reach this layer — the caller is
 * responsible for checking `conversation.isGhost` before calling save.
 */

import type {
  Conversation,
  ExportFormat,
  StorageProvider,
} from '@/types/index';

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

function parseConversation(raw: string | null): Conversation | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [];
  lines.push(`# ${conv.title ?? 'Untitled conversation'}`);
  lines.push('');
  lines.push(
    `*Created: ${new Date(conv.createdAt).toLocaleString()}*`
  );
  lines.push('');

  for (const msg of conv.messages) {
    const role = msg.role === 'user' ? 'You' : msg.modelId ?? 'Assistant';
    const ts = new Date(msg.timestamp).toLocaleTimeString();
    lines.push(`**${role}** — ${ts}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

function conversationToHtml(conv: Conversation): string {
  const escape = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const title = escape(conv.title ?? 'Untitled conversation');
  const rows = conv.messages
    .map((msg) => {
      const role =
        msg.role === 'user' ? 'You' : escape(msg.modelId ?? 'Assistant');
      const ts = new Date(msg.timestamp).toLocaleTimeString();
      const content = escape(msg.content).replace(/\n/g, '<br>');
      return `<div class="message ${msg.role}"><strong>${role}</strong> <small>${ts}</small><p>${content}</p></div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    .message { margin-bottom: 1.5rem; }
    .user { color: #1e40af; }
    .assistant { color: #065f46; }
    small { color: #6b7280; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p><em>Created: ${escape(new Date(conv.createdAt).toLocaleString())}</em></p>
${rows}
</body>
</html>`;
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
   * isGhost is a hard barrier; nothing is ever written to storage for them.
   */
  async saveConversation(conversation: Conversation): Promise<void> {
    if (conversation.isGhost) return;

    const ids = readIndex();
    if (!ids.includes(conversation.id)) {
      ids.push(conversation.id);
      writeIndex(ids);
    }

    safeSet(convKey(conversation.id), JSON.stringify(conversation));
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
   * Does not remove the conversation from the index — archived conversations
   * remain loadable; filtering is the UI's responsibility.
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
   * Triggers a browser download of the conversation in the requested format.
   * Phase 3 feature — safe no-op if conversation is not found.
   */
  async exportConversation(id: string, format: ExportFormat): Promise<void> {
    const conv = await this.loadConversation(id);
    if (!conv) return;

    const slug = (conv.title ?? `conversation-${id}`)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 60);

    if (format === 'markdown') {
      triggerDownload(
        `${slug}.md`,
        conversationToMarkdown(conv),
        'text/markdown;charset=utf-8'
      );
    } else {
      triggerDownload(
        `${slug}.html`,
        conversationToHtml(conv),
        'text/html;charset=utf-8'
      );
    }
  }
}
