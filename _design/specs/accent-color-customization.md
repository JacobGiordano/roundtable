# Accent Color Customization — Issue #38

**Owner:** Luma  
**Pipeline:** Luma (spec) → Arch (types) → Gate (persistence) → Aria (UI)  
**Status:** Spec complete  
**Date:** 2026-06-10

---

## Overview

Users can replace the default theme accent color for any model with a color of
their choosing. The custom color persists to `localStorage` independently of the
active theme. When a custom color is set for a model, it overrides the theme's
`accents.model-*` token for that model across all themes. When cleared, the
active theme's default accent is restored.

---

## Architecture Decision: Runtime Override Layer

User-chosen colors must not modify theme JSON files. They sit in a separate
persistence store and are applied as a second pass of CSS custom property writes
after the theme loader runs.

**Two-pass color application:**

Pass 1 — theme loader (existing, unchanged):
Writes all CSS custom properties from the active theme JSON, including
`--accent-claude`, `--accent-gpt`, `--accent-gemini`, `--accent-grok`,
`--accent-deepseek`, `--accent-mistral`, `--accent-other`.

Pass 2 — user color override (new):
For each model where the user has set a custom color, overwrites the
corresponding CSS custom property on `:root`. Only models with an active
custom color are touched — unset models keep the theme default.

This means:
- Theme switching preserves user color customizations (Pass 2 re-runs after
  every theme switch).
- Clearing a custom color means removing it from the store and not writing it
  in Pass 2; the theme's value from Pass 1 takes effect.
- No theme JSON file is modified. All 7 theme files remain unchanged.

---

## Data Shape (for Arch and Gate)

### The type

```
ModelAccentColors: Record<ModelId, string>
```

Where:
- Keys are `ModelId` values: `'claude' | 'gpt-5.5' | 'gemini' | 'grok' | 'deepseek' | 'mistral'`
- Values are 6-digit uppercase hex strings beginning with `#`, e.g. `"#FF5500"`
- The record is **partial** — only models with active custom colors are present.
  Absence of a key means "use theme default." An empty object `{}` means all
  models use their theme defaults.

### Full type name and shape for Arch

```
// New type to be added to /src/types/index.ts by Arch

/**
 * User-chosen accent colors that override the active theme's accent tokens.
 * Partial record — only models with active overrides are present.
 * Values are 6-digit hex strings (e.g. "#FF5500").
 * Persisted by Gate; applied by Aria on top of the theme layer.
 */
export type ModelAccentColors = Partial<Record<ModelId, string>>;
```

### localStorage key (for Gate)

```
Key:   "roundtable:model-accent-colors"
Value: JSON.stringify(ModelAccentColors)
```

This is a separate key from theme preferences. Gate reads and writes it
independently from `ThemePreferences`.

### Default value

When the key is absent or the stored value fails to parse: `{}` (empty object,
all models use theme defaults).

### Validation rules (Gate enforces on read and write)

1. Parsed value must be a plain object (not array, not null).
2. All keys present in the object must be valid `ModelId` values.
3. All values present must be 6-digit hex strings matching the pattern
   `/^#[0-9A-Fa-f]{6}$/`.
4. Any key–value pair that fails rules 2–3 is **silently dropped** on read
   (partial corruption is recoverable). The cleaned object is used.
5. On write, Gate validates the entire new record before persisting. An invalid
   entry is rejected — the existing stored value is unchanged.
6. Maximum 6 entries (one per `ModelId`). A write that would exceed this
   limit is rejected. In practice this can never happen given the fixed
   `ModelId` union, but the guard protects against future type drift.

---

## Token Schema Changes

**No changes to the token schema (`/_design/tokens/schema.md`) or any theme
JSON file.** The existing `accents.*` tokens in the theme files represent the
theme defaults. User overrides are applied at runtime and never baked into theme
files.

**No new token categories.** User-chosen colors are not tokens — they are runtime
overrides to existing tokens. The CSS custom property names (`--accent-claude`,
`--accent-gpt`, etc.) are reused; the user override simply writes a different
value to the same property after the theme loader has set the theme default.

---

## CSS Custom Property Override (for Aria)

After applying a theme and after loading user color preferences from Gate, Aria
runs the following override pass:

```
function applyUserAccentColors(userColors: ModelAccentColors): void {
  const root = document.documentElement;
  const mapping: Record<ModelId, string> = {
    'claude':    '--accent-claude',
    'gpt-5.5':  '--accent-gpt',
    'gemini':   '--accent-gemini',
    'grok':     '--accent-grok',
    'deepseek': '--accent-deepseek',
    'mistral':  '--accent-mistral',
  };
  for (const [modelId, cssVar] of Object.entries(mapping) as [ModelId, string][]) {
    if (userColors[modelId]) {
      root.style.setProperty(cssVar, userColors[modelId]!);
    }
  }
}
```

This function is called:
1. On app load, after `applyTheme()`.
2. On every theme switch, after `applyTheme()`.
3. Immediately when the user saves a new color for a model.
4. Immediately when the user clears a custom color for a model (with an empty
   `userColors` entry removed, re-run the full pass to let the theme default
   take effect — which it already does since we never wrote the override).

There is no "clear override" call needed: if a model's key is absent from
`userColors`, we simply do not write to its CSS property, and Pass 1's theme
value persists.

**No new Tailwind keys are required.** The existing `--accent-claude`,
`--accent-gpt`, etc. CSS custom properties are already mapped. The override
writes to the same properties. All component classes (`border-accent-claude`,
`text-accent-gpt`, etc.) automatically pick up the new values.

---

## Tailwind Mapping Changes

**No changes to `/_design/specs/tailwind-mapping.md`.** The existing mapping
covers all 6 model accent CSS properties. User overrides write to the same
properties, so no new keys, no new CSS vars, no tailwind.config.js additions.

---

## Component Spec: Color Picker Popover

### Trigger — Palette Icon on Model Identity Pill

The color picker is accessed from the Model Identity Pill (the pill component
already specced in `components.md`). When the user hovers a pill in the Model
Selector Panel, a small palette icon appears on the pill. Clicking the palette
icon opens the Color Picker Popover for that model.

**Palette Icon Affordance:**
- Position: right edge of the pill, absolutely positioned within the pill
  container. The pill uses `position: relative`.
- Size: `14px × 14px`. Use an SVG palette/swatch icon (not emoji).
- Color: `{text.muted}`. On hover of the icon itself: `{text.secondary}`.
- Visibility: visible only when the containing pill is hovered or focused.
  Hidden otherwise (`opacity: 0` on the icon, `opacity: 1` on pill hover/focus).
  Transition: `timing.fast` on opacity.
- If a custom color is currently active for this model, the palette icon is
  always visible (opacity: 1, not just on hover), and its color is the currently
  active custom color (`color: var(--accent-{modelId})`), signaling that an
  override is in effect.
- Aria label: "Customize accent color for [Model Name]"
- Keyboard: the palette icon is a `<button>` element, focusable. `Enter` or
  `Space` opens the popover. `Escape` closes it. Focus ring: `2px solid
  {interactive.focusRing}` at `2px offset`.

**Pill layout with palette icon:**

```
[ • Label            🎨 ]
  ↑                   ↑
  7px dot             14px palette icon (absolute, right: 8px)
```

Revised pill padding spec for the Model Selector Panel context only:
- Pill `position: relative`.
- Palette icon: `position: absolute`, `right: 8px`, `top: 50%`,
  `transform: translateY(-50%)`.
- Pill right padding: `28px` fixed (accommodates the 14px icon + 8px right
  margin + 6px breathing room from label to icon).
- Pills rendered outside the Model Selector Panel (e.g. in a future inline
  context) do not include the palette icon. The `28px` right padding applies
  only in the Model Selector Panel context.

---

### Color Picker Popover

A compact floating popover anchored to the palette icon.

**Position:**
- Anchored to the palette icon, appearing above the icon.
- If insufficient space above (icon is within 200px of viewport top), the
  popover appears below the icon instead.
- Horizontal alignment: right-edge-aligned with the palette icon.
- Offset from anchor: `8px` vertical gap between icon edge and popover edge.
- Z-index: `60`. The model selector panel is `z-index: 50`; the popover must
  render above it.

**Dimensions:**
- Width: `220px` fixed.
- Height: auto (grows with content, no max-height needed at this width).

**Background and border:**
- Background: `{surfaces.card}`
- Border: `1px solid {borders.default}`
- Border-radius: `{radius.lg}` (12px)
- Shadow: `{shadow.lg}`

**Popover header:**
- Content: "Model accent" — `12px`, `font-weight: 600`, `{text.muted}`,
  uppercase, `letter-spacing: 0.06em`.
- Height: `32px`. Horizontal padding `12px`. Vertically centered.
- Border-bottom: `1px solid {borders.subtle}`.

**Swatch grid:**
- A `4 × 3` grid of 12 color swatches (12 curated colors — see Swatch Palette
  section below).
- Swatch size: `28px × 28px`. `border-radius: {radius.sm}` (4px).
- Grid: `display: grid`, `grid-template-columns: repeat(4, 28px)`, `gap: 6px`.
- Grid padding: `12px` all sides.
- Each swatch is a `<button>`. Clicking selects that color and closes the
  popover (auto-save behavior).
- Active swatch (currently selected color): `outline: 2px solid {text.primary};
  outline-offset: 2px`. If the active color is a custom hex that does not match
  any swatch hex exactly, no swatch shows the active outline.
- Hover on swatch: `transform: scale(1.1)` at `timing.fast ease-out`.
- Aria label on each swatch button: "[Color Name]" (e.g. "Amber", "Teal").

**Contrast warning banner (conditional):**
- Appears between the swatch grid and the custom color input row.
- Shown when the currently selected color has a contrast ratio below 4.5:1
  against `{surfaces.background}` of the active theme.
- Visual: `background: {surfaces.card}`, `border-left: 3px solid
  {semantic.warning}`, `color: {semantic.warning}`.
- Padding: `8px 12px`. No border-radius on the banner itself — it sits flush
  within the popover's rounded container.
- Text: "Low contrast on [ThemeName]" — `11px`, `font-weight: 400`.
- Hidden when contrast is adequate (4.5:1 or above).
- Updates in real time as the user changes the selection.

**Custom color input row:**
- Padding: `12px`. Border-top: `1px solid {borders.subtle}`.
- Label: "Custom" — `11px`, `{text.muted}`, `font-weight: 500`,
  `display: block`, `margin-bottom: 6px`.
- Row layout: `display: flex`, `align-items: center`, `gap: 8px`.
- Color swatch button: `36px × 36px`. Border-radius `{radius.sm}`. Background
  is the currently active color. Contains a hidden `<input type="color">` that
  is triggered by clicking the swatch button (`input.click()` on button click).
  The input's `value` is synced with the active color. The swatch button has
  `border: 1px solid {borders.default}`.
- Hex text field: `<input type="text">`, `width: 96px`. `font-size: 12px`,
  `{text.primary}`. Background `{surfaces.input}`. Border `1px solid
  {borders.default}`. Border-radius `{radius.sm}`. Padding `4px 8px`.
  Placeholder: `#000000`.
  - On `Enter` key: validates, applies if valid, closes popover.
  - On `blur`: validates, applies if valid. On invalid value: border transitions
    to `{semantic.error}` at `timing.fast`, then reverts to `{borders.default}`
    after `350ms` (timing.slow). Input value reverts to last valid hex.
- Sync rule: native color picker `change` event updates hex field. Hex field
  valid input updates the native color picker `value`. Both update the preview
  swatch background.
- The native color picker does not auto-save while the user is dragging — it
  saves on picker `close` event (when the user dismisses the browser's color
  picker). This avoids write storms to localStorage during hue drags.

**Reset affordance:**
- Positioned at the bottom of the popover, below the custom color input.
- Padding: `0 12px 10px 12px`.
- A `<button>` styled as a text link: "Reset to theme default". `11px`,
  `{text.muted}`. On hover: `{text.secondary}`, `text-decoration: underline`.
  Right-aligned within the row.
- Behavior: calls `clearModelAccentColor(modelId)`, re-runs
  `applyUserAccentColors()`, closes the popover. The model's CSS property
  reverts to the theme-applied value instantly.
- Visibility: shown only when a custom color is currently stored for this model.
  Hidden (removed from DOM, not just visually hidden) when no override is active.

**Close behavior summary:**
| Action | Saves? | Closes popover? |
|--------|--------|----------------|
| Click swatch | Yes | Yes |
| Enter in hex field (valid) | Yes | Yes |
| Blur hex field (valid) | Yes | No |
| Native color picker close | Yes | No |
| Click outside popover | No | Yes |
| Escape key | No | Yes |
| Click "Reset to theme default" | Yes (clears) | Yes |

"Saves" for the blur case means the color is applied and stored; the popover
stays open so the user can continue adjusting or reset. This allows iterative
tweaking without reopening.

---

### Swatch Palette (12 curated colors)

Swatches are offered regardless of the active theme. They are saturated enough
to be distinguishable on both dark and light backgrounds when used as a 28px
swatch. The aria-label on the button provides the color name; no text label
appears inside the swatch.

| Position | Name | Hex | Notes |
|----------|------|-----|-------|
| Row 1, Col 1 | Amber | `#F59E0B` | Claude default (Slate) |
| Row 1, Col 2 | Gold | `#EAB308` | Warm yellow |
| Row 1, Col 3 | Coral | `#F97316` | Other default |
| Row 1, Col 4 | Rose | `#E0568A` | Mistral default (Slate) |
| Row 2, Col 1 | Crimson | `#EF4444` | Red |
| Row 2, Col 2 | Violet | `#8B5CF6` | Gemini family |
| Row 2, Col 3 | Cobalt | `#4468D0` | DeepSeek default (Slate) |
| Row 2, Col 4 | Sky | `#38B2D8` | Grok default (Slate) |
| Row 3, Col 1 | Teal | `#14B8A6` | GPT default (Slate) |
| Row 3, Col 2 | Lime | `#84CC16` | Available, unused in defaults |
| Row 3, Col 3 | Sage | `#22C55E` | Green |
| Row 3, Col 4 | Snow | `#E8EAF0` | Near-white; useful in dark themes |

---

## Accessibility: Contrast Computation

Aria computes relative luminance using the standard WCAG formula. This is a
pure function with no dependencies. Gate does not perform contrast checks.

```
Algorithm (expressed as pseudocode):

hexToRelativeLuminance(hex: string): number
  r, g, b = parse hex to [0,255] integers
  r, g, b = r/255, g/255, b/255
  linearize each channel c:
    if c <= 0.04045: c / 12.92
    else: ((c + 0.055) / 1.055) ^ 2.4
  return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin

contrastRatio(hex1: string, hex2: string): number
  L1 = hexToRelativeLuminance(hex1)
  L2 = hexToRelativeLuminance(hex2)
  lighter = max(L1, L2)
  darker  = min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
```

Warning threshold: contrastRatio(selectedColor, theme.surfaces.background) < 4.5

The 4.5:1 threshold is used because the pill label (13px, weight 500) does not
qualify as "large text" under WCAG definitions (which require 18px regular or
14px bold — 500 weight at 13px is borderline and should use the stricter 4.5:1
standard for safety).

---

## Edge Cases

### Invalid stored color on read

If the stored hex value for a model fails the `/^#[0-9A-Fa-f]{6}$/` pattern on
read (corruption, manual edit, etc.), Gate silently drops that entry. The model
falls back to its theme default. Gate does not surface a read error to the UI.
Aria does not receive an invalid value.

### Theme switch while custom colors are active

Pass 2 always runs after Pass 1. All stored custom colors are reapplied over
the new theme's values. This is correct behavior — the user chose those colors;
they should persist across theme changes. The reset affordance in the popover
and the global "Reset all" in settings explicitly restore the theme default when
the user wants theme-appropriate colors back.

### Dark vs. light theme behavior

Custom colors are theme-agnostic — the same hex applies regardless of whether
the active theme is dark or light. A color chosen while on Slate (dark) may
have poor contrast on Linen (light). The contrast warning system is live
(checks against the active theme's background on every color change) and will
surface this discrepancy if the user switches themes. No automatic adjustment
is made — the user owns the choice.

### Model deactivated while custom color is set

Custom colors are stored independently of model active/inactive state. A model
that is deactivated still has its custom color stored. When reactivated, the
custom color remains applied. No cleanup on deactivation.

### Conversation export with custom colors

Custom colors are display metadata. They are not serialized into exported
conversations. Exported conversations carry model identity via `modelId`. The
rendering environment at import time applies its own color layer.

### ModelId expansion in the future

`ModelAccentColors` is `Partial<Record<ModelId, string>>`. Adding new models to
`ModelId` automatically permits them to have custom colors with no type change.
Gate's read-time validation whitelist (keys must be valid `ModelId` values) must
be updated when `ModelId` is extended — this is Arch and Gate's responsibility.

---

## Gate Implementation Notes

Gate owns localStorage read/write for `ModelAccentColors`. The behavioral
contracts for the four functions:

```
getModelAccentColors(): ModelAccentColors
  Returns the stored record, validated and cleaned (invalid entries dropped).
  Returns {} on any error or if the key is absent.
  Synchronous. Never throws.

setModelAccentColor(modelId: ModelId, hex: string): void
  Validates hex matches /^#[0-9A-Fa-f]{6}$/ before persisting.
  On validation failure: throws TypeError (this is a developer contract guard,
  not a user-facing error path — Aria validates before calling).
  Reads existing record, sets the entry for modelId, writes back.
  Synchronous.

clearModelAccentColor(modelId: ModelId): void
  Reads existing record, removes the entry for modelId if present, writes back.
  No-op if modelId has no stored color.
  Synchronous.

clearAllModelAccentColors(): void
  Removes "roundtable:model-accent-colors" from localStorage entirely.
  Synchronous.
```

**Sync vs. async note:** These functions are synchronous, unlike
`StorageProvider` methods. `StorageProvider` is async to accommodate a future
`ServerStorageProvider`. User preferences (including accent colors) are
localStorage-only concerns with no server persistence path planned. Sync is
correct here, consistent with the existing credential and preference functions
(`GetCredentialsFn`, `SaveCredentialsFn` are also sync).

---

## Settings Panel: "Reset All to Defaults" Control

A global reset affordance in the application settings panel.

- Location: Settings panel, under an "Appearance" or "Colors" section, below
  the theme picker.
- Control: a `<button>` styled as a text link: "Reset all model colors to theme
  defaults". `13px`, `{text.secondary}`. Hover: `{text.primary}`,
  `text-decoration: underline`.
- Behavior: calls `clearAllModelAccentColors()`, then calls `applyTheme()` with
  the active theme followed by `applyUserAccentColors({})`. All models revert to
  their theme defaults instantly. No confirmation dialog — this is easily
  reversed; confirmation adds friction unnecessarily.
- Visibility: rendered only when `getModelAccentColors()` returns a non-empty
  object (at least one model has a custom color). Hidden (not just styled
  disabled) when all models are using their theme defaults.

---

## Components That Consume Accent Colors (no code changes needed)

All existing components that use model accent colors do so through CSS custom
properties. The runtime override writes to the same properties. No component
code changes are needed for any of the following:

| Component | CSS property used | Appearance affected |
|-----------|------------------|-------------------|
| Message Bubble | `--accent-{model}` | 3px left border |
| Message Bubble streaming | `--accent-{model}` | bottom shimmer border |
| Model Identity Pill | `--accent-{model}` | 7px dot color |
| Model Selector Dropdown row | `--accent-{model}` | 7px dot color |
| Sidebar Thread Row | `--accent-{model}` | 6px participating model dots |
| Palette icon (new in this issue) | `--accent-{model}` | icon fill when override active |

---

## Summary for Downstream Agents

### For Arch

Add to `/src/types/index.ts`:

```
export type ModelAccentColors = Partial<Record<ModelId, string>>;

export type GetModelAccentColorsFn = () => ModelAccentColors;
export type SetModelAccentColorFn = (modelId: ModelId, hex: string) => void;
export type ClearModelAccentColorFn = (modelId: ModelId) => void;
export type ClearAllModelAccentColorsFn = () => void;
```

No changes to any other existing type. `ModelConfig.color` and `ModelId` are
unchanged.

### For Gate

1. Implement `getModelAccentColors`, `setModelAccentColor`,
   `clearModelAccentColor`, `clearAllModelAccentColors` per the behavioral
   contracts in the Gate Implementation Notes section.
2. localStorage key: `"roundtable:model-accent-colors"`.
3. Validation on read (drop invalid entries silently) and on write (reject
   invalid with TypeError).
4. Expose these four functions in Gate's public API so Aria can import them.

### For Aria

1. Call `applyUserAccentColors(getModelAccentColors())` after every
   `applyTheme()` call (app load and theme switch).
2. Call `applyUserAccentColors(getModelAccentColors())` immediately after any
   `setModelAccentColor()` or `clearModelAccentColor()` call.
3. Add palette icon to Model Identity Pill in the Model Selector Panel context
   (not in other pill usages). Spec in Component Spec section above.
4. Implement Color Picker Popover per full spec above.
5. Implement contrast check function (WCAG formula in Accessibility section)
   and render the warning banner when contrast < 4.5:1.
6. Add "Reset all to defaults" control to Settings panel per spec above.

No changes to Message Bubble, Sidebar, or any other existing component.
