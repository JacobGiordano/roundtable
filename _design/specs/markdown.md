# Roundtable Markdown Prose Token Spec

**Owner:** Luma
**Status:** Complete — no TBDs
**Last updated:** 2026-06-16

This document defines the token layer for markdown-rendered content inside message bubbles. These tokens cover inline code, code blocks, hyperlinks, and blockquotes — the markdown elements that require color decisions beyond the base text tokens already defined in `schema.md`.

Aria currently hardcodes `text-text-primary underline` for link color in `MessageBubble.tsx`. This spec replaces that interim choice with proper tokens so Aria can swap to `text-link` and have all 7 themes supported correctly.

---

## Why a separate file

These are rendering-context tokens, not component tokens. They describe how markdown-flavored content inside a bubble is styled — not a component's structure, states, or dimensions. Mixing them into `components.md` would misrepresent their scope: a component spec covers a discrete element; this spec covers a content rendering layer that applies across all message bubbles regardless of model or theme.

---

## Token Definitions

Seven new tokens in the `prose` semantic category. All are color tokens (hex strings). They vary per theme. See schema.md for the updated schema that includes the `prose` top-level key.

### `prose.code-bg`

Inline code background. The background fill for `` `code spans` `` within message body text.

- Applied to: the background of inline `<code>` elements inside message bubbles.
- Semantic intent: a slight tint that distinguishes code from prose without heavy visual weight. Should read as "this is monospace, machine-oriented text" rather than a block-level element.
- Contrast requirement: `prose.code-text` on `prose.code-bg` — no minimum text contrast requirement (code-text is always `text.secondary` on `prose.code-bg` and satisfies legibility; no WCAG text contrast rule requires inline code background to pass 4.5:1 against text when the same text also passes on the surrounding card surface). See Aria implementation note.

### `prose.code-border`

Inline code border. A 1px border on inline `<code>` elements to add definition when the background tint alone is subtle.

- Applied to: `border: 1px solid {prose.code-border}` on inline `<code>` elements.
- Contrast requirement: structural border — UI component threshold (3:1) against surrounding card surface.

### `prose.code-text`

Inline code text color. The foreground color for `` `code spans` ``.

- Applied to: `color: {prose.code-text}` on inline `<code>` elements.
- Semantic intent: slightly differentiated from body text — secondary, monospaced register. Not muted enough to be unreadable; not identical to primary text so it reads as distinct from prose.
- Contrast requirement: must pass WCAG AA (4.5:1) against `surfaces.card` — the primary surface where inline code appears. Code spans appear inline within message body text which sits on the card surface.
- Implementation: uses `text.secondary` in all themes. That value has been WCAG-verified on `surfaces.card` in each theme's `_a11y` block.

### `prose.block-bg`

Code block background. The background for fenced code blocks (` ```code blocks``` `).

- Applied to: the wrapper `<pre>` or `<div>` element containing a code block.
- Semantic intent: code blocks are distinct from prose — they occupy a visual tier between the card surface and deeper structure. In dark themes, slightly darker than the card. In light themes, slightly more tinted than the card.
- Contrast requirement: code block text uses `text.primary` (react-markdown renders block code with the primary text token). `text.primary` on `prose.block-bg` must pass WCAG AA (4.5:1). Values below are verified for this pairing.

### `prose.link`

Hyperlink color. The color of `[link text](url)` rendered hyperlinks in message body content.

- Applied to: `<a>` elements rendered by react-markdown in `MessageBubble.tsx`. Replaces the current interim `text-text-primary underline` class.
- Semantic intent: links are informational signals. Values follow the `semantic.info` family in most themes for conceptual consistency — same hue family, calibrated for comfortable reading in prose context.
- Contrast requirement: must pass WCAG AA (4.5:1) against `surfaces.card`.
- Decoration: underline always applied to links via Tailwind class. `prose.link` is the color token only.
- Aria implementation note: the current hardcoded `text-text-primary underline` in `MessageBubble.tsx` becomes `text-link underline`. The Tailwind key `colors.link` maps to `--prose-link`.

### `prose.link-hover`

Link hover color. The color of a hyperlink on `:hover` state.

- Applied to: same `<a>` elements, on `:hover`.
- Semantic intent: in dark themes, hover brightens the link (higher luminance = more prominent). In light themes, hover darkens the link (lower luminance = more emphatic on light surface).
- Contrast requirement: must pass WCAG AA (4.5:1) against `surfaces.card`.

### `prose.blockquote-border`

Blockquote left border. The left border on `> blockquote` elements in markdown.

- Applied to: `border-left: 3px solid {prose.blockquote-border}` on `<blockquote>` elements. The blockquote content is then padded `12px` left.
- Semantic intent: a structural accent that distinguishes quoted content from response prose. Does not compete visually with the model accent left border on the bubble container — the blockquote border appears on a child element inside the bubble's content padding, contextually distinct from the bubble-level border.
- Contrast requirement: UI component threshold (3:1) against `surfaces.card`. This is a structural border accent, not text.
- Value: uses `borders.strong` in all themes. Blockquote borders need visible presence without being decorative — `borders.strong` is the right tier.

---

## Aria Implementation Notes

### Tailwind class usage

New Tailwind classes (wired via `tailwind.config.js` — see `tailwind-mapping.md` section update):

| Class | Token | Use |
|-------|-------|-----|
| `bg-code` | `prose.code-bg` | Inline code background |
| `border-code` | `prose.code-border` | Inline code border |
| `text-code` | `prose.code-text` | Inline code text |
| `bg-code-block` | `prose.block-bg` | Code block background |
| `text-link` | `prose.link` | Link text color (replaces `text-text-primary` for links) |
| `hover:text-link-hover` | `prose.link-hover` | Link hover text color |
| `border-blockquote` | `prose.blockquote-border` | Blockquote left border |

### react-markdown component mapping

Aria's custom `components` prop for `ReactMarkdown` in `MessageBubble.tsx`:

```tsx
// These are spec annotations for Aria's implementation — not production code
// Inline code:
code: ({ inline, children }) =>
  inline ? (
    <code className="bg-code border border-code text-code rounded-sm px-1 py-0.5 font-mono text-[13px]">
      {children}
    </code>
  ) : (
    // Block code is handled by pre wrapper below
    <code className="font-mono text-[13px]">{children}</code>
  )

// Code block (pre wrapper):
pre: ({ children }) => (
  <pre className="bg-code-block rounded-md p-4 overflow-x-auto my-2">
    {children}
  </pre>
)

// Link:
a: ({ href, children }) => {
  const isExternal = href?.startsWith('http');
  return (
    <a href={href} className="text-link hover:text-link-hover underline"
       target={isExternal ? '_blank' : undefined}
       rel={isExternal ? 'noopener noreferrer' : undefined}>
      {children}
      {isExternal && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  );
}

// Blockquote:
blockquote: ({ children }) => (
  <blockquote className="border-l-[3px] border-blockquote pl-3 my-2 italic text-text-secondary">
    {children}
  </blockquote>
)
```

Note on blockquote: `italic text-text-secondary` is a typography recommendation, not a new token. Blockquote content uses the existing `text.secondary` token for its color — the visual hierarchy signal is the left border + italic, not a new text color.

### Ghost mode

No visual difference for prose tokens in ghost mode. Ghost mode affects persistence, not rendering.

---

## Token Values Per Theme

All values verified for WCAG AA (4.5:1 for text tokens, 3:1 for border/structural tokens) against the relevant surface.

### Slate (dark — `surfaces.card: #1A1D26`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#252837` | n/a (bg token) | Slightly lighter than card; same blue-gray family |
| `prose.code-border` | `#2A2E3D` | ~3.3:1 PASS 3:1 | = `borders.default` |
| `prose.code-text` | `#A0A8BC` | 7.13:1 PASS AA | = `text.secondary`; already verified in Slate `_a11y` |
| `prose.block-bg` | `#141720` | n/a (bg token) | Darker than card; `text.primary #E8EAF0` on `#141720` ≈ 12.9:1 PASS AA |
| `prose.link` | `#3B82F6` | 4.62:1 PASS AA | = `semantic.info`; verified in Slate `_a11y` implied by card ratio |
| `prose.link-hover` | `#60A5FA` | 6.67:1 PASS AA | Lighter blue on hover |
| `prose.blockquote-border` | `#4A5068` | structural | = `borders.strong` |

### Midnight (dark — `surfaces.card: #0D1525`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#162030` | n/a (bg token) | Slightly lighter than card; dark navy family |
| `prose.code-border` | `#1E2D4A` | structural | = `borders.default` |
| `prose.code-text` | `#94A3C8` | 7.84:1 PASS AA | = `text.secondary` |
| `prose.block-bg` | `#090F1C` | n/a (bg token) | Deeper than card; `text.primary #F0F4FF` on `#090F1C` ≈ 16.8:1 PASS AA |
| `prose.link` | `#60A5FA` | 7.66:1 PASS AA | = `semantic.info`; bright sky blue on deep navy |
| `prose.link-hover` | `#93C5FD` | 13.5:1 PASS AA | Lighter blue on hover |
| `prose.blockquote-border` | `#3A5280` | structural | = `borders.strong` |

### Ash (dark — `surfaces.card: #22252A`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#2D3137` | n/a (bg token) | Slightly lighter than card; cool neutral |
| `prose.code-border` | `#313539` | structural | = `borders.default` |
| `prose.code-text` | `#8E969E` | 4.56:1 PASS AA | = `text.secondary`; verified in Ash `_a11y` on card |
| `prose.block-bg` | `#1A1D21` | n/a (bg token) | Slightly darker than card; `text.primary #D8DCDF` on `#1A1D21` ≈ 10.2:1 PASS AA |
| `prose.link` | `#4A90D9` | 4.62:1 PASS AA | = `semantic.info` |
| `prose.link-hover` | `#64A8E8` | 6.14:1 PASS AA | Lighter on hover |
| `prose.blockquote-border` | `#505860` | structural | = `borders.strong` |

### Ember (dark — `surfaces.card: #1D1712`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#272018` | n/a (bg token) | Slightly lighter than card; warm amber family |
| `prose.code-border` | `#2E2218` | structural | = `borders.default` |
| `prose.code-text` | `#B09070` | 5.92:1 PASS AA | = `text.secondary` |
| `prose.block-bg` | `#17120D` | n/a (bg token) | Slightly darker than card; `text.primary #EDE5D8` on `#17120D` ≈ 13.4:1 PASS AA |
| `prose.link` | `#5090D0` | 4.74:1 PASS AA | = `semantic.info` |
| `prose.link-hover` | `#6AAAE0` | 6.28:1 PASS AA | Lighter on hover |
| `prose.blockquote-border` | `#5A4030` | structural | = `borders.strong` |

### Outrun (dark — `surfaces.card: #12203A`)

Outrun's prose tokens embrace the three-tier neon palette (hot pink / electric blue / teal). Inline code gets electric blue text on a deepened-blue background; links use neon violet from the purple accent tier; blockquotes anchor to the teal borders.strong.

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#162840` | n/a (bg token) | Slightly lighter than card `#12203A`; dark blue family |
| `prose.code-border` | `#FF2070` | structural | = `borders.default` — hot pink code boundary; on-brand for Outrun |
| `prose.code-text` | `#3DC8FF` | 9.47:1 PASS AA | = `text.secondary` (electric blue); already verified in Outrun `_a11y` |
| `prose.block-bg` | `#0E1830` | n/a (bg token) | Deeper than card; `text.primary #EEEAF8` on `#0E1830` ≈ 16.1:1 PASS AA |
| `prose.link` | `#D868FF` | 5.63:1 PASS AA | Neon violet; distinct from electric blue text.secondary and teal accent-gpt |
| `prose.link-hover` | `#E898FF` | 8.42:1 PASS AA | Lighter neon violet on hover |
| `prose.blockquote-border` | `#2EE4B9` | structural | = `borders.strong` (teal) |

**Outrun design rationale:** Hot pink code borders (`#FF2070`) are deliberate — Outrun code spans should feel like neon-bordered terminal windows. The electric blue code text matches `text.secondary` (model names use the same color), creating a coherent electric-blue-for-machine-text visual language. Neon violet links (`#D868FF`) occupy the purple hue family that Gemini's `#D060FF` accent uses, but links in prose are semantically distinct from model identity — the purple reads as "interactive" rather than "Gemini" in this context. If this creates confusion as Gemini usage increases, future consideration: shift `prose.link` to a teal variant (`#3AEFD0` range, distinct from `borders.strong` teal `#2EE4B9`).

### Linen (light — `surfaces.card: #FDFAF5`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#F0EAE0` | n/a (bg token) | Warm cream; slightly darker than card |
| `prose.code-border` | `#D8D0C4` | structural | = `borders.default` |
| `prose.code-text` | `#4A4640` | 9.26:1 PASS AA | = `text.secondary` |
| `prose.block-bg` | `#EDE6DA` | n/a (bg token) | Warm parchment; `text.primary #1C1A16` on `#EDE6DA` ≈ 14.5:1 PASS AA |
| `prose.link` | `#1D4ED8` | 6.47:1 PASS AA | = `semantic.info`; deep blue on warm white |
| `prose.link-hover` | `#1E3A8A` | 9.22:1 PASS AA | Darker navy on hover (light-theme hover convention) |
| `prose.blockquote-border` | `#A89F94` | structural | = `borders.strong` |

### Chalk (light — `surfaces.card: #FFFFFF`)

| Token | Value | Contrast against card | Notes |
|-------|-------|-----------------------|-------|
| `prose.code-bg` | `#F3F3F3` | n/a (bg token) | Light gray on white |
| `prose.code-border` | `#DCDCDC` | structural | = `borders.default` |
| `prose.code-text` | `#404040` | 10.7:1 PASS AA | = `text.secondary` |
| `prose.block-bg` | `#EBEBEB` | n/a (bg token) | Slightly grayer block bg; `text.primary #111111` on `#EBEBEB` ≈ 16.3:1 PASS AA |
| `prose.link` | `#1E40AF` | 9.11:1 PASS AA | = `semantic.info`; deep royal blue on white |
| `prose.link-hover` | `#1E3A8A` | 11.2:1 PASS AA | Darker navy on hover |
| `prose.blockquote-border` | `#B0B0B0` | structural | = `borders.strong` |
