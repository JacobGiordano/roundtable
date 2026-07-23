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
 *
 * ## Field coverage — Message.generatedImages (issue #365)
 *
 * Persistence: `Message.generatedImages` round-trips through LocalStorage
 * automatically. `LocalStorageProvider.saveConversation` serialises the full
 * `Conversation` object via `JSON.stringify` with no field allowlist, and
 * `parseStoredConversation` in `migration.ts` deserialises via `JSON.parse`
 * with no field stripping. `wrapForStorage()` wraps the Conversation object
 * directly; the fast path in `parseStoredConversation()` returns
 * `data as Conversation` without field filtering. No migration step removes
 * unknown fields. The field survives the round-trip unchanged when present and
 * remains absent when not set. No code change was needed for persistence.
 *
 * Exports: `GeneratedImage.base64` is the only copy of model-produced image
 * content. Both exporters embed it as an inline data-URI image when
 * `ExportOptions.includeGeneratedImages` is `true` (issue #453). When false
 * or absent (the default), generated images are silently omitted from the
 * export to prevent unexpectedly large multi-MB files (Vera privacy audit).
 *
 * Privacy: `GeneratedImage.base64` is treated identically to `Message.content`
 * — included in exports only when the user explicitly triggers an export, never
 * logged, and excluded from ghost-mode sessions by the `isGhost` guard on
 * `LocalStorageProvider.saveConversation` (which fires before any write,
 * covering the entire `Conversation` object including `messages[].generatedImages`).
 */

import type { Conversation, ExportedConversation, ExportFormat, ExportOptions } from '@/types/index';

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
 *
 * `Message.generatedImages` (issue #365, #453): model-returned images are
 * rendered as inline data-URI Markdown images (`![alt](data:mimeType;base64,…)`)
 * only when `options.includeGeneratedImages` is `true`. When false or absent
 * (the default), generated image content is silently omitted from the export.
 * This prevents unexpectedly large multi-MB exports (Vera privacy audit, #453).
 * The `]` character in `altText` is escaped to prevent it from prematurely
 * closing the Markdown image alt-text bracket.
 */
export function conversationToMarkdown(conv: Conversation, options?: ExportOptions): string {
  const includeAttachments = options?.includeAttachments ?? false;
  const includeGeneratedImages = options?.includeGeneratedImages ?? false;
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

    // Generated images — inline data-URI Markdown images (issue #365, #453).
    // Gated on includeGeneratedImages (default false) per Vera's privacy audit:
    // embedding base64 blobs unconditionally produced unexpectedly large exports.
    // altText `]` is escaped to preserve Markdown image syntax.
    if (includeGeneratedImages && msg.generatedImages?.length) {
      lines.push('');
      for (const img of msg.generatedImages) {
        const alt = (img.altText ?? 'Generated image').replace(/]/g, '\\]');
        lines.push(`![${alt}](data:${img.mimeType};base64,${img.base64})`);
      }
    }

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
 *
 * `Message.generatedImages` (issue #365, #453): model-returned images are
 * rendered as `<img>` elements with inline data-URI `src` attributes only when
 * `options.includeGeneratedImages` is `true`. When false or absent (the default),
 * generated image content is silently omitted from the export to prevent
 * unexpectedly large multi-MB exports (Vera privacy audit, #453).
 * `altText` and `mimeType` are HTML-escaped; `base64` contains only the
 * characters `[A-Za-z0-9+/=]` and requires no escaping.
 */
export function conversationToHtml(conv: Conversation, options?: ExportOptions): string {
  const includeAttachments = options?.includeAttachments ?? false;
  const includeGeneratedImages = options?.includeGeneratedImages ?? false;

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

      // Generated images — inline data-URI <img> elements (issue #365, #453).
      // Gated on includeGeneratedImages (default false) per Vera's privacy audit:
      // embedding base64 blobs unconditionally produced unexpectedly large exports.
      // mimeType is escaped; base64 is restricted to [A-Za-z0-9+/=] and needs no escaping.
      let generatedImageHtml = '';
      if (includeGeneratedImages && msg.generatedImages?.length) {
        const imgs = msg.generatedImages
          .map((img) => {
            const alt = escape(img.altText ?? 'Generated image');
            const mimeType = escape(img.mimeType);
            return `<img src="data:${mimeType};base64,${img.base64}" alt="${alt}" style="max-width:100%;height:auto;display:block;margin:0.5rem 0;">`;
          })
          .join('\n');
        generatedImageHtml = `<div class="generated-images">${imgs}</div>`;
      }

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

      return `<div class="message ${msg.role}"><strong>${role}</strong> <small>${ts}</small><p>${content}</p>${generatedImageHtml}${attachmentHtml}</div>`;
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
    .generated-images { margin-top: 0.5rem; }
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
