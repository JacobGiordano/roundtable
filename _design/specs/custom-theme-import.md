# Custom Theme Import UI — Component Spec

**Owner:** Luma
**Issue:** #169
**Pipeline:** Luma (spec) → Gate (validateCustomTheme) → Aria (UI)
**Date:** 2026-06-23

Aria implements these specs exactly. Every value here is a decision — not a
suggestion. No design decisions are deferred to Aria. Token references use
`{category.key}` notation matching `tailwind-mapping.md`.

---

## Overview

The Custom Theme Import UI lives inside the Provider Settings Panel (specced in
`provider-settings.md`) as a new "Appearance" section. It allows users to paste
or upload a custom theme JSON file, see validation errors before applying, and
apply a valid theme.

The component has four distinct states:
1. **Idle** — no file selected, awaiting input
2. **Validating** — file selected, Gate's `validateCustomTheme()` running
3. **Rejected** — validation failed, errors displayed, theme not applied
4. **Applied** — validation passed, theme applied, success confirmation shown

---

## Placement Within the Provider Settings Panel

The Provider Settings Panel (specced in `provider-settings.md`) currently shows
three sections: Configured Providers, Add Built-in Provider, Add Custom Endpoint.
This component adds a fourth section: **Appearance**.

**Section order in the panel (revised):**
1. Configured Providers
2. Add Built-in Provider
3. Add Custom Endpoint
4. Appearance ← new

**Section gap:** `{spacing.8}` (32px) between sections — same as existing
sections.

**Section label:** "Appearance" — `11px`, `font-weight: 600`, `{text.muted}`,
uppercase, `letter-spacing: 0.06em`. `margin-bottom: 8px`.

**Subsection label (directly below section label):** "Custom theme" — `12px`,
`font-weight: 500`, `{text.secondary}`. `margin-bottom: 8px`.

**Description text:** "Import a theme JSON file conforming to the Roundtable
token schema." — `12px`, `font-weight: 400`, `{text.muted}`. `margin-bottom: 16px`.

---

## Gate Contract: `validateCustomTheme()`

Gate will implement:

```
validateCustomTheme(json: unknown): ValidationResult
```

Where `ValidationResult` is:

```
type ValidationResult =
  | { valid: true }
  | { valid: false; errors: ValidationError[] }

type ValidationError = {
  field: string;   // dot-path into the JSON (e.g. "surfaces.card", "mode")
  message: string; // human-readable description of the violation
}
```

Aria calls `validateCustomTheme()` after the file is parsed but before applying
it. If `valid: true`, Aria calls Gate's `saveCustomTheme()` and applies the
theme. If `valid: false`, Aria renders the error list and does not apply.

**Cross-agent dependency:** Gate must expose both `validateCustomTheme()` and
`saveCustomTheme(theme: ThemeJSON): void` before Aria can implement. Aria must
not apply an unvalidated theme — Gate is the authority on schema correctness.

---

## 1. Idle State

The initial state when no file has been selected or after a successful apply and
the user has cleared the import.

### Import Trigger Zone

A single import area containing a file picker button and (optional) a drag-and-drop
target.

**Container:**
- Width: 100% of the Appearance section content area (inherits `max-width: 640px`
  from the panel body, same as other sections).
- Height: `120px` fixed.
- Background: `{surfaces.input}`.
- Border: `1px dashed {borders.default}`.
- Border-radius: `{radius.md}` (8px).
- `display: flex`, `flex-direction: column`, `align-items: center`,
  `justify-content: center`, `gap: 8px`.

**Upload icon:**
- Size: `24px × 24px`. SVG upload/arrow-up-from-bracket icon (not emoji).
- Color: `{text.muted}`.
- `margin-bottom: 4px`.

**Primary text:**
- "Choose a file" — `13px`, `font-weight: 500`, `{text.secondary}`.
- This is the clickable affordance. Aria wraps it in a `<button>` that triggers
  the hidden file input. The button text is underlined on hover.
- Hover state on button: `{text.primary}`, `text-decoration: underline`.
- Transition: `timing.fast`.

**Secondary text:**
- "or drag and drop a JSON file here" — `12px`, `font-weight: 400`, `{text.muted}`.
- Always visible below the primary text. Not clickable.

**File input:**
- A `<input type="file" accept=".json,application/json">` is rendered with
  `display: none`. It is triggered by clicking the "Choose a file" button or by
  activating the drag-and-drop zone (described below).
- The input has `id="theme-file-input"` and is associated with a `<label>` via
  `for="theme-file-input"` for accessibility.

**Drag-and-drop (optional enhancement):**
- The container zone is the drag target (the full `120px` container).
- Drag-over state: border transitions from `1px dashed {borders.default}` to
  `1px solid {borders.strong}`, background transitions from `{surfaces.input}` to
  `{interactive.hover}`. Transition: `timing.fast`.
- Drop event: file is passed to the same handler as the file input `change` event.
- Drag-leave or drag-end: zone returns to idle border and background.
- `prefers-reduced-motion`: transitions happen at `timing.instant`.
- If drag-and-drop is not implemented in Wave 3, the secondary text reads "JSON
  files only" instead. Aria replaces this text when implementing the drag target.

**Keyboard accessibility:**
- The "Choose a file" button is focusable. `Enter` or `Space` opens the file
  picker.
- Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, `{radius.md}`.
- The full drop zone container has `role="button"` and `tabindex="0"` only if
  drag-and-drop is implemented. If file-picker-only, the `<button>` inside is
  the only interactive element.

---

## 2. Validating State

After a file is selected (either via file picker or drag-and-drop), the UI moves
to the Validating state while the JSON is parsed and `validateCustomTheme()` runs.

Gate's `validateCustomTheme()` is synchronous (`validateCustomTheme(json:
unknown): ValidationResult` — no async). However, JSON parsing of a large file
could take a frame. Aria defers the validation call by one `requestAnimationFrame`
so the validating state is visually rendered before the synchronous work runs.
This prevents a flash where the UI jumps from Idle directly to Rejected or Applied.

### Validating State Visual

**Container:**
- Same dimensions as the idle drop zone (`100%` width, `120px` height).
- Background: `{surfaces.input}`.
- Border: `1px solid {borders.default}`.
- Border-radius: `{radius.md}`.
- `display: flex`, `flex-direction: column`, `align-items: center`,
  `justify-content: center`, `gap: 8px`.

**Loading indicator:**
- A spinning SVG arc (`20px × 20px`). Stroke color: `{accents.model-claude}`
  (amber). Rotation animation: 360deg at `{timing.slow}` (350ms) per revolution,
  `linear`, `infinite`.
- `prefers-reduced-motion`: spinner is hidden. Replace with a static three-dot
  sequence ("...") in `{text.muted}`, `13px`. No animation.

**Status text:**
- "Validating theme..." — `13px`, `font-weight: 400`, `{text.muted}`.

**File name display:**
- Below status text: the file name from the file input event, truncated to 32
  characters with an ellipsis if longer. `11px`, `{text.muted}`.

---

## 3. Rejected State

`validateCustomTheme()` returned `{ valid: false, errors: ValidationError[] }`.

The import zone is replaced by an error panel. The theme is NOT applied.

### Rejected State Container

**Container:**
- Width: 100% of section content area.
- Height: auto (grows with error count).
- Background: `{surfaces.card}`.
- Border: `1px solid {borders.default}`.
- Border-left: `3px solid {semantic.error}` — overrides the left side of the
  `1px` perimeter border. Achieves via `border-left-width: 3px` and
  `border-left-color: {semantic.error}`. The total left side is `3px` (no
  additive stacking of the `1px` and `3px`).
- Border-radius: `{radius.md}`.

### Rejected State Header

Inside the container, at the top. `padding: 12px 16px`. `border-bottom: 1px
solid {borders.subtle}`.

**Layout:** `display: flex`, `align-items: center`, `gap: 8px`.

**Icon:** A `16px × 16px` SVG warning/x-circle icon. Color: `{semantic.error}`.

**Heading text:** "Theme validation failed" — `13px`, `font-weight: 600`,
`{text.primary}`.

**File name:** Right side, `11px`, `{text.muted}`, right-aligned with
`margin-left: auto`. Truncated to 24 characters with ellipsis if longer.

### Error List

Below the header. `padding: 12px 16px`.

**Error count line (above the list):** "N issue(s) found:" — `11px`,
`font-weight: 500`, `{text.muted}`. `margin-bottom: 8px`. Use the actual count:
"1 issue found:" or "3 issues found:" (no parenthetical — Aria applies the
singular/plural rule: 1 → "1 issue found:", 2+ → "N issues found:").

**Error list:**
- A `<ul>` with `list-style: none`, `margin: 0`, `padding: 0`.
- `display: flex`, `flex-direction: column`, `gap: 6px`.

**Each error item:**
- `display: flex`, `align-items: flex-start`, `gap: 8px`.
- **Bullet:** A `4px × 4px` circle, `border-radius: {radius.full}`,
  `background: {semantic.error}`. Positioned with `margin-top: 6px` to
  vertically align with the first line of the error text.
- **Field path:** `<span>` — the `error.field` value (e.g. "surfaces.card").
  `12px`, `font-weight: 600`, `font-family: monospace`, `{text.secondary}`.
  Followed by a colon and a space, then the message text (inline, not a separate
  element). Do not line-break between the field and the message.
- **Message text:** the `error.message` value. `12px`, `font-weight: 400`,
  `{text.secondary}`. Inline after the field path colon.

**Example rendered error item:**
```
• surfaces.card: Expected a 6-digit hex color string beginning with #.
```

**Max visible errors without scroll:** 16 items. If `errors.length > 16`, the
error list container has `max-height: 240px`, `overflow-y: auto`. The scrollable
area uses the system default scrollbar (no custom styling needed).

**Decision note:** Show all errors up to 16 without scroll. Theme schema
validation errors are a technical report the user must act on. Truncating
at 8 forces the user to scroll to see actionable information. The 17+ cap
prevents extreme cases (e.g. a completely malformed file) from producing an
unusably tall panel.

### Rejected State Footer

Below the error list. `padding: 8px 16px 12px 16px`. `border-top: 1px solid
{borders.subtle}`.

**Layout:** `display: flex`, `align-items: center`, `justify-content: space-between`.

**Left side — help text:**
- "Fix the issues above in your JSON file and try again." — `11px`,
  `font-weight: 400`, `{text.muted}`.

**Right side — "Try Again" button:**
- Text: "Try again"
- Height: `32px`. Padding: `0 16px`. `border-radius: {radius.md}`.
- Background: transparent. Border: `1px solid {borders.default}`.
- Typography: `12px`, `font-weight: 500`, `{text.secondary}`.
- Hover: background `{interactive.hover}`, border `{borders.strong}`. Transition:
  `timing.fast`.
- Active/press: `filter: brightness(0.9)`.
- Clicking resets the component to Idle state (clears the selected file reference,
  resets the drop zone). The file input value is reset so the same file can be
  re-selected after correction.
- Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, `{radius.md}`.
- Aria label: "Try again — choose a new theme file"

---

## 4. Applied State

`validateCustomTheme()` returned `{ valid: true }`, and the theme has been saved
via `saveCustomTheme()` and applied via the theme loader.

### Applied State Container

**Container:**
- Width: 100% of section content area.
- Height: `80px`.
- Background: `{surfaces.card}`.
- Border: `1px solid {borders.default}`.
- Border-left: `3px solid {semantic.success}` — same pattern as the rejected
  state's error border, but success color.
- Border-radius: `{radius.md}`.
- `display: flex`, `align-items: center`, `padding: 0 16px`, `gap: 12px`.

### Applied State Contents

**Layout:** `display: flex`, `align-items: center`, `gap: 12px`, full width.

**Icon:** A `20px × 20px` SVG checkmark-circle icon. Color: `{semantic.success}`.

**Text block:** `flex: 1`.
- Primary line: "Theme applied" — `14px`, `font-weight: 600`, `{text.primary}`.
- Secondary line: the theme's `name` field from the JSON (e.g. "My Dark Theme").
  `12px`, `font-weight: 400`, `{text.muted}`. `margin-top: 2px`.
- If the theme's `name` field is longer than 40 characters, truncate with ellipsis.

**"Change" button (far right):**
- Text: "Change"
- Height: `28px`. Padding: `0 12px`. `border-radius: {radius.md}`.
- Background: transparent. Border: `1px solid {borders.default}`.
- Typography: `11px`, `font-weight: 500`, `{text.secondary}`.
- Hover: background `{interactive.hover}`, border `{borders.strong}`. Transition:
  `timing.fast`.
- Clicking resets the component to Idle state. The custom theme remains applied
  (the user is switching to a different custom theme, not uninstalling the current
  one). If the user wants to revert to a built-in theme, they use the theme picker
  elsewhere in the settings panel (not this component's responsibility).
- Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, `{radius.md}`.
- Aria label: "Change custom theme"

**Persistence note:** The Applied state persists across sessions. When the user
reopens the settings panel and a custom theme is active, the component renders
in Applied state (not Idle). Aria reads the active theme metadata from Gate to
determine initial render state:
- If `getActiveTheme()` returns a theme with `source: 'custom'`: render Applied
  state with that theme's name.
- Otherwise: render Idle state.

**Cross-agent dependency:** Gate must expose `getActiveTheme(): ActiveTheme` where
`ActiveTheme` includes a `source: 'builtin' | 'custom'` field and the theme `name`.
This enables Aria to determine the initial render state. If this field is not
present in Gate's current API, this is a new requirement Gate must implement before
Aria begins.

---

## 5. State Transitions

```
Idle
  └─ file selected / dropped → Validating
        ├─ valid: false → Rejected
        │     └─ "Try again" clicked → Idle
        └─ valid: true → Applied
              └─ "Change" clicked → Idle
```

No transitions between Rejected and Applied directly. The user must go back to
Idle and re-import to attempt another file.

**Transition animations:**

**Idle → Validating:** The import zone container fades from `opacity: 1` to
`opacity: 0` over `{timing.fast}` (100ms), then the validating container fades
in from `opacity: 0` to `opacity: 1` over `{timing.fast}`. The container
height stays at `120px` — no height change during this transition.

**Validating → Rejected:** The validating container fades out at `timing.fast`.
The rejected container fades in at `timing.medium` (200ms) and slides in from
`translateY(-8px)` to `translateY(0)`. Height animates from `120px` to the
natural height of the error list over `{timing.medium}`.

**Validating → Applied:** The validating container fades out at `timing.fast`.
The applied container fades in at `timing.medium` from `opacity: 0` and
`translateY(-8px)` to `opacity: 1` and `translateY(0)`. Height collapses from
`120px` to `80px` over `{timing.medium}`.

**Rejected → Idle ("Try again"):** The rejected container collapses to `0`
height over `{timing.medium}`, then the idle drop zone fades in.

**Applied → Idle ("Change"):** The applied container fades out at `timing.fast`,
then the idle drop zone fades in at `timing.fast`. No height animation — both
states have predictable fixed dimensions.

**`prefers-reduced-motion`:** All transitions above happen at `timing.instant`.
State changes are immediate, no opacity or translate animations.

---

## 6. Accessibility

### ARIA Roles and Live Regions

- The state container (the element that transitions between Idle / Validating /
  Rejected / Applied) has `role="status"` and `aria-live="polite"`. This ensures
  screen readers announce state changes as they occur.
- Specifically: when the state changes to Rejected, the announcement is "Theme
  validation failed. N issues found." — Aria constructs this string and sets it
  as the accessible text for the `role="status"` region, not just the visual
  heading text.
- When the state changes to Applied: "Theme applied: [theme name]."
- When the state returns to Idle from Rejected or Applied: no announcement needed
  (user-initiated action, focus is on the "Choose a file" button).

### Focus Management

**On Idle → Validating:** no focus change. The file input triggered the
transition; the element that had focus (the "Choose a file" button) no longer
exists in the DOM. Aria moves focus to the state container itself temporarily:
`stateContainer.focus()` with `tabindex="-1"`. This holds focus while the
validating spinner is shown.

**On Validating → Rejected:** Aria moves focus to the rejected container's
heading ("Theme validation failed") — `tabindex="-1"`, `focus()`. The user can
then Tab to the "Try again" button.

**On Validating → Applied:** Aria moves focus to the applied container's "Theme
applied" text — `tabindex="-1"`, `focus()`. The user can then Tab to the
"Change" button.

**On Rejected → Idle:** Aria moves focus to the "Choose a file" button inside
the idle drop zone (the primary interactive target in the zone).

**On Applied → Idle:** Aria moves focus to the "Choose a file" button.

### Error List Accessibility

- The error list container has `role="list"`. Each error item has
  `role="listitem"`.
- The error list is not an `aria-live` region independently — the parent
  `role="status"` region covers the announcement.
- The scrollable error list (17+ errors) has `aria-label="Validation errors"`.
- The `max-height` scroll container has `tabindex="0"` so keyboard users can
  focus it and use arrow keys to scroll.

### File Input

- The `<input type="file">` is visually hidden (CSS `display: none`) but is
  the actual form control — it remains in the accessibility tree.
- A visible `<button>` triggers `input.click()`. The button has
  `aria-controls="theme-file-input"`.
- The `<input>` has `id="theme-file-input"`,
  `aria-label="Select a custom theme JSON file"`.

### Drop Zone (if drag-and-drop implemented)

- Drop zone container: `role="button"`, `aria-label="Drop zone for theme JSON
  file. Activate to open file picker."`, `tabindex="0"`.
- `Enter` / `Space` on the container opens the file picker (same as the
  "Choose a file" button).

---

## 7. Token Usage Summary

| Element | Token | Tailwind Class |
|---------|-------|---------------|
| Import zone container background | `{surfaces.input}` | `bg-input` |
| Import zone border (idle, dashed) | `{borders.default}` | `border-border border-dashed` |
| Import zone border (drag-over, solid strong) | `{borders.strong}` | `border-border-strong` |
| Import zone background (drag-over) | `{interactive.hover}` | `bg-hover` |
| Upload icon color | `{text.muted}` | `text-text-muted` |
| Spinner stroke | `{accents.model-claude}` | `text-accent-claude` |
| Upload/status text muted | `{text.muted}` | `text-text-muted` |
| Upload primary text | `{text.secondary}` | `text-text-secondary` |
| Rejected container background | `{surfaces.card}` | `bg-card` |
| Rejected border (base) | `{borders.default}` | `border-border` |
| Rejected left border | `{semantic.error}` | `border-error` |
| Rejected heading icon | `{semantic.error}` | `text-error` |
| Error list field path (monospace) | `{text.secondary}` | `text-text-secondary` |
| Error list message text | `{text.secondary}` | `text-text-secondary` |
| Error list bullet | `{semantic.error}` | `bg-error` |
| Applied container background | `{surfaces.card}` | `bg-card` |
| Applied left border | `{semantic.success}` | `border-success` |
| Applied checkmark icon | `{semantic.success}` | `text-success` |
| Applied theme name text | `{text.muted}` | `text-text-muted` |
| Applied heading text | `{text.primary}` | `text-text-primary` |
| Secondary buttons (Try again, Change) | `{borders.default}` | `border-border` |
| Secondary button hover bg | `{interactive.hover}` | `bg-hover` |
| Focus rings | `{interactive.focusRing}` | `ring-focus` |

---

## 8. Cross-Agent Dependencies

| Dependency | Blocking what | Notes |
|---|---|---|
| Gate `validateCustomTheme(json: unknown): ValidationResult` | Aria implementation (state 2→3/4) | Gate Wave 2. Aria must not validate inline — Gate owns the schema check. |
| Gate `saveCustomTheme(theme: ThemeJSON): void` | Aria implementation (applied state) | Gate Wave 2. Called after `validateCustomTheme` returns `valid: true`. |
| Gate `getActiveTheme(): ActiveTheme` where `ActiveTheme.source: 'builtin' \| 'custom'` | Aria initial render state | Gate may not yet expose a `source` field. This is a new requirement. If absent, Aria may check whether the active theme name matches any built-in theme name as a fallback heuristic — but the `source` field is the clean solution. Flag to Gate. |
| Arch types for `ValidationResult`, `ValidationError`, `ThemeJSON`, `ActiveTheme` | Aria and Gate | These types must be defined in `/src/types/index.ts` before either Gate or Aria implements. This is an Arch dependency that must be resolved before Wave 2 begins. |

---

## 9. Edge Cases

### File is not valid JSON

JSON.parse throws. Aria catches the parse error and transitions directly to
Rejected state without calling `validateCustomTheme()`. The error list contains
a single item:

- `field: "root"`, `message: "File is not valid JSON. Check for syntax errors."`

The same rejected state container and styling applies. Aria does not attempt
to call `validateCustomTheme()` on a value that failed to parse.

### File is valid JSON but not an object

`validateCustomTheme()` receives a non-object (array, string, number, null).
Gate handles this as a validation failure with an appropriate error. Aria does
not special-case this — it falls through to the normal Rejected state.

### File is empty

A 0-byte file or a file with only whitespace. JSON.parse throws or returns
`undefined`. Aria catches and shows:

- `field: "root"`, `message: "File is empty."`

### File is too large

Aria enforces a client-side file size limit of **512 KB**. A well-formed
Roundtable theme JSON is under 5 KB — 512 KB is a generous upper bound that
catches obviously wrong files (e.g. the user accidentally selects a source
bundle) without rejecting any realistic theme file.

If `file.size > 524288` (512 × 1024 bytes), Aria rejects before parsing and
shows:

- `field: "root"`, `message: "File is too large (max 512 KB). Theme JSON files should be under 5 KB."`

No spinner is shown for oversized files — the check is synchronous before the
FileReader starts.

### File name display

Aria uses `file.name` from the File object. No path information is available
from `<input type="file">` in the browser — the name is already just the
filename, no stripping needed. Truncate at 32 characters (Validating state) and
24 characters (Rejected state header) with ellipsis.

### Multiple files (file picker allows only one)

`<input type="file" accept=".json,application/json">` without `multiple`
attribute — only one file is selectable. If drag-and-drop is implemented and the
user drops multiple files, take only the first file (`event.dataTransfer.files[0]`)
and ignore the rest. No error message for multi-file drop — silently process the
first.

### Custom theme that matches a built-in theme name

The user imports a JSON with `"name": "Slate"`. This is allowed — custom themes
are stored separately from built-in themes. Gate's `saveCustomTheme()` handles
storage. There is no naming conflict — the active theme `source` field
distinguishes them.

### Network/storage failure in saveCustomTheme

If `saveCustomTheme()` throws, Aria catches the error, does NOT transition to
Applied state, and shows an error in a rejected-style container. The specific
error text: "Failed to save theme. Check your browser's storage settings." —
`{semantic.error}`, same error item format as validation errors.

This is an infrastructure error, not a validation error. It appears as a
single-item error list in a rejected container with `{semantic.error}` left
border, but with a different heading: "Save failed" instead of "Theme validation
failed."

---

## 10. Integration with the Theme Picker

The built-in theme picker (the control that lets users switch between Slate,
Linen, Midnight, Ash, Ember, Chalk, Outrun) lives elsewhere in the Appearance
section of the Settings panel. That component is not specced in this document.

**Interaction between the custom theme importer and the theme picker:**

When the user applies a custom theme, the theme picker should reflect that a
custom theme is active. Luma's recommendation: the theme picker shows "Custom"
as a selected state when a custom theme is active. Aria owns the exact treatment
— this spec does not dictate the theme picker's visual. The only requirement:
importing and applying a custom theme must visually update the theme picker to
indicate a non-built-in theme is active.

This is a coordination note for Aria, not a hard spec for this component.
