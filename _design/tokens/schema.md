# Roundtable Token Schema

This document defines the canonical JSON token structure that all 7 theme files must conform to.
Gate validates custom theme JSON against this schema. Aria maps these tokens to CSS custom properties.

Every field listed here is **required** in every theme file. No optional fields. No "TBD" values.

---

## JSON Structure

```json
{
  "name": "string — display name for the theme picker",
  "mode": "dark | light",
  "surfaces": {
    "background": "hex — page/app background",
    "card": "hex — conversation message area background",
    "sidebar": "hex — sidebar background",
    "input": "hex — input bar background"
  },
  "text": {
    "primary": "hex — body copy, message content",
    "secondary": "hex — model name labels, thread titles",
    "muted": "hex — timestamps, placeholder text, secondary metadata",
    "inverse": "hex — text on accent-colored surfaces (e.g. send button label)"
  },
  "borders": {
    "default": "hex — card borders, panel separators",
    "subtle": "hex — dividers, hairlines within cards",
    "strong": "hex — focused input outline, emphasized borders"
  },
  "accents": {
    "model-claude": "hex — Claude identity color (amber family)",
    "model-gpt": "hex — GPT identity color (teal family)",
    "model-gemini": "hex — Gemini identity color (purple family)",
    "model-other": "hex — any other/unknown model identity color (coral family)"
  },
  "interactive": {
    "hover": "hex — background tint on hover states (buttons, list items)",
    "active": "hex — background tint on pressed/active states",
    "focusRing": "hex — keyboard focus outline color"
  },
  "semantic": {
    "success": "hex — success states (API key valid, connection established)",
    "warning": "hex — warning states (rate limit, degraded)",
    "error": "hex — error foreground color: error text and icons on dark surfaces",
    "error-bg": "hex — error background color: destructive button backgrounds with white text on top",
    "info": "hex — informational states (streaming, loading)"
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
    "sm": "css box-shadow string — subtle lift",
    "md": "css box-shadow string — card elevation",
    "lg": "css box-shadow string — modal/panel elevation"
  },
  "timing": {
    "instant": "0ms",
    "fast": "100ms",
    "medium": "200ms",
    "slow": "350ms"
  }
}
```

---

## Field Definitions

### surfaces

| Token | Purpose | Notes |
|-------|---------|-------|
| `surfaces.background` | Root app background. The color behind everything. | In dark themes, typically the darkest surface. In light themes, the lightest. |
| `surfaces.card` | The message bubble / conversation card background. | Should read distinctly from `surfaces.background` — enough contrast to define the card boundary without a border if needed. |
| `surfaces.sidebar` | Sidebar panel that holds thread list. | May be slightly darker or lighter than `background` to create visual separation. |
| `surfaces.input` | Input bar container background. | Visually distinct from `card` — the input area is an action zone, not a reading zone. |

### text

| Token | Purpose | WCAG requirement |
|-------|---------|-----------------|
| `text.primary` | All message content, headings. | Minimum 4.5:1 against `surfaces.background` and `surfaces.card`. |
| `text.secondary` | Model name in message headers, thread titles in sidebar. | Minimum 4.5:1 against the surface it appears on. |
| `text.muted` | Timestamps, placeholder text, secondary labels. | Minimum 4.5:1 against the surface it appears on. (Large text exemption applies at ≥18px/24px bold — 3:1 minimum.) |
| `text.inverse` | Text on accent-colored backgrounds (e.g. send button, active state pills). | Minimum 4.5:1 against the accent color it sits on. |

### borders

| Token | Purpose |
|-------|---------|
| `borders.default` | Standard card/panel border. Defines card edges in designs that use borders rather than shadow. |
| `borders.subtle` | Hairline dividers. Between messages, between sidebar items. Should be nearly invisible — structural, not decorative. |
| `borders.strong` | Focused input, hover-emphasized borders. Visible feedback. |

### accents (model identity)

These colors are **load-bearing** — they are the primary mechanism by which users identify which model produced which message. They must be:
1. Visually distinct from each other at a glance
2. Consistent across all themes (same model, same identity — hue may shift slightly per theme but must remain recognizable)
3. Accessible as a 3px left-border accent on `surfaces.card` — no contrast requirement here (decorative use) but must be perceptible

| Token | Model | Family | Notes |
|-------|-------|--------|-------|
| `accents.model-claude` | Claude (Anthropic) | Amber/orange | Warm, distinctive. |
| `accents.model-gpt` | GPT (OpenAI) | Teal/cyan-green | Cool, techy. |
| `accents.model-gemini` | Gemini (Google) | Purple/violet | Rich, distinctive. |
| `accents.model-other` | Any other model | Coral/salmon | Warm-neutral fallback. |

### interactive

| Token | Purpose |
|-------|---------|
| `interactive.hover` | Background tint applied on mouse hover for clickable elements (sidebar items, buttons, pills). Typically a low-opacity white or black overlay on the surface color — spec as explicit hex, not as opacity. |
| `interactive.active` | Background tint on pressed/active. Slightly darker/more saturated than hover. |
| `interactive.focusRing` | Keyboard focus outline. Must be visible against all surfaces. Should match or coordinate with `accents.model-claude` in default themes. |

### semantic

| Token | Meaning |
|-------|---------|
| `semantic.success` | Positive confirmation — key valid, model connected. |
| `semantic.warning` | Degraded but functional — rate limited, slow response. |
| `semantic.error` | Failure foreground — error text and icons displayed on dark surfaces and hover backgrounds. Must pass 4.5:1 against `interactive.hover` and all theme surfaces. |
| `semantic.error-bg` | Destructive button background — used for button and control backgrounds where white text appears on top. Must pass 4.5:1 against white (`#FFFFFF`). In dark themes, this is a darker red than `semantic.error`. In light themes, `error-bg` equals `error` (the same dark red already passes white). |
| `semantic.info` | Neutral informational — streaming in progress, loading. |

**Critical usage rule**: These two tokens have incompatible luminance requirements and MUST NOT be used interchangeably:
- `bg-error-bg text-white` — destructive button pattern (error-bg is dark enough for white text)
- `text-error` — error text on a dark surface or hover state (error is bright enough to read on dark)
- `bg-error text-white` — INVALID. semantic.error is not dark enough for white text in dark themes. Use `bg-error-bg text-white` instead.

### radius

Fixed values — do not vary per theme. Themes must include these values exactly as specified.

| Token | Value | Use |
|-------|-------|-----|
| `radius.sm` | `4px` | Subtle rounding on pills, badges, small buttons |
| `radius.md` | `8px` | Cards, input fields, standard buttons |
| `radius.lg` | `12px` | Panels, modals, message bubbles |
| `radius.full` | `9999px` | Fully circular — model dots, avatar circles |

### spacing

4-point base. Values are fixed — do not vary per theme.

| Token | Value | Common use |
|-------|-------|-----------|
| `spacing.1` | `4px` | Tight gaps — icon-to-label, inner padding on badges |
| `spacing.2` | `8px` | Small gaps — between pills, between list item elements |
| `spacing.3` | `12px` | Medium-small — button padding vertical, card padding tight |
| `spacing.4` | `16px` | Standard — card horizontal padding, section gaps |
| `spacing.6` | `24px` | Medium-large — panel padding, sidebar section spacing |
| `spacing.8` | `32px` | Large — layout section gaps |
| `spacing.12` | `48px` | XL — major layout separations |
| `spacing.16` | `64px` | XXL — top-level page padding |

### shadow

Shadow values are expressed as complete CSS `box-shadow` strings. They may vary slightly per theme (darker shadows in dark themes, softer in light themes) but the semantic meaning is fixed.

| Token | Meaning | Expected feel |
|-------|---------|--------------|
| `shadow.none` | Always `"none"` | No elevation |
| `shadow.sm` | Subtle depth — card edges, floating elements that barely lift | Hairline shadow |
| `shadow.md` | Card elevation — message cards, panels | Soft, clear lift |
| `shadow.lg` | Modal/overlay elevation — model selector panel, dropdowns | Definitive separation from page |

### timing

Fixed values — do not vary per theme. All animations reference these tokens by name.

| Token | Value | Use |
|-------|-------|-----|
| `timing.instant` | `0ms` | State changes that should appear immediate (selection toggles that don't animate) |
| `timing.fast` | `100ms` | Quick feedback — hover state, button press |
| `timing.medium` | `200ms` | Standard transitions — panel open, tab switch |
| `timing.slow` | `350ms` | Deliberate transitions — theme switch, bubble entrance |

---

## Validation Rules

A theme file is valid if:
1. All top-level keys are present: `name`, `mode`, `surfaces`, `text`, `borders`, `accents`, `interactive`, `semantic`, `radius`, `spacing`, `shadow`, `timing`
   - `semantic` must contain: `success`, `warning`, `error`, `error-bg`, `info`
2. All nested keys within each category are present (no missing fields)
3. `mode` is exactly `"dark"` or `"light"`
4. All color values are valid 6-digit hex strings beginning with `#`
5. `radius` values match exactly: `"4px"`, `"8px"`, `"12px"`, `"9999px"`
6. `spacing` values match exactly: `"4px"`, `"8px"`, `"12px"`, `"16px"`, `"24px"`, `"32px"`, `"48px"`, `"64px"`
7. `timing` values match exactly: `"0ms"`, `"100ms"`, `"200ms"`, `"350ms"`
8. `shadow.none` is exactly `"none"`

Color validation for shadow strings is loose — any valid CSS box-shadow string is accepted.
