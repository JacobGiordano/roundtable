# Roundtable Design Brief

**Owner:** Luma  
**Status:** Complete — no TBDs  
**Last updated:** 2026-06-08

This document captures the finalized design decisions for Roundtable. It is the north-star reference for any agent doing visual work. Every value here is a decision, not a suggestion.

---

## Design Principle

**The interface recedes. Content leads.**

Roundtable exists to surface model responses side by side. The chrome — sidebar, input bar, model selectors — should disappear into the background. Neutral surfaces, restrained typography, and color used only where it carries meaning. The one deliberate exception is model identity: accent colors are bright, consistent, and load-bearing. Everything else defers to the content.

This is an editorial neutral aesthetic. Not minimal for minimalism's sake — every surface serves a reading task.

---

## Model Identity Palette

Each model has a fixed color family. The exact hex shifts slightly per theme to suit the background, but the family is constant and the model must be recognizable across all themes without reading a label.

| Model | Family | Role |
|-------|--------|------|
| Claude (Anthropic) | Amber / orange | Warm, distinctive |
| GPT (OpenAI) | Teal / cyan-green | Cool, technical |
| Gemini (Google) | Purple / violet | Rich, distinctive |
| Other / unknown | Coral / salmon | Warm-neutral fallback |

### Accent values per theme

| Theme | Mode | Claude (amber) | GPT (teal) | Gemini (purple) | Other (coral) |
|-------|------|----------------|------------|-----------------|---------------|
| Slate | dark | `#F59E0B` | `#14B8A6` | `#A855F7` | `#F97316` |
| Midnight | dark | `#FBB034` | `#00CDB8` | `#B06EFF` | `#FF7A52` |
| Ash | dark | `#E8943A` | `#3DB8A8` | `#9B72DB` | `#E07060` |
| Ember | dark | `#F5A623` | `#2DB8A8` | `#C080F0` | `#E06840` |
| Outrun | dark | `#FFE600` | `#00FFFF` | `#BF00FF` | `#FF00AA` |
| Linen | light | `#B45309` | `#0F766E` | `#7E22CE` | `#C2410C` |
| Chalk | light | `#B45309` | `#0F766E` | `#6D28D9` | `#C2410C` |

Dark themes use brighter, more saturated hues that read against dark surfaces. Light themes use deeper, more saturated hues for contrast against light surfaces. The perceptual family — amber, teal, purple, coral — is preserved in all cases.

---

## Accent Usage Rules

Model accent colors have exactly three sanctioned uses. Any use outside these three is wrong.

### 1. Message bubble left border — 3px solid accent

```
border-left: 3px solid {accents.model-*}
```

The primary identity signal. Spans the full height of the bubble. No gap, no rounded cap treatment — standard CSS border behavior at the intersection with `border-radius: 8px` is acceptable. No other borders on the bubble. Background remains `{surfaces.card}` — the accent never fills the bubble background.

### 2. Model identity dots — 7px filled circle

Used in: Model Identity Pills (selector panel) and Sidebar Thread Rows (participating model dots).

- Pills: `7px` diameter, `border-radius: 9999px`, `background-color: {accents.model-*}`
- Sidebar dots: `6px` diameter, `border-radius: 9999px`, `background-color: {accents.model-*}`
- Inactive pill dot: `opacity: 0.4` on the dot element (CSS opacity — not a computed hex)

### 3. Sidebar active thread indicator — 2px left border

```
border-left: 2px solid {borders.strong}
```

Note: the sidebar active thread indicator uses `{borders.strong}`, not a model accent — it indicates the selected thread, not a model. It is listed here to document the boundary: model accents are not used for navigation state.

### What accents never do

- Never fill a message bubble background
- Never fill a pill background (pills use `{interactive.hover}` for their fill)
- Never appear as text color in body content
- Never used for semantic states (error, warning, info, success — those use `{semantic.*}` tokens)
- The one explicit exception: `{accents.model-claude}` is used as the send button background across all themes. This is a deliberate, named exception — not a precedent.

---

## Send Button Exception

The send button uses `{accents.model-claude}` (amber) as its active background color across all 7 themes. Rationale: the send button is the primary action surface and needs a consistent, warm, actionable color. Claude's amber family reads well at all brightness levels across all themes including Outrun where it becomes `#FFE600` — bright, energetic, appropriate. This is a one-time exception to the "accents are for model identity" rule. It is documented here so no agent treats it as a precedent for additional accent repurposing.

---

## The 7 Built-in Themes

### Slate (dark) — default

A cool blue-grey dark theme. The foundational dark experience. Most neutral of the dark themes.

- Background: `#0F1117` (near-black with blue undertone)
- Card: `#1A1D26`
- Sidebar: `#13151C`
- Input: `#1F2230`
- Text primary: `#E8EAF0` / secondary: `#A0A8BC` / muted: `#7A82A0`
- Borders: default `#2A2E3D` / subtle `#1E2130` / strong `#4A5068`
- Focus ring: `#F59E0B` (matches Claude amber)

### Midnight (dark)

Deeper and cooler than Slate. Near-black backgrounds, higher contrast. For users who want maximum depth.

- Background: `#060B18`

### Ash (dark)

Warm-neutral dark. Grey with slight warmth, no blue undertone. Softer than Slate.

- Background: `#181A1C`

### Ember (dark)

Dark theme with warm brown undertone. The darkest warm option.

- Background: `#110D09` (dark warm brown-black)

### Chalk (light)

Pure near-white light theme. Clean, high contrast, clinical.

- Background: `#F8F8F8`

### Linen (light)

Warm off-white light theme. Cream undertone. More comfortable for long reading sessions than Chalk.

- Background: `#F5F0E8` (warm cream)

### Outrun (dark)

The creative showcase theme. Neon-on-black. Explicitly not neutral — designed to be expressive and electric. Every other design rule about restraint is suspended for Outrun. Borders glow. Model accents saturate to maximum. Entering Outrun has a unique flash transition.

- Background: `#0D0D0D` (near-pure black)
- Accent colors at maximum saturation: Claude `#FFE600`, GPT `#00FFFF`, Gemini `#BF00FF`, Other `#FF00AA`
- Outrun's decorative neon border values (`borders.default: #FF00AA`, `borders.strong: #00FFFF`) are exempt from WCAG text contrast requirements — they are structural/decorative, never used as text color
- Shadow values are neon glow (`box-shadow` with rgba neon color) — Aria must not flatten these to standard drop shadows

### Mode summary

| Theme | Mode |
|-------|------|
| Slate | dark |
| Midnight | dark |
| Ash | dark |
| Ember | dark |
| Outrun | dark |
| Linen | light |
| Chalk | light |

---

## Theming System

### Architecture

Themes are JSON files conforming to the schema in `tokens/schema.md`. At runtime, JavaScript reads the active theme and writes each token as a CSS custom property on `:root`. Tailwind classes reference these custom properties via `tailwind.config.js` extensions. No hardcoded hex values anywhere in component code — all colors come through tokens.

### JSON Override Support

Custom themes can be loaded by providing a valid JSON file matching the token schema. Gate is responsible for validating the JSON before applying it. Validation rules:

1. All top-level keys present: `name`, `mode`, `surfaces`, `text`, `borders`, `accents`, `interactive`, `semantic`, `radius`, `spacing`, `shadow`, `timing`
2. All nested keys present within each group
3. `mode` is exactly `"dark"` or `"light"`
4. All color values are 6-digit hex strings beginning with `#`
5. `radius`, `spacing`, and `timing` values match the fixed values from the schema exactly
6. `shadow.none` is exactly `"none"`
7. Shadow strings are loose-validated — any valid CSS `box-shadow` string is accepted

A JSON that fails validation is rejected with an error; the current theme is unchanged.

### CSS Custom Property Names

| Category | Format | Example |
|----------|--------|---------|
| Surfaces | `--surface-{key}` | `--surface-bg`, `--surface-card` |
| Text | `--text-{key}` | `--text-primary`, `--text-muted` |
| Borders | `--border-{key}` | `--border-default`, `--border-strong` |
| Accents | `--accent-{model}` | `--accent-claude`, `--accent-gpt` |
| Interactive | `--interactive-{key}` | `--interactive-hover`, `--interactive-focus` |
| Semantic | `--semantic-{key}` | `--semantic-error`, `--semantic-success` |
| Radius | `--radius-{key}` | `--radius-md`, `--radius-full` |
| Shadow | `--shadow-{key}` | `--shadow-sm`, `--shadow-lg` |
| Timing | `--timing-{key}` | `--timing-fast`, `--timing-slow` |

Full Tailwind config mapping is in `specs/tailwind-mapping.md`.

### Fixed vs. variable tokens

Tokens in `radius`, `spacing`, and `timing` are **fixed** — every theme uses identical values. They are included in the theme JSON for schema consistency, but Aria can hardcode these from the constants below rather than reading them per-theme. Color, surface, border, shadow, and semantic tokens **vary** per theme.

**Fixed values (all themes):**
- `radius`: 4px / 8px / 12px / 9999px
- `spacing`: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px (4-point base)
- `timing`: 0ms / 100ms / 200ms / 350ms

---

## Accessibility

All text-on-background pairings have been verified at WCAG AA (4.5:1 minimum for body text, 3:1 for large text ≥18px / ≥24px bold). `text.muted` values were adjusted upward in Slate, Midnight, Ash, Ember, and Outrun to clear the 4.5:1 minimum. All 7 themes pass.

Decorative elements exempt from contrast requirements:
- 3px left border on message bubbles (decorative accent, not text)
- 7px / 6px model identity dots (decorative, not text)
- Outrun neon border values (`#FF00AA`, `#00FFFF`) — decorative structural borders, never used as text color

---

## Typography Scale

No custom fonts. System font stack. Sizes and weights are component-specific — see `specs/components.md` for per-component values. The common values:

| Use | Size | Weight | Notes |
|-----|------|--------|-------|
| Message body | 15px | 400 | `line-height: 1.6` |
| Input text | 15px | 400 | `line-height: 1.5` |
| Model name header | 12px | 600 | uppercase, `letter-spacing: 0.04em` |
| Pill label | 13px | 500 | — |
| Thread title | 13px | 500 | truncated |
| Timestamp | 11px | 400 | `{text.muted}` |
| Section labels | 11px | 600 | uppercase, `letter-spacing: 0.06em` |

---

## Spacing System

4-point base. Tailwind's default spacing scale matches — no custom config needed for spacing utilities.

| Token | Value | Tailwind |
|-------|-------|----------|
| `spacing.1` | 4px | `p-1`, `m-1`, `gap-1` |
| `spacing.2` | 8px | `p-2`, `m-2`, `gap-2` |
| `spacing.3` | 12px | `p-3`, `m-3`, `gap-3` |
| `spacing.4` | 16px | `p-4`, `m-4`, `gap-4` |
| `spacing.6` | 24px | `p-6`, `m-6`, `gap-6` |
| `spacing.8` | 32px | `p-8`, `m-8`, `gap-8` |
| `spacing.12` | 48px | `p-12`, `m-12` |
| `spacing.16` | 64px | `p-16`, `m-16` |

---

## Layout Constants

- **Sidebar width:** 256px fixed. Not resizable in Phase 1.
- **Conversation column max-width:** 720px, centered. (Recommendation — Aria owns this decision.)
- **Input bar:** Fixed to bottom of conversation column. `min-height: 64px`, grows to `200px` max.
- **Thread title default:** First 40 characters of the first user message, newlines stripped.

---

## Motion Summary

Full motion specs in `specs/motion.md`. Key decisions:

- Streaming token chunks fade in at `100ms ease-out`. Bubbles enter at `350ms cubic-bezier(0.22, 1, 0.36, 1)`.
- Multi-model bubble stagger: `100ms` between bubbles.
- Model selector open: `200ms ease-out`. Close: `100ms ease-in`. Asymmetry is intentional — reveal is deliberate, dismiss is fast.
- Theme switch: `350ms ease` on color properties only. Shadow snaps.
- Outrun entry: neon flash overlay at 20% `#FF00AA` for `100ms`, then fades. Box shadows animate in at `350ms`. Outrun exit is calm — `350ms ease`, no flash.
- `prefers-reduced-motion`: all decorative animations removed. State-communicating animations replaced with static equivalents (static cursor, static streaming border). Theme switches snap instantly.

---

## What Aria Must Never Do

- Hardcode any hex color in component code. All colors through token classes.
- Add design elements not specified in `specs/components.md` — if something is missing, ask Luma.
- Use Tailwind's default color palette (`bg-blue-500`, etc.) in component code.
- Apply accent colors as background fills on message bubbles.
- Flatten Outrun's neon glow shadows to standard drop shadows.
- Make a design decision independently — ambiguity → Luma.
