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

import type { Conversation } from '@/types/index';

/**
 * Serialize a conversation to Markdown.
 *
 * Each message is rendered with a bold role header, a timestamp, and a
 * horizontal rule separator. Model display names are resolved from
 * `conv.models` when present; falls back to `msg.modelId`, then "Assistant".
 */
export function conversationToMarkdown(conv: Conversation): string {
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
 */
export function conversationToHtml(conv: Conversation): string {
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
