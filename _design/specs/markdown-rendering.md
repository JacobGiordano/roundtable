# Markdown Rendering Spec — Issue #409

**Owner:** Luma
**Status:** Complete — no TBDs
**Last updated:** 2026-07-15
**Implements:** Issue #409 — render markdown in model response bubbles

---

## Relationship to Existing Specs

This document is the full rendering spec for issue #409. It does not duplicate token definitions — those live in `specs/markdown.md` (prose token values per theme) and `tokens/schema.md` (token schema). This document covers:

- Which elements to render in v1
- Visual treatment for every element using Tailwind utility classes
- Copy-code button spec
- Accessibility requirements
- Security requirements
- Library recommendation

When a treatment references a token (e.g. `bg-code-block`), that token is defined in `specs/markdown.md` and mapped to a CSS custom property in `specs/tailwind-mapping.md`. Do not invent new tokens; consume what exists.

---

## 1. Element Scope — v1

### In scope (v1 must render these)

| Element | Markdown syntax |
|---------|----------------|
| Fenced code blocks | ` ```lang\ncode\n``` ` |
| Inline code | `` `code` `` |
| Bold | `**bold**` or `__bold__` |
| Italic | `*italic*` or `_italic_` |
| Bold + italic | `***bold italic***` |
| Heading h1 | `# Heading` |
| Heading h2 | `## Heading` |
| Heading h3 | `### Heading` |
| Unordered list | `- item` or `* item` |
| Ordered list | `1. item` |
| Nested lists | Indented list items (one level of nesting minimum) |
| Blockquotes | `> quoted text` |
| Hyperlinks | `[label](url)` |
| Horizontal rule | `---` |
| Paragraph breaks | Blank line between blocks |
| Strikethrough | `~~text~~` (GFM extension) |

### Out of scope (v1 explicitly excludes)

| Element | Reason | v1 fallback / future |
|---------|--------|---------------------|
| Tables | Layout complexity; models frequently produce malformed table markdown | Render as code block (raw markdown text) in v1 |
| Images | Model outputs do not include embedded images in markdown | Revisit when image-gen output lands in bubbles |
| Task lists | `- [ ] item` checkbox rendering | Phase 2 |
| Footnotes | Rare in model output | Phase 2 |
| Math / LaTeX | Requires separate parser (KaTeX/MathJax); significant bundle cost | Separate issue — do not block #409 |
| Raw HTML | Sanitization surface area; models rarely need it | Intentionally omitted — sanitize and strip |
| Syntax highlighting | Color-coded code tokens | Separate issue; code blocks render in monospace on `bg-code-block` without highlighting in v1 |

**Table fallback (v1):** When react-markdown encounters a `table` node, render it inside a `<pre>` block showing the raw markdown source. Classes: `bg-code-block rounded-md p-4 overflow-x-auto my-3 text-sm font-mono`. This preserves the data without broken layout. Aria implements this as a custom `table` component override.

---

## 2. Visual Treatment Per Element

All class names are Tailwind v3 utility classes. Token-backed values (e.g. `bg-code-block`) are defined in `specs/tailwind-mapping.md` and `specs/markdown.md`. No inline styles. No hardcoded hex values.

### 2.1 Fenced Code Blocks

Wrapper element: `<pre>` rendered as a custom component.

```
className="relative bg-code-block rounded-md p-4 overflow-x-auto my-3 text-sm font-mono leading-relaxed"
```

- **Background**: `bg-code-block` (maps to `--prose-block-bg`, varies per theme — darker than card in dark themes, tinted parchment/gray in light themes)
- **Border-radius**: `rounded-md` (8px — `{radius.md}`)
- **Padding**: `p-4` (16px all sides — `{spacing.4}`)
- **Overflow**: `overflow-x-auto` — long lines scroll horizontally; no line wrapping
- **Vertical margin**: `my-3` (12px top and bottom — `{spacing.3}`) — creates visual separation from surrounding prose
- **Font**: `font-mono` — system monospace stack
- **Font size**: `text-sm` (14px)
- **Line height**: `leading-relaxed` (1.625) — code blocks benefit from generous line height for readability
- **Position**: `relative` — required to position the copy-code button (see section 4)
- **Text color**: `text-text-primary` — inherits from bubble body; no custom code block text token. `text.primary` on `prose.block-bg` passes WCAG AA in all 7 themes (contrast ratios verified in `specs/markdown.md`).

Add `group` to the `<pre>` wrapper (alongside the classes above) to enable `group-hover:` on the copy button.

The inner `<code>` element inside `<pre>` receives no additional classes — unstyled so the `<pre>` wrapper controls all appearance.

### 2.2 Inline Code

Element: `<code>` rendered as a custom component (when `inline === true`).

```
className="bg-code border border-code text-code-text rounded-sm px-1 py-0.5 font-mono text-[13px] whitespace-nowrap"
```

- **Background**: `bg-code` (maps to `--prose-code-bg`)
- **Border**: `border border-code` — 1px solid, maps to `--prose-code-border`
- **Text color**: `text-code-text` (maps to `--prose-code-text` = `text.secondary` in all themes)
- **Border-radius**: `rounded-sm` (4px — `{radius.sm}`)
- **Padding**: `px-1 py-0.5` (4px horizontal, 2px vertical)
- **Font**: `font-mono`
- **Font size**: `text-[13px]` — 1px smaller than surrounding prose to maintain visual flow
- **Wrapping**: `whitespace-nowrap` — inline code spans do not wrap mid-token. If a span is longer than the container, Aria may use `whitespace-pre-wrap` to avoid layout overflow on very long identifiers.

### 2.3 Bold

Element: `<strong>`.

```
strong: ({ children }) => <strong className="font-semibold">{children}</strong>
```

- **Weight**: `font-semibold` (600). Not `font-bold` (700) — 600 provides sufficient emphasis without competing with headings.
- **Color**: inherits `text-text-primary` from bubble body.

### 2.4 Italic

Element: `<em>`.

```
em: ({ children }) => <em className="italic">{children}</em>
```

- **Style**: `italic`. No color change. No weight change.

### 2.5 Headings

All headings use `text-text-primary`. Sizes use Tailwind's scale. Vertical margin creates breathing room between heading and following content.

| Element | Classes |
|---------|---------|
| `<h1>` | `text-xl font-bold mt-5 mb-2 text-text-primary leading-snug` |
| `<h2>` | `text-lg font-semibold mt-4 mb-2 text-text-primary leading-snug` |
| `<h3>` | `text-base font-semibold mt-3 mb-1 text-text-primary leading-snug` |

- **h1**: `text-xl` (20px), `font-bold` (700), `mt-5` (20px top margin).
- **h2**: `text-lg` (18px), `font-semibold` (600), `mt-4` (16px top margin).
- **h3**: `text-base` (16px — same size as body prose), `font-semibold` (600), `mt-3` (12px top margin). Differentiated from body by weight alone at this size.
- **Bottom margin**: `mb-2` (8px) for h1/h2; `mb-1` (4px) for h3 — tighter coupling to following content is intentional for h3.
- **Line height**: `leading-snug` (1.375) — headings are shorter text; tighter line height is appropriate.

Design note: model responses rarely use h1. h1 inside a conversation bubble is visually large. The size is preserved for correctness in v1; heading scale within bubbles can be revisited in a follow-on issue.

### 2.6 Unordered Lists

Element: `<ul>` with `<li>` children.

```
ul: className="list-disc list-outside pl-5 my-2 space-y-1 text-text-primary"
li: className="leading-relaxed"
```

- **Marker**: `list-disc` — filled circle bullet.
- **Position**: `list-outside` — bullet sits outside the text column; wrapped lines do not hang under the bullet marker.
- **Indent**: `pl-5` (20px left padding on `<ul>`, not `<li>`)
- **Item spacing**: `space-y-1` (4px gap between `<li>` elements)
- **Block margin**: `my-2` (8px top and bottom)
- **Text color**: `text-text-primary` on `<ul>`; `<li>` inherits.
- **Line height**: `leading-relaxed` on `<li>` — multi-line list items need breathing room.

### 2.7 Ordered Lists

Element: `<ol>` with `<li>` children.

```
ol: className="list-decimal list-outside pl-5 my-2 space-y-1 text-text-primary"
li: className="leading-relaxed"
```

- **Marker**: `list-decimal` — Arabic numerals.
- All other properties: identical to unordered lists.

### 2.8 Nested Lists

For a `<ul>` or `<ol>` appearing as a child of a `<li>`:

```
nested ul: className="list-disc list-outside pl-4 mt-1 space-y-1"
nested ol: className="list-decimal list-outside pl-4 mt-1 space-y-1"
```

- **Additional indent**: `pl-4` (16px, relative to the parent `<li>` which already carries the outer `pl-5`).
- **Top margin**: `mt-1` (4px) — tight coupling to parent list item.
- **No bottom margin** on nested lists — only the outer list carries `my-2`.
- One level of nesting is fully supported in v1. Deeper nesting degrades gracefully (same classes apply; visual indent continues to accumulate).

### 2.9 Blockquotes

Element: `<blockquote>`.

```
className="border-l-[3px] border-blockquote pl-3 my-2 italic text-text-secondary"
```

- **Left border**: `border-l-[3px] border-blockquote` — 3px left border using `--prose-blockquote-border` (= `borders.strong` in all themes). This does not compete with the former bubble-level left-border design (that design was replaced by the nameplate tint system per `components.md`).
- **Left padding**: `pl-3` (12px) — insets content from the border.
- **Vertical margin**: `my-2` (8px top and bottom).
- **Typography**: `italic text-text-secondary` — signals "quoted content, not the model's direct response."
- **Nested blockquotes**: Supported without additional classes. Each nesting level adds another left border layer; the double-border result is acceptable in v1.

### 2.10 Hyperlinks

Element: `<a>`.

```
className="text-link hover:text-link-hover underline decoration-1 underline-offset-2"
target={isExternal ? '_blank' : undefined}
rel={isExternal ? 'noopener noreferrer' : undefined}
```

- **Color**: `text-link` (maps to `--prose-link`). Values per theme in `specs/markdown.md`.
- **Hover color**: `hover:text-link-hover` (maps to `--prose-link-hover`).
- **Decoration**: `underline decoration-1 underline-offset-2` — always underlined; `decoration-1` keeps underline at 1px; `underline-offset-2` gives 2px separation from descenders.
- **External link handling**: If `href` starts with `http://` or `https://`, add `target="_blank" rel="noopener noreferrer"` and a visually-hidden screen reader announcement: `<span className="sr-only"> (opens in new tab)</span>` after the link text.
- **Unsafe scheme fallback**: See section 5 — links with non-http/https/mailto schemes render as plain `<span>` text.

### 2.11 Horizontal Rule

Element: `<hr>`.

```
className="my-4 border-t border-border-subtle"
```

- **Border**: `border-t border-border-subtle` — 1px top border, `borders.subtle` token. Minimal, structural.
- **Vertical margin**: `my-4` (16px top and bottom).

### 2.12 Paragraphs

Element: `<p>`.

```
className="leading-relaxed my-2 text-text-primary first:mt-0 last:mb-0"
```

- **Line height**: `leading-relaxed` (1.625).
- **Vertical margin**: `my-2` (8px). `first:mt-0 last:mb-0` suppresses double-spacing at the top and bottom of the bubble content zone (the bubble's own padding handles outer spacing).
- **Color**: `text-text-primary`.

### 2.13 Strikethrough

Element: `<del>` (GFM extension — requires `remark-gfm`).

```
del: ({ children }) => <del className="line-through text-text-secondary">{children}</del>
```

- **Decoration**: `line-through`.
- **Color**: `text-text-secondary` — muted relative to primary, consistent with "de-emphasized text" semantic.

---

## 3. Bubble Content Wrapper

Aria wraps the react-markdown output in a container div to scope prose styles and provide a reset baseline:

```
className="text-text-primary text-sm leading-relaxed"
```

- `text-text-primary` — default text color; all elements inherit unless overridden by their custom component class.
- `text-sm` (14px) — base prose size inside bubbles. Headings override upward via their own `text-xl`, `text-lg`, `text-base` classes.
- `leading-relaxed` (1.625) — default line height.

**Do NOT use Tailwind's `prose` plugin (Typography plugin).** The `@tailwindcss/typography` `prose` utility class applies opinionated defaults that conflict with the design token system. All styling is explicit via custom component overrides. Do not install `@tailwindcss/typography` for this feature.

---

## 4. Copy-Code Button

A "Copy" button appears on fenced code blocks only (not inline code). It is revealed on hover over the `<pre>` wrapper and on keyboard focus.

### Placement

- Positioned at the **top-right corner** of the `<pre>` block using absolute positioning.
- The `<pre>` wrapper must have `position: relative` (already included in section 2.1 as `relative`).
- Offset: `top-2 right-2` (8px from top and right edges — `{spacing.2}`).

### Visibility and Transition

The `<pre>` wrapper carries the `group` class. The button uses:

```
opacity-0 group-hover:opacity-100 focus-visible:opacity-100
transition-opacity duration-[100ms]
```

- `opacity-0` — hidden by default.
- `group-hover:opacity-100` — visible on hover of the `<pre>` wrapper.
- `focus-visible:opacity-100` — visible when the button itself receives keyboard focus, even without pointer hover.
- `transition-opacity duration-[100ms]` — `{timing.fast}` fade. Snappy; not distracting.

### Full Button Classes

```
className="absolute top-2 right-2
           opacity-0 group-hover:opacity-100 focus-visible:opacity-100
           transition-opacity duration-[100ms]
           px-2 py-1 rounded-sm
           text-[11px] font-medium leading-none
           bg-card text-text-secondary
           border border-border
           hover:bg-hover hover:text-text-primary
           focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1"
```

- **Size**: `px-2 py-1` (8px horizontal, 4px vertical). Approximate rendered height: 24px.
- **Border-radius**: `rounded-sm` (4px — `{radius.sm}`).
- **Font**: `text-[11px] font-medium leading-none` — smaller than code text; reads as a UI control, not content.
- **Background**: `bg-card` — matches the card surface. Reads as a slightly elevated chip against the darker `bg-code-block` in dark themes; slightly lighter in light themes.
- **Border**: `border border-border` — 1px border for definition.
- **Text color idle**: `text-text-secondary`. **On hover**: `hover:text-text-primary`.
- **Focus ring**: `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1` — standard project focus pattern from `specs/tailwind-mapping.md`.

### Button States and Labels

Text-only labels — no icon in v1. Eliminates icon import cost; universally understood.

| State | Label | Additional class |
|-------|-------|-----------------|
| Idle | `Copy` | — |
| Success | `Copied!` | `text-success` |
| Error | `Failed` | `text-error` |

State is held in local React state. After the copy action:
- **Success**: label changes to `Copied!` with `text-success` class. Resets to `Copy` after 2000ms.
- **Error**: label changes to `Failed` with `text-error` class. Resets to `Copy` after 2000ms.
- Aria must clear the `setTimeout` on component unmount to avoid state updates on unmounted components.

Use `aria-live="polite"` on the label span so state changes are announced to screen readers without requiring focus retention (see section 7.1).

### Copy Mechanism

```ts
navigator.clipboard.writeText(codeContent)
  .then(() => setState('copied'))
  .catch(() => setState('error'));
```

`codeContent` is the raw string content of the code block extracted from `children` before rendering. Do not copy rendered HTML — copy the original source text.

### Keyboard Access

The button is a `<button>` element (not `<div>`, not `<span>`). Reachable via Tab. Activates on Enter and Space. When no pointer hover is active, the button is `opacity-0` but present in the DOM and focusable — `focus-visible:opacity-100` makes it visible on focus. This is correct behavior: keyboard users can reach the button without a mouse.

---

## 5. Security — Model Output Is Untrusted

Model output is untrusted content from an external source. Aria must treat it accordingly.

### Sanitize before rendering

Before passing model output to react-markdown, run it through DOMPurify as a pre-processing step:

```ts
import DOMPurify from 'dompurify';

// Strip all raw HTML tags from the markdown string.
// react-markdown handles rendering — it does not need HTML in the input.
const sanitized = DOMPurify.sanitize(rawModelOutput, {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
});
// Pass `sanitized` to <ReactMarkdown>
```

**Why this approach:** DOMPurify with `ALLOWED_TAGS: []` strips any raw HTML a model might inject into its markdown output. This prevents a model from slipping HTML through if `rehype-raw` were ever accidentally enabled, or if react-markdown's handling of raw HTML in markdown strings changes across versions. Defense in depth.

### Do not enable rehype-raw

Do not pass `rehypePlugins={[rehypeRaw]}` to `<ReactMarkdown>`. Enabling raw HTML passthrough is the primary XSS vector when rendering untrusted markdown. v1 must not enable it, regardless of any future request. If raw HTML rendering is ever needed, it requires a separate security review.

### Do not use dangerouslySetInnerHTML

Never use `dangerouslySetInnerHTML` anywhere in the markdown rendering path. react-markdown produces React elements, not HTML strings. There is no reason to use `dangerouslySetInnerHTML` here.

### Link scheme validation (defense in depth)

Aria's custom `<a>` component renderer must validate href schemes before creating a link element:

```ts
const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

a: ({ href, children }) => {
  let isSafe = false;
  if (href) {
    try {
      const url = new URL(href);
      isSafe = SAFE_SCHEMES.has(url.protocol);
    } catch {
      isSafe = false; // non-parseable href — render as plain text
    }
  }
  if (!isSafe) {
    return <span>{children}</span>;
  }
  const isExternal = href!.startsWith('http');
  return (
    <a href={href}
       className="text-link hover:text-link-hover underline decoration-1 underline-offset-2"
       target={isExternal ? '_blank' : undefined}
       rel={isExternal ? 'noopener noreferrer' : undefined}>
      {children}
      {isExternal && <span className="sr-only"> (opens in new tab)</span>}
    </a>
  );
}
```

This blocks `javascript:`, `data:`, `vbscript:`, and other unsafe schemes even if DOMPurify does not catch them in the markdown string context.

### Rune review required

This issue involves rendering untrusted model output as HTML — an explicit Rune trigger per `CLAUDE.md`. Aria must include a Rune review request in the PR description before the PR is opened.

---

## 6. Library Recommendation

### Recommendation: react-markdown@^9 with remark-gfm@^4

**react-markdown** is the recommended markdown parser for this feature.

#### Why react-markdown

**1. React-native output — the primary reason.** react-markdown renders directly to React elements, not HTML strings. There is no `innerHTML`, no `dangerouslySetInnerHTML`. This eliminates an entire class of XSS vectors at the architectural level. Marked and micromark both produce HTML strings requiring separate injection into the DOM — that path has a larger attack surface.

**2. Custom component API.** The `components` prop is a clean per-element override system. Aria maps every markdown element to the exact Tailwind classes in this spec. The API is stable, well-documented, and used at scale across the React ecosystem.

**3. remark-gfm plugin.** GitHub Flavored Markdown (strikethrough, tables) is available as an official plugin (`remark-gfm`) maintained by the same organization as react-markdown. Minimal additional bundle cost (~10 kB gzipped).

**4. Sanitization story is additive, not required.** Because react-markdown does not use `innerHTML`, DOMPurify is a defense-in-depth pre-processing step rather than a mandatory DOM-injection safety net. This is the architecturally cleanest position.

#### Why not marked

- Produces an HTML string. Injecting that string into the DOM requires `dangerouslySetInnerHTML` or manual DOMPurify + `innerHTML`. Both paths are more complex and riskier than react-markdown's native React element output.
- Per-element styling requires post-processing the HTML string or wrapping the rendered output — awkward compared to react-markdown's component override API.

#### Why not micromark

- micromark is the parsing layer inside remark — it is a low-level tokenizer, not a drop-in React renderer. Using micromark directly requires building a full React rendering layer from scratch. Unnecessary complexity when react-markdown already provides this.

#### Bundle impact note

react-markdown 9.x + remark-gfm adds approximately 60–70 kB gzipped. DOMPurify adds approximately 20 kB gzipped. Total estimated addition: ~80–90 kB gzipped. The project already has a 791 kB chunk warning (HANDOFF.md). This addition is meaningful — Aria must surface the bundle delta in the PR description and tag Tempo for a post-implementation bundle audit.

#### Dependency additions

```
react-markdown@^9
remark-gfm@^4
dompurify@^3
@types/dompurify@^3
```

List these as new dependencies in the PR description.

---

## 7. Accessibility Notes

Ada will run a full audit after implementation. Aria should address these requirements before Ada runs.

### 7.1 Copy-code button

- Must be a `<button>` element — not a `<div>` or `<span>` with onClick.
- Accessible name: the visible text label `Copy` / `Copied!` / `Failed` is sufficient. If an icon is added in a future iteration, it must have `aria-hidden="true"` and the button must have `aria-label="Copy code"`.
- State changes must be announced to screen readers. Add `aria-live="polite"` to the label span inside the button:

```tsx
<button className="...">
  <span aria-live="polite">{label}</span>
</button>
```

This ensures `Copied!` and `Failed` are announced without requiring the button to retain focus.

### 7.2 Code blocks

- `<pre>` and `<code>` are semantic HTML. No additional ARIA attributes are needed.
- Do not add `role="region"` or `aria-label` to code blocks in v1. Over-labeling adds noise for screen reader users.

### 7.3 Links

- External links with `target="_blank"` must include `<span className="sr-only"> (opens in new tab)</span>` as specified in section 2.10. This is required — do not omit it.
- `rel="noopener noreferrer"` is both a security requirement and expected behavior.

### 7.4 Heading hierarchy

- Headings rendered inside message bubbles are semantic `<h1>`–`<h3>` HTML elements. If the page already uses `<h1>` for conversation structure (e.g. conversation title heading), model-rendered h1 elements will break the heading hierarchy.
- **Aria's decision to make**: either (a) use semantic heading elements and accept potential hierarchy issues (note it in the PR for Ada to audit), or (b) use `<p>` elements with heading-style classes and skip semantic heading elements inside bubbles.
- This spec permits semantic headings in v1 and flags it for Ada review. If Ada finds it problematic, a follow-on issue addresses it.

### 7.5 Lists

- `<ul>` and `<ol>` with `<li>` children are semantic — no ARIA needed.
- react-markdown with remark-gfm handles semantic list nesting correctly (`<ul>` inside `<li>`, not adjacent to it).

### 7.6 Blockquotes

- `<blockquote>` is semantic HTML. No `aria-label` or `role` override needed.

### 7.7 Strikethrough

- `<del>` is semantic HTML conveying deleted/removed text. Screen readers may announce it differently across implementations. This is acceptable in v1 — model responses rarely use strikethrough in a context where the "deleted text" semantic is critical.

---

## 8. Theme Compatibility

All treatments use design token Tailwind classes. Theme compatibility is structural — any theme conforming to the token schema produces correct rendering. Prose token values per theme are verified in `specs/markdown.md`.

| Class used | Token | All 7 themes |
|-----------|-------|-------------|
| `bg-code-block` | `prose.block-bg` | Verified — `text.primary` on `prose.block-bg` passes WCAG AA in all themes |
| `bg-code` | `prose.code-bg` | Background tint — perceptibly distinct from `surfaces.card` in all themes |
| `text-code-text` | `prose.code-text` = `text.secondary` | Verified WCAG AA — all themes |
| `text-link` | `prose.link` | Verified WCAG AA — all themes |
| `text-link-hover` | `prose.link-hover` | Verified WCAG AA — all themes |
| `border-blockquote` | `prose.blockquote-border` = `borders.strong` | 3:1+ structural threshold — all themes |
| `text-success` | `semantic.success` | Pre-existing token; already verified |
| `text-error` | `semantic.error` | Pre-existing token; already verified |
| `bg-card` | `surfaces.card` | Pre-existing token; already verified |
| `border-border` | `borders.default` | Pre-existing token; already verified |

**Outrun note**: The copy-code button uses `bg-card` (`#12203A`) and `text-text-secondary` (`#3DC8FF` electric blue) in Outrun — 9.47:1 contrast ratio, passes WCAG AA. Outrun's hot-pink `prose.code-border` on inline code and electric-blue `prose.code-text` are intentional neon design choices documented in `specs/markdown.md`.

---

## 9. Streaming State

Model output arrives incrementally during streaming. react-markdown re-renders as content grows. No special streaming treatment is needed for markdown rendering in v1 — the bubble's existing streaming state behavior is unchanged.

Known edge case: partial fenced code blocks (` ``` ` without a closing fence) during active streaming may render as a paragraph or inline code until the fence closes. react-markdown with remark-gfm degrades gracefully in this case — no special-casing needed. When streaming completes and the fence closes, react-markdown re-renders the block correctly.

---

## 10. Ghost Mode

No visual difference in markdown rendering for ghost mode. Ghost mode affects persistence (Vault's domain), not content rendering. All markdown treatments in this spec apply in all session modes.
