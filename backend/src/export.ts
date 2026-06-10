/**
 * export.ts — Export route handler.
 *
 * GET /conversations/:id/export?format=<format>
 *
 * Returns an ExportedConversation JSON object that mirrors the shape defined
 * in /src/types/index.ts (ExportedConversation). ServerStorageProvider
 * expects this exact shape.
 *
 * Supported formats:
 *   json     — full Conversation JSON, prettily formatted
 *   markdown — plain text markdown (basic implementation; rich formatting is
 *              a future enhancement — noted in README)
 *   html     — minimal HTML wrapper around markdown content (future enhancement)
 *
 * Phase note: The client's ExportFormat type only includes 'markdown' | 'html',
 * but the backend accepts 'json' as an additional convenience format for
 * server-side consumers. This does not break the client contract.
 */

import { Router, Request, Response } from 'express';
import { db } from './db';
import type { Conversation, ExportedConversation, ExportFormat } from './types';

interface ConversationRow {
  id: string;
  data: string;
  archived: number;
  created_at: number;
  updated_at: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a safe filename from a conversation title and extension.
 * Falls back to the conversation id when the title slug is empty.
 */
function buildFilename(conv: Conversation, ext: string): string {
  const title = conv.title ?? conv.id;
  const slug = title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
  return `${slug || conv.id}.${ext}`;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function exportAsJson(conv: Conversation): ExportedConversation {
  return {
    content: JSON.stringify(conv, null, 2),
    filename: buildFilename(conv, 'json'),
    mimeType: 'application/json;charset=utf-8',
  };
}

function exportAsMarkdown(conv: Conversation): ExportedConversation {
  const lines: string[] = [];
  lines.push(`# ${conv.title ?? conv.id}`);
  lines.push('');
  lines.push(`*Created: ${new Date(conv.createdAt).toISOString()}*`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const msg of conv.messages) {
    const speaker = msg.role === 'user' ? 'User' : (msg.modelId ?? 'Assistant');
    lines.push(`**${speaker}**`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return {
    content: lines.join('\n'),
    filename: buildFilename(conv, 'md'),
    mimeType: 'text/markdown;charset=utf-8',
  };
}

function exportAsHtml(conv: Conversation): ExportedConversation {
  // Note: This is a minimal HTML export. Rich formatting (syntax highlighting,
  // proper CSS, etc.) is a future enhancement. For now we wrap the markdown
  // content in a basic HTML document. See README for details.
  const md = exportAsMarkdown(conv);
  const safeTitle = (conv.title ?? conv.id)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Escape HTML entities in the markdown body to avoid XSS.
  const escaped = md.content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${safeTitle}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
    pre { white-space: pre-wrap; }
  </style>
</head>
<body>
<pre>${escaped}</pre>
</body>
</html>`;

  return {
    content: html,
    filename: buildFilename(conv, 'html'),
    mimeType: 'text/html;charset=utf-8',
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const exportRouter = Router({ mergeParams: true });

/**
 * GET /conversations/:id/export?format=<format>
 * Returns ExportedConversation JSON.
 * 404 if conversation not found.
 * 400 if format is missing or unsupported.
 */
exportRouter.get('/', (req: Request, res: Response): void => {
  const id = req.params['id'];
  const format = (req.query['format'] as string | undefined) ?? '';

  const validFormats: ExportFormat[] = ['json', 'markdown', 'html'];
  if (!validFormats.includes(format as ExportFormat)) {
    res.status(400).json({
      error: 'invalid_format',
      message: `format must be one of: ${validFormats.join(', ')}`,
    });
    return;
  }

  const row = db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as ConversationRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }

  let conversation: Conversation;
  try {
    conversation = JSON.parse(row.data) as Conversation;
  } catch {
    res.status(500).json({ error: 'parse_error', message: 'Stored conversation data is corrupt' });
    return;
  }

  let exported: ExportedConversation;
  switch (format as ExportFormat) {
    case 'json':
      exported = exportAsJson(conversation);
      break;
    case 'markdown':
      exported = exportAsMarkdown(conversation);
      break;
    case 'html':
      exported = exportAsHtml(conversation);
      break;
    default:
      res.status(400).json({ error: 'invalid_format' });
      return;
  }

  res.json(exported);
});
