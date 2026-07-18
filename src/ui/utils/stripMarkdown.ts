/**
 * stripMarkdown — converts markdown to plain text.
 *
 * Used by the "Copy as plain text" option in the message bubble copy button (#471).
 * This is a regex-based strip — no external dependency added.
 *
 * Order of operations matters:
 *   1. Fenced code blocks: strip delimiters, keep raw code content.
 *   2. Inline code: strip backticks, keep content.
 *   3. Links: keep display text, discard URL.
 *   4. Images: keep alt text.
 *   5. HTML tags: remove entirely (defense in depth — DOMPurify handles this upstream
 *      but we also strip here in case stripMarkdown is called on raw content).
 *   6. ATX headings (# to ######): remove the hash prefix.
 *   7. Setext headings (underline with === or ---): remove underline lines.
 *   8. Blockquote markers: remove > prefix.
 *   9. Bold/italic/strikethrough delimiters: remove **, *, _, ~~.
 *  10. Horizontal rules: remove.
 *  11. List markers: remove bullet (-, *, +) and numbered (1.) markers.
 *  12. Collapse multiple blank lines into one blank line.
 *  13. Trim leading/trailing whitespace.
 *
 * Intentionally simple — this covers the vast majority of AI-generated markdown.
 * It is not a full CommonMark parser and will not handle deeply nested or exotic
 * constructs perfectly, but it produces readable plain text for normal content.
 */
export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // 1. Fenced code blocks (``` or ~~~): remove delimiters, keep content.
  //    The [^`]* lookahead handles optional language tags.
  text = text.replace(/^```[^\n]*\n?([\s\S]*?)```\s*$/gm, '$1');
  text = text.replace(/^~~~[^\n]*\n?([\s\S]*?)~~~\s*$/gm, '$1');

  // 2. Inline code: remove surrounding backticks.
  text = text.replace(/`{1,2}([^`]+)`{1,2}/g, '$1');

  // 3. Links: [text](url) or [text][ref] → text.
  text = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

  // 4. Images: ![alt](url) → alt text.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');

  // 5. HTML tags: remove.
  text = text.replace(/<[^>]+>/g, '');

  // 6. ATX headings: "# Heading" → "Heading".
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 7. Setext heading underlines (===... or ---...): remove the underline lines.
  //    Note: inside [...], '-' at the start of the class is treated as a literal.
  text = text.replace(/^[-=]{3,}\s*$/gm, '');

  // 8. Blockquote markers: remove "> " prefix (including nested ">>" patterns).
  text = text.replace(/^>+\s?/gm, '');

  // 9. Bold/italic/strikethrough delimiters: remove.
  //    Order: triple-delimiter must precede double to avoid partial matches.
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // ***bold italic***
  text = text.replace(/___([^_]+)___/g, '$1');       // ___bold italic___
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');     // **bold**
  text = text.replace(/__([^_]+)__/g, '$1');          // __bold__
  text = text.replace(/\*([^*]+)\*/g, '$1');          // *italic*
  text = text.replace(/_([^_]+)_/g, '$1');            // _italic_
  text = text.replace(/~~([^~]+)~~/g, '$1');          // ~~strikethrough~~

  // 10. Horizontal rules: remove lines of ---, ***, ___ (3+).
  text = text.replace(/^[-*_]{3,}\s*$/gm, '');

  // 11. List markers: remove bullet and numbered prefixes.
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');           // unordered
  text = text.replace(/^[\s]*\d+[.)]\s+/gm, '');         // ordered

  // 12. Collapse 3+ consecutive blank lines into 2 blank lines.
  text = text.replace(/\n{3,}/g, '\n\n');

  // 13. Trim.
  return text.trim();
}
