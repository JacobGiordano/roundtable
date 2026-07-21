# Custom themes

Roundtable ships with 7 built-in themes (Midnight, Slate, Ash, Chalk, Ember,
Linen, Outrun). If none of them fit, you can write your own as a JSON file and
import it in the app.

Custom themes use the same token schema as the built-in ones. The import button
runs a full validator against that schema — a malformed file is rejected with
field-level error messages before anything is applied to the UI.

---

## How to import a custom theme

1. Write your theme JSON (see [Minimal valid example](#minimal-valid-example) below).
2. Open **Settings → Appearance → Themes**.
3. Click **Import theme**.
4. Select your `.json` file.

If validation passes, the theme appears in the theme picker immediately. It is
stored in your browser's localStorage under the same key as other app settings.

---

## Token schema reference

Every field in every section is required. There are no optional fields. A theme
file that omits any field fails validation.

### Top-level structure

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Display name shown in the theme picker. Must be non-empty. |
| `mode` | `"dark"` or `"light"` | Must be exactly one of these two strings. |
| `surfaces` | object | Background colors for the four main surface areas. |
| `text` | object | Text colors. |
| `borders` | object | Border colors. |
| `accents` | object | Model identity colors and user identity color. |
| `interactive` | object | Hover, active, and focus ring colors. |
| `semantic` | object | Status colors: success, warning, error, info. |
| `radius` | object | Border radius values — fixed, must match schema exactly. |
| `spacing` | object | Spacing scale values — fixed, must match schema exactly. |
| `shadow` | object | Box shadow strings for three elevation levels plus `none`. |
| `timing` | object | Animation duration values — fixed, must match schema exactly. |
| `prose` | object | Colors for markdown-rendered content inside message bubbles. |

### surfaces

All values: 6-digit hex color (`#RRGGBB`).

| Field | Purpose |
|-------|---------|
| `surfaces.background` | Root app background — the color behind everything. In dark themes, typically the darkest surface. |
| `surfaces.card` | Message bubble and conversation card background. Should be perceptibly distinct from `background`. |
| `surfaces.sidebar` | Sidebar panel that holds the thread list. |
| `surfaces.input` | Input bar container. Visually distinct from `card` — this is an action zone, not a reading zone. |

### text

All values: 6-digit hex color. All four colors must pass WCAG AA 4.5:1 contrast
against the surfaces they appear on.

| Field | Purpose |
|-------|---------|
| `text.primary` | Body copy, message content. Must pass 4.5:1 against `surfaces.background` and `surfaces.card`. |
| `text.secondary` | Model name labels in message headers, thread titles in the sidebar. |
| `text.muted` | Timestamps, placeholder text, secondary metadata. |
| `text.inverse` | Text on accent-colored backgrounds (e.g. send button). Must pass 4.5:1 against the accent it sits on. |

### borders

All values: 6-digit hex color.

| Field | Purpose |
|-------|---------|
| `borders.default` | Standard card and panel borders. |
| `borders.subtle` | Hairline dividers between messages, between sidebar items. Should be nearly invisible — structural, not decorative. |
| `borders.strong` | Focused input outline, emphasized borders. Must be visibly different from `default`. |

### accents

All values: 6-digit hex color. These are **load-bearing** — they are the
primary signal users use to identify which model produced which message. They
appear as 3px left-border accents on message cards. Each one must be visually
distinct from the others at a glance.

| Field | Model | Hue family |
|-------|-------|------------|
| `accents.model-claude` | Claude (Anthropic) | Amber/orange |
| `accents.model-gpt` | GPT (OpenAI) | Teal/cyan-green |
| `accents.model-gemini` | Gemini (Google) | Purple/violet |
| `accents.model-other` | Any other/unknown model | Coral/salmon |
| `accents.model-grok` | Grok (xAI) | Sky/electric blue (~210°) |
| `accents.model-deepseek` | DeepSeek | Cobalt/royal blue (~230–235°) |
| `accents.model-mistral` | Mistral | Rose/hot pink (~340–350°) |
| `accents.user` | You (the human sender) | Periwinkle/indigo |

You can shift saturation and brightness to match your theme's palette, but keep
each accent in its characteristic hue family. A user who switches between themes
should still recognize which model produced which message without re-learning the
color map.

### interactive

All values: 6-digit hex color.

| Field | Purpose |
|-------|---------|
| `interactive.hover` | Background tint on mouse hover (sidebar items, buttons, pills). Specify as an explicit hex — do not use CSS opacity. |
| `interactive.active` | Background tint on pressed/active state. Typically slightly darker or more saturated than `hover`. |
| `interactive.focusRing` | Keyboard focus outline. Must be clearly visible against all theme surfaces. |

### semantic

All values: 6-digit hex color.

| Field | Meaning |
|-------|---------|
| `semantic.success` | Positive confirmation — API key valid, model connected. |
| `semantic.warning` | Degraded but functional — rate limited, slow response. |
| `semantic.error` | Error text and icons on dark surfaces. Must pass 4.5:1 against `interactive.hover` and all theme surfaces. |
| `semantic.error-bg` | Background of destructive buttons. White text (`#FFFFFF`) appears on top of this color, so it must pass 4.5:1 against white. |
| `semantic.info` | Neutral informational — streaming in progress, loading. |

> **`error` and `error-bg` are not interchangeable.** `semantic.error` is a
> bright foreground color designed to be readable on dark surfaces.
> `semantic.error-bg` is a dark background color designed to hold white text on
> top of it. In dark themes, these values differ significantly. In light themes,
> they are typically the same value (a dark red that already passes white).
> Using `semantic.error` as a button background with white text will fail
> contrast in dark themes.

### radius

Values are fixed — they must match exactly. Do not change them.

| Field | Required value |
|-------|---------------|
| `radius.sm` | `"4px"` |
| `radius.md` | `"8px"` |
| `radius.lg` | `"12px"` |
| `radius.full` | `"9999px"` |

### spacing

Values are fixed — they must match exactly. Do not change them.

| Field | Required value |
|-------|---------------|
| `spacing.1` | `"4px"` |
| `spacing.2` | `"8px"` |
| `spacing.3` | `"12px"` |
| `spacing.4` | `"16px"` |
| `spacing.6` | `"24px"` |
| `spacing.8` | `"32px"` |
| `spacing.12` | `"48px"` |
| `spacing.16` | `"64px"` |

### shadow

`shadow.none` must be exactly the string `"none"`. The other three values are
any valid CSS `box-shadow` string. They may vary per theme — darker shadows
typically work better on dark themes, lighter shadows on light themes.

| Field | Elevation |
|-------|-----------|
| `shadow.none` | Must be exactly `"none"` |
| `shadow.sm` | Subtle depth — card edges, barely-floating elements |
| `shadow.md` | Card elevation — message cards, panels |
| `shadow.lg` | Modal and overlay elevation — model selector, dropdowns |

### timing

Values are fixed — they must match exactly. Do not change them.

| Field | Required value |
|-------|---------------|
| `timing.instant` | `"0ms"` |
| `timing.fast` | `"100ms"` |
| `timing.medium` | `"200ms"` |
| `timing.slow` | `"350ms"` |

### prose

All values: 6-digit hex color. Applied to markdown-rendered content inside
message bubbles.

| Field | Purpose |
|-------|---------|
| `prose.code-bg` | Inline `` `code span` `` background. Should be perceptibly distinct from `surfaces.card`. |
| `prose.code-border` | 1px border on inline code spans. Must pass 3:1 against `surfaces.card` (UI component contrast). |
| `prose.code-text` | Inline code text color. Must pass 4.5:1 against `surfaces.card`. |
| `prose.block-bg` | Fenced code block background. `text.primary` on this background must pass 4.5:1. |
| `prose.link` | Hyperlink color in markdown prose. Must pass 4.5:1 against `surfaces.card`. |
| `prose.link-hover` | Hyperlink hover color. Must pass 4.5:1 against `surfaces.card`. |
| `prose.blockquote-border` | Blockquote left border (3px). Must pass 3:1 against `surfaces.card`. |

---

## Minimal valid example

This is a complete, importable dark theme. Copy it, rename it, and change the
color values to build your own.

```json
{
  "name": "My Theme",
  "mode": "dark",
  "surfaces": {
    "background": "#0F1117",
    "card": "#1A1D27",
    "sidebar": "#13161F",
    "input": "#1F2333"
  },
  "text": {
    "primary": "#E8EAF0",
    "secondary": "#8B93A8",
    "muted": "#636B80",
    "inverse": "#0F1117"
  },
  "borders": {
    "default": "#252A38",
    "subtle": "#1C2030",
    "strong": "#3D4660"
  },
  "accents": {
    "model-claude": "#FBB034",
    "model-gpt": "#00CDB8",
    "model-gemini": "#B06EFF",
    "model-other": "#FF7A52",
    "model-grok": "#38B6F0",
    "model-deepseek": "#4A7FE8",
    "model-mistral": "#F05090",
    "user": "#A5B4FC"
  },
  "interactive": {
    "hover": "#1C2030",
    "active": "#252A38",
    "focusRing": "#00CDB8"
  },
  "semantic": {
    "success": "#34D399",
    "warning": "#FBBF24",
    "error": "#F87171",
    "error-bg": "#B82828",
    "info": "#60A5FA"
  },
  "radius": {
    "sm": "4px",
    "md": "8px",
    "lg": "12px",
    "full": "9999px"
  },
  "spacing": {
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "6": "24px",
    "8": "32px",
    "12": "48px",
    "16": "64px"
  },
  "shadow": {
    "none": "none",
    "sm": "0 1px 4px rgba(0,0,0,0.5)",
    "md": "0 4px 16px rgba(0,0,0,0.6)",
    "lg": "0 8px 40px rgba(0,0,0,0.7)"
  },
  "timing": {
    "instant": "0ms",
    "fast": "100ms",
    "medium": "200ms",
    "slow": "350ms"
  },
  "prose": {
    "code-bg": "#1A2035",
    "code-border": "#252A38",
    "code-text": "#8B93A8",
    "block-bg": "#0D1020",
    "link": "#60A5FA",
    "link-hover": "#93C5FD",
    "blockquote-border": "#3D4660"
  }
}
```

This file passes the validator as-is. The accent colors are borrowed from the
Midnight theme — start here and replace them with your palette.

For a light theme, change `"mode"` to `"light"` and invert the surface
luminance: surfaces go light, text goes dark, shadows go soft.

---

## Common mistakes the validator rejects

**Missing a field.**
The validator requires every field in every section. If you omit
`accents.model-mistral` or `prose.blockquote-border`, the import fails with a
field-level error naming the missing path (e.g. `"accents.model-mistral"`). The
UI shows the error inline — it tells you exactly which field is missing, not
just "invalid JSON."

**Color as a 3-digit hex.**
`#FFF` is not valid. All color values must be 6-digit hex with a `#` prefix:
`#FFFFFF`. Shorthand hex, RGB, HSL, and named colors (`white`, `red`) are all
rejected.

**Color without the `#` prefix.**
`FFFFFF` is not valid. The `#` is required.

**Wrong `mode` value.**
`"mode": "Dark"` (capital D), `"mode": "night"`, and `"mode": true` are all
rejected. The value must be exactly the string `"dark"` or `"light"`.

**Wrong radius, spacing, or timing values.**
These sections have exact required values. `"radius.sm": "5px"` is rejected —
the validator expects exactly `"4px"`. Do not change these values. They are
layout constants shared across the component system, not stylistic choices.

**`shadow.none` as anything other than `"none"`.**
`"shadow.none": "0"`, `"shadow.none": ""`, and `"shadow.none": null` are all
rejected. It must be exactly the string `"none"`.

**`shadow.sm/md/lg` as an empty string.**
Shadow values for `sm`, `md`, and `lg` must be non-empty strings. An empty
string `""` fails. A comment string like `"/* none */"` passes the validator
but will render incorrectly — provide a real CSS `box-shadow` value.

**`name` as an empty string.**
`"name": ""` is rejected. The display name must contain at least one
non-whitespace character.

**The file is a JSON array.**
The validator expects a single JSON object. A file that starts with `[` is
rejected immediately with: `Theme must be a JSON object`.

---

## Tips

### Start from an existing theme

The built-in themes live in `/_design/themes/` in the repository. Copy one
that is closest to your target (light or dark, warm or cool) and modify it.
This guarantees you have the correct structure and all required fields.

### Keep accent hues in their family

Model identity colors are the primary way users distinguish messages in a busy
conversation. You can shift saturation and brightness per theme, but keep each
accent in its characteristic hue family. A user who switches between themes
should still recognize which model they are reading without re-learning the
color map.

### Verify contrast before sharing

The validator checks structure, not accessibility. A structurally valid theme
can still fail WCAG contrast requirements. Before sharing a theme, verify:

- `text.primary`, `text.secondary`, and `text.muted` against all four surfaces
- `text.inverse` against any accent color it appears on top of
- `semantic.error` against `interactive.hover` (the most likely failure point in dark themes)
- `semantic.error-bg` against `#FFFFFF`
- `prose.link` and `prose.link-hover` against `surfaces.card`

Target 4.5:1 for normal text, 3:1 for large text and UI components (borders,
graphical elements). [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
is a free tool for this.

### The `_a11y` key

The built-in themes include a `_a11y` metadata block that documents
accessibility fix history. The validator ignores unknown keys — you can include
your own `_a11y` block, or any other metadata key, and it will not affect
import. It is documentation only and has no effect on how the theme renders.

### Light theme shadows

Dark themes typically use `rgba(0,0,0,0.5–0.7)` alpha in shadow values. Light
themes need lighter shadows — `rgba(0,0,0,0.08–0.14)` is a common range. A
shadow that looks subtle on a dark background will look heavy and wrong on a
light one.
