/**
 * exporters.ts — Standalone conversation serializers.
 *
 * These functions are extracted from LocalStorageProvider so that any
 * StorageProvider (LocalStorageProvider, ServerStorageProvider, future
 * providers) can reuse them without duplication.
 *
 * Neither function triggers a browser download — they produce a serialized
 * string only. Download triggering is a DOM concern handled by
 * `downloadExportedConversation` in LocalStorageProvider.ts.
 */

import type { Conversation, ExportedConversation, ExportFormat } from '@/types/index';

// ─── Export options ───────────────────────────────────────────────────────────

/**
 * Options controlling what is included in a conversation export.
 *
 * `includeAttachments` (default `false`):
 *   When true, attachment metadata (filename and mimeType) is rendered beneath
 *   each user message that carries attachments. Raw base64 content is NEVER
 *   embedded — only the identifying metadata is included to keep exports small
 *   and readable.
 *
 *   Markdown output: one `[Attachment: <name> (<mimeType>)]` line per
 *   attachment, placed after the message content block.
 *
 *   HTML output: one `<span class="attachment">📎 <name></span>` element
 *   per attachment, placed after the message `<p>` element.
 *
 *   When `false` (or absent), attachment metadata is silently omitted.
 *
 * Phase 4 note: the `StorageProvider.exportConversation` interface in
 * `/src/types/index.ts` currently lacks `options?: ExportOptions`. When Phase 4
 * lands `ServerStorageProvider`, an Arch types PR should add the parameter so
 * server-side export can receive `includeAttachments` over HTTP. For now,
 * concrete implementations accept this parameter directly and the hook calls
 * `loadConversation` + `buildExportedConversation` to thread options through
 * without needing the interface widened.
 */
export type ExportOptions = {
  includeAttachments?: boolean;
};

// ─── Serializers ──────────────────────────────────────────────────────────────

/**
 * Serialize a conversation to Markdown.
 *
 * Each message is rendered with a bold role header, a timestamp, and a
 * horizontal rule separator. Model display names are resolved from
 * `conv.models` when present; falls back to `msg.modelId`, then "Assistant".
 *
 * When `options.includeAttachments` is true, each user message with attachments
 * has one `[Attachment: <name> (<mimeType>)]` line per attachment appended
 * after the message content. The attachment display name is `filename` when
 * present, otherwise `mimeType` (clipboard pastes carry no filename).
 */
export function conversationToMarkdown(conv: Conversation, options?: ExportOptions): string {
  const includeAttachments = options?.includeAttachments ?? false;
  const lines: string[] = [];
  lines.push(`# ${conv.title ?? 'Untitled conversation'}`);
  lines.push('');
  lines.push(
    `*Created: ${new Date(conv.createdAt).toLocaleString()}*`
  );
  lines.push('');

  for (const msg of conv.messages) {
    let role: string;
    if (msg.role === 'user') {
      role = 'You';
    } else {
      // Look up the human-readable display name from conv.models by modelId.
      // Falls back to modelId string if not found, then to 'Assistant' if modelId
      // is absent entirely.
      const modelConfig = msg.modelId
        ? conv.models.find((m) => m.modelId === msg.modelId)
        : undefined;
      role = modelConfig?.name ?? msg.modelId ?? 'Assistant';
    }
    const ts = new Date(msg.timestamp).toLocaleTimeString();
    lines.push(`**${role}** — ${ts}`);
    lines.push('');
    lines.push(msg.content);

    // Attachment metadata — only on user messages, only when opted in.
    if (includeAttachments && msg.role === 'user' && msg.attachments?.length) {
      lines.push('');
      for (const att of msg.attachments) {
        const name = att.filename ?? att.mimeType;
        lines.push(`[Attachment: ${name} (${att.mimeType})]`);
      }
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Serialize a conversation to a self-contained HTML document.
 *
 * All user-supplied content is HTML-escaped. Newlines in message content are
 * converted to `<br>` tags. The output includes inline styles for basic
 * readability in any browser.
 *
 * When `options.includeAttachments` is true, each user message with attachments
 * has one `<span class="attachment">📎 <name></span>` element per attachment
 * appended after the message `<p>` element. No inline images are rendered;
 * only the identifying metadata is included. The `.attachment` class carries
 * minimal inline styling (pill shape, muted color).
 */
export function conversationToHtml(conv: Conversation, options?: ExportOptions): string {
  const includeAttachments = options?.includeAttachments ?? false;

  const escape = (s: string): string =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const title = escape(conv.title ?? 'Untitled conversation');
  const rows = conv.messages
    .map((msg) => {
      let role: string;
      if (msg.role === 'user') {
        role = 'You';
      } else {
        const modelConfig = msg.modelId
          ? conv.models.find((m) => m.modelId === msg.modelId)
          : undefined;
        role = escape(modelConfig?.name ?? msg.modelId ?? 'Assistant');
      }
      const ts = new Date(msg.timestamp).toLocaleTimeString();
      const content = escape(msg.content).replace(/\n/g, '<br>');

      // Attachment pills — only on user messages, only when opted in.
      let attachmentHtml = '';
      if (includeAttachments && msg.role === 'user' && msg.attachments?.length) {
        const pills = msg.attachments
          .map((att) => {
            const name = escape(att.filename ?? att.mimeType);
            return `<span class="attachment">📎 ${name}</span>`;
          })
          .join(' ');
        attachmentHtml = `<div class="attachments">${pills}</div>`;
      }

      return `<div class="message ${msg.role}"><strong>${role}</strong> <small>${ts}</small><p>${content}</p>${attachmentHtml}</div>`;
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
    .attachments { margin-top: 0.5rem; }
    .attachment { display: inline-block; font-size: 0.75rem; color: #374151; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 9999px; padding: 0.125rem 0.5rem; margin-right: 0.25rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <p><em>Created: ${escape(new Date(conv.createdAt).toLocaleString())}</em></p>
${rows}
</body>
</html>`;
}

// ─── Shared builder ───────────────────────────────────────────────────────────

/**
 * Build a complete `ExportedConversation` result from a conversation object.
 *
 * Extracted so both `LocalStorageProvider.exportConversation` and the
 * `useConversationStore` hook can use it without duplicating slug logic.
 * The slug is derived from the conversation title, falling back to the ID.
 *
 * This function does NOT access storage — it operates purely on the in-memory
 * `Conversation` object passed to it.
 */
export function buildExportedConversation(
  conv: Conversation,
  format: ExportFormat,
  options?: ExportOptions
): ExportedConversation {
  const slug = (conv.title ?? `conversation-${conv.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);

  if (format === 'markdown') {
    return {
      content: conversationToMarkdown(conv, options),
      filename: `${slug}.md`,
      mimeType: 'text/markdown;charset=utf-8',
    };
  } else {
    return {
      content: conversationToHtml(conv, options),
      filename: `${slug}.html`,
      mimeType: 'text/html;charset=utf-8',
    };
  }
}
