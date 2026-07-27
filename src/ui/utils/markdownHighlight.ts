/**
 * markdownHighlight.ts — shared hljs language map for syntax highlighting.
 *
 * #552: Extracted from MessageBubble.tsx (streaming path) and MarkdownContent.tsx
 * (done-state path) to eliminate duplication. Both files previously imported all
 * 20 hljs language modules and declared an identical HIGHLIGHT_LANGUAGES object.
 *
 * Usage:
 *   import { HIGHLIGHT_LANGUAGES } from './utils/markdownHighlight';
 *   // Then build rehypePlugins with: [rehypeHighlight, { languages: HIGHLIGHT_LANGUAGES }]
 *
 * #553: The `markdown` language (hljs_markdown) has been removed. Markdown content
 * inside a markdown renderer is redundant and adds ~2–3 kB to the markdown chunk.
 *
 * Language coverage (#446): AI models commonly produce these languages. The full
 * highlight.js "common" set (~37 languages) is intentionally avoided — it adds
 * ~9 MB of source weight that is not justified for a conversational interface.
 *
 * html and xml are both handled by highlight.js/lib/languages/xml — the xml module
 * registers itself under both "html" and "xml" aliases.
 */

// #553: hljs_markdown intentionally omitted — see module comment above.
import hljs_javascript from 'highlight.js/lib/languages/javascript';
import hljs_typescript from 'highlight.js/lib/languages/typescript';
import hljs_python     from 'highlight.js/lib/languages/python';
import hljs_bash       from 'highlight.js/lib/languages/bash';
import hljs_shell      from 'highlight.js/lib/languages/shell';
import hljs_json       from 'highlight.js/lib/languages/json';
import hljs_css        from 'highlight.js/lib/languages/css';
import hljs_xml        from 'highlight.js/lib/languages/xml';
import hljs_sql        from 'highlight.js/lib/languages/sql';
import hljs_go         from 'highlight.js/lib/languages/go';
import hljs_rust       from 'highlight.js/lib/languages/rust';
import hljs_java       from 'highlight.js/lib/languages/java';
import hljs_cpp        from 'highlight.js/lib/languages/cpp';
import hljs_csharp     from 'highlight.js/lib/languages/csharp';
import hljs_ruby       from 'highlight.js/lib/languages/ruby';
import hljs_php        from 'highlight.js/lib/languages/php';
import hljs_swift      from 'highlight.js/lib/languages/swift';
import hljs_kotlin     from 'highlight.js/lib/languages/kotlin';
import hljs_yaml       from 'highlight.js/lib/languages/yaml';
import hljs_diff       from 'highlight.js/lib/languages/diff';

/**
 * Restricted language map for rehype-highlight.
 *
 * Covers the languages most commonly produced by AI models. Shared between
 * the streaming render path (MessageBubble.tsx) and the done-state path
 * (MarkdownContent.tsx) so both paths highlight the same language set.
 *
 * html and xml are both registered by the same highlight.js xml module.
 */
export const HIGHLIGHT_LANGUAGES: Record<string, unknown> = {
  javascript: hljs_javascript,
  typescript: hljs_typescript,
  python:     hljs_python,
  bash:       hljs_bash,
  shell:      hljs_shell,
  json:       hljs_json,
  css:        hljs_css,
  xml:        hljs_xml,
  html:       hljs_xml, // highlight.js xml module handles html
  sql:        hljs_sql,
  go:         hljs_go,
  rust:       hljs_rust,
  java:       hljs_java,
  cpp:        hljs_cpp,
  csharp:     hljs_csharp,
  ruby:       hljs_ruby,
  php:        hljs_php,
  swift:      hljs_swift,
  kotlin:     hljs_kotlin,
  yaml:       hljs_yaml,
  diff:       hljs_diff,
};
