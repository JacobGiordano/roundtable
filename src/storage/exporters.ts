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
import DOMPurify from 'dompurify';
import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

// ─── Security: markdown-to-HTML converter for HTML export ────────────────────
//
// Model responses arrive as markdown. The HTML export must render that markdown
// as structured HTML so the downloaded file is human-readable in any browser
// without a markdown viewer.
//
// Conversion pipeline:
//   1. micromark + GFM extensions: markdown string → HTML string.
//      micromark and micromark-extension-gfm are already installed as transitive
//      dependencies of react-markdown / remark-gfm — no new npm dep is introduced.
//   2. DOMPurify.sanitize: strip any XSS from the converted HTML before injecting
//      it into the export template. Model output is untrusted; DOMPurify is the
//      same library used in MarkdownContent.tsx (UI side). No new dep introduced.
//
// User messages are NOT run through this pipeline — user input is rendered as
// plain text (HTML-escaped, newlines → <br>). Markdown in user messages is
// literal syntax, not intended markup.
//
// DOMPurify requires a browser DOM (window/document). This function is only
// called from conversationToHtml(), which is only called during a browser export
// action. The vitest environment uses jsdom, which provides the necessary DOM.
function markdownToSafeHtml(markdown: string): string {
  const rawHtml = micromark(markdown, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
  return DOMPurify.sanitize(rawHtml);
}

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
 * Assistant message content is rendered from markdown to HTML via `markdownToSafeHtml`
 * (micromark + GFM extensions → DOMPurify sanitization), so the downloaded file
 * renders correctly in any browser — bold, lists, code blocks, and other markdown
 * elements appear as formatted HTML rather than raw syntax characters.
 *
 * User message content is rendered as plain text (HTML-escaped, newlines → `<br>`).
 * User input is literal text, not intended markdown, so markdown parsing is not applied.
 *
 * Security: assistant content passes through DOMPurify before injection into the
 * template. Model output is untrusted; DOMPurify strips XSS vectors (script tags,
 * event handler attributes, javascript: hrefs, etc.) from the micromark-generated HTML.
 *
 * When `options.includeAttachments` is true, each user message with attachments
 * has one `<span class="attachment">📎 <name></span>` element per attachment
 * appended after the message content. No inline images are rendered;
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
      // Assistant messages: render markdown to HTML (micromark + GFM → DOMPurify).
      // User messages: plain text — HTML-escaped, newlines converted to <br>.
      // User content is literal input, not intended markdown, so markdown parsing
      // would corrupt text that happens to contain asterisks or backticks.
      const content =
        msg.role === 'assistant'
          ? markdownToSafeHtml(msg.content)
          : escape(msg.content).replace(/\n/g, '<br>');

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

      // Assistant content is block-level HTML from markdownToSafeHtml (contains <p>, <ul>, etc.),
      // so it is injected directly into a <div class="content"> — not wrapped in <p>.
      // User content is inline (escaped text + <br>) and is wrapped in <p>.
      const contentHtml =
        msg.role === 'assistant'
          ? `<div class="content">${content}</div>`
          : `<p>${content}</p>`;

      return `<div class="message ${msg.role}"><strong>${role}</strong> <small>${ts}</small>${contentHtml}${generatedImageHtml}${attachmentHtml}</div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #111827; line-height: 1.6; }
    .message { margin-bottom: 1.5rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; }
    .message:last-child { border-bottom: none; }
    .user strong { color: #1e40af; }
    .assistant strong { color: #065f46; }
    small { color: #6b7280; margin-left: 0.5rem; }
    /* Markdown-rendered content for assistant messages */
    .content p { margin: 0.5rem 0; }
    .content p:first-child { margin-top: 0.25rem; }
    .content p:last-child { margin-bottom: 0; }
    .content ul, .content ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    .content li { margin: 0.25rem 0; }
    .content h1, .content h2, .content h3, .content h4, .content h5, .content h6 { margin: 1rem 0 0.5rem; font-weight: 600; line-height: 1.3; }
    .content h1 { font-size: 1.25rem; }
    .content h2 { font-size: 1.125rem; }
    .content h3, .content h4, .content h5, .content h6 { font-size: 1rem; }
    .content pre { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.75rem 1rem; overflow-x: auto; font-size: 0.875rem; margin: 0.75rem 0; }
    .content code { font-family: ui-monospace, 'Cascadia Code', Menlo, monospace; font-size: 0.875em; }
    .content pre code { font-size: inherit; background: none; padding: 0; border: none; }
    .content :not(pre) > code { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.25rem; padding: 0.125rem 0.375rem; }
    .content blockquote { border-left: 3px solid #9ca3af; margin: 0.5rem 0; padding-left: 0.75rem; color: #6b7280; font-style: italic; }
    .content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; font-size: 0.9rem; }
    .content th, .content td { border: 1px solid #e5e7eb; padding: 0.375rem 0.75rem; text-align: left; }
    .content th { background: #f9fafb; font-weight: 600; }
    .content hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
    .content a { color: #2563eb; text-decoration: underline; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
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
