# Provider Settings Panel — Component Spec

**Owner:** Luma
**Issue:** #97
**Date:** 2026-06-13
**Downstream:** Aria (#99 settings panel, #100 onboarding), Gate (ProviderRoster types already shipped #93)

Aria implements these specs exactly. Every value here is a decision. No design
decisions are deferred to Aria. Token references use `{category.key}` notation
matching `tailwind-mapping.md`.

---

## Background: ProviderRoster Data Shape

Gate's `ProviderRoster` is an array of `ProviderConfig` entries. Each entry is
either:

- `BuiltInProviderConfig` — `kind: 'builtin'`, `modelId`, `credentialKey`,
  `isVisible`
- `CustomProviderConfig` — `kind: 'custom'`, `id`, `displayName`,
  `endpointUrl`, `modelString`, `credentialKey?`, `color?`

Built-in model IDs: `claude`, `gpt-5.5`, `gemini`, `grok`, `deepseek`,
`mistral`. Their accent tokens: `--accent-claude`, `--accent-gpt`,
`--accent-gemini`, `--accent-grok`, `--accent-deepseek`, `--accent-mistral`.

Custom providers use `{accents.model-other}` (`--accent-other`) unless the
`color` field is set, in which case Aria writes that hex directly as an inline
CSS custom property override on the specific element (not a global CSS var —
scope it to the element).

---

## 1. Provider Settings Panel — "My Providers"

### 1.1 Panel Location and Trigger

The provider settings panel is a **full-width slide-in panel from the right**
that overlays the main content area (conversation column). It is not a modal —
it does not block the sidebar, which remains visible and usable on the left.

**Why not a sidebar flyout:** the form for adding a custom endpoint requires
enough width to display three text inputs comfortably. A sidebar flyout (constrained
to ~256px) cannot hold this form without cramping. A full-panel approach (minus
the sidebar) gives Aria the room to lay out form fields without horizontal
compression.

**Panel dimensions:**
- Width: `calc(100vw - 256px)` — full viewport minus the sidebar. On mobile
  (<640px viewport), the panel covers 100vw.
- Height: 100vh.
- `position: fixed`, `top: 0`, `right: 0`.
- `z-index: 40` — renders above the conversation column but below the model
  selector panel (`z-index: 50`) and color picker popover (`z-index: 60`).

**Background:** `{surfaces.background}` — not `{surfaces.sidebar}`. The panel
is a primary view, not a supplemental pane.

**Shadow:** `{shadow.lg}` on the left edge only — `box-shadow: -8px 0 40px
rgba(0,0,0,0.4)`. This produces the sense of the panel floating over the
conversation. Outrun uses the theme's `shadow.lg` value, which already includes
neon glow — no override needed.

**Open trigger:** A "Settings" icon button in the sidebar header, right side.
`20px × 20px` SVG gear icon. Color: `{text.muted}`. Hover: `{text.secondary}`.
Button: `32px × 32px`, `border-radius: {radius.md}`. Hover background:
`{interactive.hover}`. Clicking opens the panel with the "My Providers" view
active.

**Close trigger:**
- A close button (`×`) at the top-right of the panel header.
  `32px × 32px`, `border-radius: {radius.md}`. `{text.muted}` icon color.
  Hover: `{interactive.hover}` background.
- `Escape` key closes the panel (when focus is within the panel and no dropdown
  is open — if a dropdown is open, `Escape` closes the dropdown first).
- Clicking outside the panel (on the sidebar or any area to the left) does NOT
  close the panel. The panel is a deliberate destination view, not a transient
  flyout. Users close it explicitly.

**Open/close animation:**
- Open: panel slides in from the right. `translateX(100%)` → `translateX(0)`.
  Duration: `{timing.slow}` (350ms). Easing: `cubic-bezier(0.22, 1, 0.36, 1)`
  (same as bubble entrance — deliberate reveal).
- Close: panel slides out to the right. `translateX(0)` → `translateX(100%)`.
  Duration: `{timing.medium}` (200ms). Easing: `ease-in`. Asymmetry is
  intentional — open is deliberate, close is fast.
- `prefers-reduced-motion`: snap instantly, no slide animation.

### 1.2 Panel Header

- Height: `56px`. Matches sidebar header height — they sit at the same
  horizontal level visually.
- Padding: `0 24px` (`{spacing.6}`).
- Border-bottom: `1px solid {borders.default}`.
- Background: `{surfaces.background}` — same as panel body.
- Left content: "My Providers" — `16px`, `font-weight: 600`, `{text.primary}`.
- Right content: Close button (`×`), described in section 1.1.
- Layout: `display: flex`, `align-items: center`, `justify-content: space-between`.

### 1.3 Panel Body Layout

- Padding: `32px` (`{spacing.8}`) horizontal, `24px` (`{spacing.6}`) top.
- Max-width of panel content: `640px`. The content column is left-aligned
  within the panel body — no centering. Rationale: right-side panels are
  conventionally left-aligned; centering feels unanchored in a panel context.
- Three stacked sections in order:
  1. Configured Providers List
  2. Add Built-in Provider
  3. Add Custom Endpoint Form
- Each section is separated by `{spacing.8}` (32px) vertical gap.
- Sections 2 and 3 are always visible — they do not collapse when the
  configured list is empty or full.

### 1.4 Configured Providers List

**Section label:** "Configured providers" — `11px`, `font-weight: 600`,
`{text.muted}`, uppercase, `letter-spacing: 0.06em`. `margin-bottom: 8px`.

**Container:** no border, no background. List items stack with `4px` gap
between them.

#### Provider Row

Each configured provider is one row. Rows render in roster order (the order
they were added).

**Row dimensions:**
- Height: `48px` fixed.
- Padding: `0 12px` (`{spacing.3}`).
- Border-radius: `{radius.md}` (8px).
- Background: `{surfaces.card}`.
- Border: `1px solid {borders.default}`.
- Layout: `display: flex`, `align-items: center`, `gap: 8px`.

**Row contents (left to right):**

1. **Provider color dot:**
   - Size: `8px` diameter. `border-radius: {radius.full}`.
   - Color: the provider's accent token. For built-ins, use the model-specific
     token (e.g. `{accents.model-claude}` for Claude). For custom providers,
     use the `color` field from `CustomProviderConfig` if present; otherwise
     `{accents.model-other}`.
   - No border on the dot.

2. **Provider name:**
   - Typography: `14px`, `font-weight: 500`, `{text.primary}`.
   - For built-ins: the display name of the model (Claude, GPT-5.5, Gemini,
     Grok, DeepSeek, Mistral).
   - For custom providers: the `displayName` field from `CustomProviderConfig`.
   - Truncation: `overflow: hidden`, `text-overflow: ellipsis`, `white-space:
     nowrap`. Max-width fills the row minus other elements.
   - `flex: 1` — takes all available horizontal space.

3. **API key status badge:**
   - Displayed to the right of the provider name.
   - Two states:
     - **Key set:** small rounded badge. Background: `{semantic.success}` at
       12% opacity — achieve this with a hex approximation of the success color
       at 12% opacity against the card surface. Use `bg-opacity-12` or compute
       the blended hex; do not use CSS `rgba` for background colors. Typography:
       `11px`, `font-weight: 500`, `{semantic.success}`. Text: "Key set".
       Border: none. Padding: `2px 8px`. `border-radius: {radius.full}`.
     - **No key:** same badge layout. Background: `{semantic.warning}` at 12%
       opacity against card surface. Typography: `{semantic.warning}`. Text:
       "No key". Border: none.
   - For custom providers where `credentialKey` is undefined (keyless endpoint,
     e.g. Ollama): badge text "No key required". Background: `{interactive.hover}`.
     Typography: `{text.muted}`. No semantic color — this is not a warning state.

4. **Remove button:**
   - `28px × 28px`. Icon: `×` or trash SVG, `14px`. `border-radius: {radius.sm}`.
   - Background: transparent. Icon color: `{text.muted}`.
   - Hover: background `{interactive.hover}`, icon color `{semantic.error}`.
   - Transition: `timing.fast` on all properties.
   - Position: far right of the row, `margin-left: auto` before it pushes the badge
     left — no, the layout order is dot / name / badge / remove. Badge is
     immediately right of name (no flex push); remove button is `margin-left: 8px`
     after the badge, flush right.
   - Aria label: "Remove [Provider Name]"
   - Clicking triggers the removal confirmation (section 1.5).

**Row hover state:**
- Background transitions from `{surfaces.card}` to `{interactive.hover}`.
- Border color transitions from `{borders.default}` to `{borders.strong}`.
- Transition: `timing.fast` on background and border.
- The remove button's hover state (icon turning error-red) is independent — it
  activates on hover of the button itself, not the row.

**Empty configured list state:**
When the roster is empty (no configured providers), the "Configured providers"
section shows an empty state in place of the row list:

- Container height: `80px`. Same border and background as a row, but `border-
  style: dashed`. `border-radius: {radius.md}`.
- Content: centered text — "No providers yet. Add one below."
  `13px`, `{text.muted}`, centered both axes.
- This state leads the user's eye downward to the Add sections.

### 1.5 Remove Provider — Confirmation Step

Clicking the remove button on any row does NOT immediately remove the provider.
It shows an inline confirmation within the row.

**Confirmation state replaces the row's normal content:**
- The row background changes to a very subtle error tint: `{surfaces.card}` with
  a `{semantic.error}` left border at `3px` (same as message bubble accent
  border). The 1px border remains on all other sides.
- Row content becomes: "[Provider Name] — Remove this provider?" (left-aligned,
  `13px`, `{text.primary}`) + "Cancel" button + "Remove" button (right side).
- "Cancel" button: `height: 28px`, `padding: 0 12px`, `border-radius: {radius.md}`.
  Background: transparent. Border: `1px solid {borders.default}`. Typography:
  `12px`, `{text.secondary}`. Hover: `{interactive.hover}` background.
- "Remove" button: `height: 28px`, `padding: 0 12px`, `border-radius: {radius.md}`.
  Background: `{semantic.error}`. Typography: `12px`, `{text.inverse}`.
  Hover: `filter: brightness(0.9)`.
- "Cancel" dismisses the confirmation and restores the row to its normal state.
  Transition: `timing.fast`.
- "Remove" executes the removal. The row collapses with a height animation from
  `48px` to `0` over `{timing.medium}` (200ms) with `overflow: hidden`. After
  the animation completes, the row is removed from the DOM.

**Last-provider guard:**
When the user attempts to remove the last remaining provider (roster would become
empty after removal), the confirmation state shows modified messaging:

- Row content: "[Provider Name] — This is your only provider." (left-aligned,
  `13px`, `{text.primary}`) + "Got it" button (right side, styled as "Cancel").
- No "Remove" button. The user cannot remove their last provider from here —
  they are gently stopped, not blocked with an error.
- Rationale: an empty roster leads to the onboarding empty state, which is
  disruptive to an active user who may have clicked remove by accident. If a user
  genuinely wants to remove all providers, they do so by removing the second-to-
  last first (which has a normal confirmation), then removing the last (which shows
  this message). This creates enough friction to prevent accidental total removal.
  Two-step: they can't. One-step: soft block with messaging.

### 1.6 Add Built-in Provider

**Section label:** "Add a provider" — `11px`, `font-weight: 600`, `{text.muted}`,
uppercase, `letter-spacing: 0.06em`. `margin-bottom: 8px`.

**Subsection label (built-in sub-row):** "Built-in providers" — `12px`,
`font-weight: 500`, `{text.secondary}`. `margin-bottom: 8px`.

**Display:** A horizontal wrapping row of add-provider chips. One chip per
built-in provider not already in the roster.

**Add-provider chip:**
- Shape and dimensions match the Model Identity Pill (`height: 32px`, `border-
  radius: {radius.full}`, `padding: 0 12px`, `gap: 8px`).
- Background: transparent.
- Border: `1px dashed {borders.default}`.
- Contents: model color dot (7px, `{accents.model-*}`) + model display name
  (`13px`, `font-weight: 500`, `{text.muted}`).
- Hover: background `{interactive.hover}`, border becomes solid `{borders.strong}`,
  text color `{text.secondary}`. Transition: `timing.fast`.
- Click: immediately adds this built-in to the roster (calls Gate's
  `addBuiltInProvider`). The chip disappears with a `timing.fast` fade-out. The
  new provider row appears at the bottom of the configured list with a brief
  fade-in (`timing.medium`). No confirmation needed for adding.
- Cursor: `pointer`.
- Aria label: "Add [Provider Name] to your providers"
- Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, `{radius.full}`.
- `gap: 8px` between chips, `flex-wrap: wrap`.

**All built-ins already added:**
When all 6 built-in providers are already in the roster, the built-in chips area
is replaced by a message:

- Text: "All built-in providers are configured." — `13px`, `{text.muted}`.
- No icon, no badge. Just the text.

### 1.7 Add Custom Endpoint Form

**Subsection label:** "Custom endpoint" — `12px`, `font-weight: 500`,
`{text.secondary}`. `margin-bottom: 12px`.

**Description text (below label):** "Connect any OpenAI-compatible API endpoint."
— `12px`, `font-weight: 400`, `{text.muted}`. `margin-bottom: 16px`.

**Form layout:** a single vertical column. Each field is a `label + input` pair
stacked with `16px` (`{spacing.4}`) gap between pairs. Submit and cancel buttons
follow the last field pair.

**Form fields (in order):**

---

**Field 1: Display Name** (required)

- Label: "Display name" — `12px`, `font-weight: 500`, `{text.secondary}`.
  `display: block`, `margin-bottom: 6px`.
- Input: `<input type="text">`. `height: 40px`. `width: 100%`. Padding: `0 12px`.
  `border-radius: {radius.md}`. Background: `{surfaces.input}`. Border: `1px
  solid {borders.default}`. Typography: `14px`, `{text.primary}`.
- Placeholder: "My Llama Server" — `{text.muted}`.
- Focus: border transitions to `{borders.strong}` at `timing.fast`. Focus ring:
  `2px solid {interactive.focusRing}`, `2px offset`.
- Validation: required. Empty on submit → see section 1.8.
- Max length: 40 characters.

---

**Field 2: Endpoint URL** (required)

- Label: "Endpoint URL" — same label style as Field 1.
- Input: `<input type="url">`. Same dimensions and style as Field 1.
- Placeholder: "https://my-server.example.com/v1" — `{text.muted}`.
- Helper text (below input, always visible): "Must be an OpenAI-compatible
  `/chat/completions` endpoint." — `11px`, `{text.muted}`. `margin-top: 4px`.
- Focus: same as Field 1.
- Validation: required; must be a valid URL beginning with `https://` or
  `http://`. Empty or invalid on submit → see section 1.8.

---

**Field 3: Model String** (required)

- Label: "Model string" — same label style.
- Input: `<input type="text">`. Same dimensions and style as Field 1.
- Placeholder: "llama3.2:latest" — `{text.muted}`.
- Helper text (always visible): "The model identifier passed to the API." —
  `11px`, `{text.muted}`. `margin-top: 4px`.
- Validation: required.

---

**Field 4: API Key** (optional)

- Label: "API key" — `12px`, `font-weight: 500`, `{text.secondary}`. Inline
  with a "(optional)" suffix: `{text.muted}`, `font-weight: 400`. Layout:
  `display: flex`, `gap: 6px`, `align-items: baseline`. Label and "(optional)"
  are on the same line.
- Input: `<input type="password">`. Same dimensions and style as Field 1.
- Placeholder: "Leave blank for keyless endpoints (Ollama, LM Studio)" —
  `{text.muted}`.
- Helper text (always visible): "Never logged or transmitted except to your
  endpoint." — `11px`, `{text.muted}`. `margin-top: 4px`.
- No validation — optional. May be empty.
- Show/hide toggle: a `14px × 14px` eye SVG icon absolutely positioned right
  inside the input (`right: 12px`, vertically centered). Clicking toggles input
  type between `password` and `text`. Icon color: `{text.muted}`. Hover:
  `{text.secondary}`. Aria label: "Show API key" / "Hide API key" (toggled).
- The input must have `right-padding: 36px` to prevent text running under the
  eye icon.

---

**Accent Color** (optional, for custom providers only)

- This is not a text field. It is a color swatch row below the API key field.
- Label: "Accent color" — same label style as Field 1. `margin-bottom: 6px`.
- Description (below label): "Used for this provider's identity dot." —
  `11px`, `{text.muted}`. `margin-bottom: 8px`.
- Color swatch row: `display: flex`, `align-items: center`, `gap: 8px`.
  - Color swatch button: `36px × 36px`, `border-radius: {radius.sm}`.
    Background: currently selected accent color (default: `{accents.model-other}`).
    Border: `1px solid {borders.default}`. Contains a hidden `<input type="color">`
    triggered on click (same pattern as the color picker popover in
    `accent-color-customization.md`).
  - Current color hex display: `<span>`, `12px`, `{text.muted}`. Shows the
    hex string of the current selection (e.g. "#FF8D77").
  - "Reset" text button: `11px`, `{text.muted}`. "Reset to default". Hover:
    `{text.secondary}`, underline. Clicking resets to `{accents.model-other}`.
    Shown only when a non-default color is selected.
- Auto-save: the swatch color updates in real time as the user picks. No apply
  button — the color is captured when the form is submitted.

---

**Submit and Cancel buttons:**

`margin-top: 24px` (`{spacing.6}`) from the last field.

Layout: `display: flex`, `gap: 8px`, `justify-content: flex-start`.

**Add provider button (primary):**
- Text: "Add provider"
- Height: `40px`. Padding: `0 20px`. `border-radius: {radius.md}`.
- Background: `{accents.model-claude}` (amber — same as send button, same
  rationale: primary action surface).
- Typography: `14px`, `font-weight: 600`, `{text.inverse}`.
- Hover: `filter: brightness(1.1)`.
- Active/press: `filter: brightness(0.9)`, `transform: scale(0.98)`.
- Disabled (form invalid): background `{interactive.hover}`, text `{text.muted}`,
  `cursor: not-allowed`, `opacity: 0.6`.
- Transition: `timing.fast` on all properties.

**Clear form button (secondary):**
- Text: "Clear"
- Height: `40px`. Padding: `0 16px`. `border-radius: {radius.md}`.
- Background: transparent. Border: `1px solid {borders.default}`.
- Typography: `14px`, `font-weight: 500`, `{text.secondary}`.
- Hover: background `{interactive.hover}`, border `{borders.strong}`.
- Clicking clears all fields and resets the accent color to default. Does not
  close or navigate away from the form — it stays visible so the user can fill
  it out again.

**On successful add:**
- All form fields clear.
- The new provider row appears at the bottom of the configured list with a
  `timing.medium` fade-in and a brief slide-in from `translateY(8px)` to
  `translateY(0)`.
- The panel scrolls to make the new row visible if the configured list is long.
  Aria uses `scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.
- No toast notification. The new row appearing is confirmation enough.

### 1.8 Form Validation States

Validation runs on submit attempt. Individual fields are not validated while the
user types — only on submit or on blur after a submit has been attempted.

**Invalid field visual:**
- Border transitions to `{semantic.error}` at `timing.fast`.
- An error message appears below the field (above any helper text if both are
  present — error message takes priority). Error message: `11px`, `{semantic.error}`,
  `font-weight: 400`. `margin-top: 4px`.
- The field's helper text is hidden when an error message is showing (same space).

**Error messages per field:**
- Display name empty: "Display name is required."
- Endpoint URL empty: "Endpoint URL is required."
- Endpoint URL invalid format: "Enter a valid URL (e.g. https://my-server.example.com/v1)"
- Model string empty: "Model string is required."
- No error state for API key — it is optional.

**Error recovery:** when the user corrects the field and submits again (or tabs
away after a failed submit), the error state clears if the field is now valid.
Border returns to `{borders.default}` at `timing.fast`. Error message removes.

**Post-blur validation trigger:** after the first failed submit attempt, fields
validate on blur (not on keystroke). This avoids premature error states while
the user is still typing, but provides real-time feedback once they've signaled
completion.

---

## 2. Onboarding Empty State

Shown when the `ProviderRoster` is empty — no built-in or custom providers
configured. This is the first-run experience for a new user.

### 2.1 When It Appears

Aria checks the ProviderRoster on app load (and on any roster change). If
the roster is empty:
- The conversation column body (the area between the sidebar and the input bar)
  is replaced by the onboarding empty state component.
- The sidebar, sidebar header, and input bar remain visible and in their normal
  position.
- The model selector trigger ("X models") shows the no-providers state (section 3.3).

When the user adds their first provider (via the panel or via the inline CTA
in the onboarding state), the onboarding state unmounts and the normal
conversation view appears.

### 2.2 Layout

The empty state occupies the full conversation column: `width: 100%`,
`height: 100%`, `display: flex`, `flex-direction: column`, `align-items: center`,
`justify-content: center`. The content block is vertically and horizontally
centered.

**Content block max-width:** `400px`. Centered within the column.
**Content block padding:** `24px` (`{spacing.6}`) horizontal for smaller viewports.

### 2.3 Visual Components

**Icon treatment:**
- A single SVG icon, `64px × 64px`, centered above the heading.
- Use a "chat bubbles with a plus" or "connected nodes" concept — something that
  reads as "connect models, start talking." Not a generic empty-state illustration.
- Color: `{accents.model-claude}` (amber). This is the one place in the onboarding
  where a model accent color is used as an illustration element, not as model
  identity. Rationale: amber is warm and welcoming; using it here draws the eye
  and signals that this is a positive starting point, not an error state. The icon
  should feel like an invitation, not a warning.
- `margin-bottom: 24px` (`{spacing.6}`).

**Heading:**
- Text: "Welcome to Roundtable"
- Typography: `24px`, `font-weight: 700`, `{text.primary}`.
- `margin-bottom: 12px` (`{spacing.3}`).
- Text alignment: `center`.

**Description:**
- Text: "Roundtable lets you talk with multiple AI models at once — same
  question, multiple perspectives, side by side. Add a provider to get started."
- Typography: `15px`, `font-weight: 400`, `line-height: 1.6`, `{text.secondary}`.
- `margin-bottom: 32px` (`{spacing.8}`).
- Text alignment: `center`.
- Max-width: inherits from content block (`400px`).

**Primary CTA button:**
- Text: "Add your first provider"
- Height: `48px`. Padding: `0 28px`. `border-radius: {radius.md}`.
- Background: `{accents.model-claude}` (amber).
- Typography: `15px`, `font-weight: 600`, `{text.inverse}`.
- Hover: `filter: brightness(1.1)`.
- Active/press: `filter: brightness(0.9)`, `transform: scale(0.98)`.
- Transition: `timing.fast`.
- Clicking opens the Provider Settings Panel (slide in from right per section 1.1).
  The panel opens to the "My Providers" view, which shows the empty configured
  list state (dashed container) and the Add sections below. The user can
  immediately click a built-in chip or fill in the custom form.
- Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, `{radius.md}`.
- `margin-bottom: 24px` (`{spacing.6}`).

**Secondary text link (below the button):**
- Text: "Have an OpenAI-compatible API? Add a custom endpoint."
- Typography: `13px`, `{text.muted}`. "custom endpoint" is underlined.
- Hover on the underlined portion: `{text.secondary}`, underline persists.
- Clicking: opens the Provider Settings Panel, same as the primary CTA. The panel
  auto-scrolls to the "Add custom endpoint" form and places focus on the Display
  Name field.
- `text-align: center`.

### 2.4 Tone

The empty state must feel welcoming, not like an error or a failure state. Key
decisions that achieve this:

- Amber icon — warm, not cold. Not the error red, not the muted gray.
- "Welcome to Roundtable" — the user is greeted, not warned.
- Description explains what the product does — new users may not fully understand
  "providers" yet. The copy gives them enough context to feel oriented.
- No warning iconography, no caution language, no "nothing here yet" phrasing.
- The onboarding state is not displayed with any error styling. It uses
  `{text.primary}` and `{text.secondary}` — normal content colors.

---

## 3. Model Selector Updates

The model selector panel (fully specced in `components.md` section 4) gains
roster-awareness. This section specifies what changes and what stays the same.

**What does not change:**
- The trigger button position and shape (pill with model count + chevron).
- The panel container layout, background, border, shadow.
- The pill component itself (shape, dot, label, toggle behavior).
- Section labeling ("Active models").
- The "Add model" button shape.

**What changes:**
- The source of pills is now the `ProviderRoster`, not a hardcoded list.
- The "Add model" dropdown now shows only roster-configured providers that are
  not currently active.
- New edge states: empty active set, no providers in roster.

### 3.1 Pills Come From the Roster

The model selector pill row renders one pill per `ProviderConfig` entry in the
roster. All pills render in roster order (the order providers were added).

**Built-in provider pill:** uses the built-in's model-specific accent token
(`{accents.model-claude}`, etc.) for its dot. Label is the model display name.

**Custom provider pill:** uses the `color` field from `CustomProviderConfig`
as its dot color (written as an inline CSS variable override on the dot element,
not a global CSS var). If `color` is undefined, uses `{accents.model-other}`.
Label is the `displayName` from `CustomProviderConfig`.

**Roster with 1 provider:**
- One pill visible. The pill renders normally.
- Because the minimum-active-models rule (from `components.md` section 2,
  Toggle Behavior) means this single pill cannot be deactivated, it renders in
  active state at all times with the shake-on-deactivate-attempt behavior
  unchanged.
- The "Add model" button appears as normal — it prompts the user to add another
  provider from the roster (but since only 1 is configured and it's already
  active, the "Add model" dropdown is empty — see section 3.2).

**Roster with 3 providers:**
- Three pills. Normal active/inactive toggle behavior.
- Row wraps if needed (`flex-wrap: wrap`). Standard `gap: 6px`.

**Roster with 6 providers:**
- Six pills. Same as above.
- No horizontal scroll — always wraps.

**More than 6 providers (custom endpoints make this possible):**
- Pills wrap across as many rows as needed.
- No maximum. The panel container does not have a max-height — it grows to
  accommodate all pills. `{shadow.lg}` elevation still applies.
- If the panel grows tall enough to approach the top of the viewport, Aria adds
  `max-height: calc(100vh - 160px)` and `overflow-y: auto` on the panel container.
  This prevents the panel from exceeding the viewport. The internal scroll uses
  the standard scrollbar style.

### 3.2 "Add Model" Dropdown — Roster-Filtered

The "Add model" popover dropdown (specced in `components.md` section 4, "Model
Selection Dropdown") now shows only roster-configured providers that are not
currently active in the conversation.

**Content:** For each `ProviderConfig` in the roster that is not currently
active, one row: color dot (7px) + provider name (`14px`, `{text.primary}`) +
provider type label (`12px`, `{text.muted}` — "Built-in" or "Custom").

**"Add model" button visibility:**
- When all roster-configured providers are already active: the "Add model" button
  is hidden (per `components.md` existing spec). No change here.
- When the roster is empty: the "Add model" button is hidden. The selector instead
  shows the no-providers state (section 3.3).

**Empty dropdown state** (roster has providers but all are already active):
- The "Add model" button is hidden — same as the current "all models active" case.
  This handles the roster-powered version of the same condition.

### 3.3 Empty Active State (All Models Toggled Off)

With a roster of 2+ providers, it is technically possible for a user to toggle
off all but one and then be stopped by the minimum-active rule. However, the
minimum-active rule prevents zero-active from occurring in normal use. This state
spec is for robustness — if somehow the active set is empty (e.g. a provider is
removed while it was the only active model), the selector must handle it.

**Zero active state display:**
- The "Active models" label shows normally.
- In place of pills, a single placeholder chip renders:
  - Shape: same pill shape as a normal pill (`height: 32px`, `border-radius:
    {radius.full}`, `padding: 0 12px`).
  - Background: transparent. Border: `1px dashed {borders.default}`.
  - Content: "No models active" — `13px`, `{text.muted}`. Centered.
  - Not clickable. Cursor: default.
- The "Add model" button appears normally (if there are inactive providers in
  the roster to add).
- The model selector trigger pill shows "0 models" — the existing trigger chip
  text format is "N models", so zero is represented as "0 models". The chevron
  icon is present as normal.

**Input bar during zero active state:**
- The send button is disabled (same as the disabled state in `components.md`
  section 3). No new behavior needed — no active models means no models to send
  to, which is the same logical gate as "stream in progress."
- The placeholder text in the textarea changes to "Add a model to start
  chatting" — same typography as the normal placeholder (`{text.muted}`, `15px`).

### 3.4 No-Providers-in-Roster State

When the roster is empty, the model selector trigger and panel show a special
no-providers state.

**Trigger button (in the input bar):**
- Text: "Add providers" in place of "N models".
- Same chip shape as the normal trigger: `height: 24px`, `border-radius:
  {radius.full}`, `border: 1px solid {borders.subtle}`.
- Font: `12px`, `font-weight: 500`, `{text.muted}`.
- No chevron icon. A small `+` icon (12px) to the left of the text instead.
- Hover: border transitions to `{borders.default}`.
- Clicking opens the Provider Settings Panel (same as the primary CTA in the
  onboarding empty state).

**Model selector panel — no-providers state:**
The panel does NOT open in its normal form. Clicking "Add providers" goes directly
to the Provider Settings Panel. No intermediate model selector panel appears.
This avoids showing a panel with nothing in it and then requiring a second click
to get to where providers are managed.

---

## 4. Cross-Agent Dependencies

| Dependency | Blocking what | Notes |
|---|---|---|
| Gate `getProviderRoster()` — returns current roster | Aria #99 (panel), #100 (onboarding), #98 (selector) | Already built in #93. Aria reads roster on load and subscribes to changes. |
| Gate `addBuiltInProvider()` | Aria #99 (built-in chip click) | Already built in #93. |
| Gate `removeProvider()` | Aria #99 (remove button confirm) | Already built in #93. |
| Gate `addCustomProvider()` | Aria #99 (form submit) | Already built in #93. |
| Atlas: what happens when the only active provider is removed from the roster mid-session? | Aria #98 (selector update) | If a user removes a provider while it is the active model (it has an in-flight stream), Atlas should cancel the stream before the removal is committed. Behavior TBD — Luma's lean: remove cancels the stream (not option 2 "let it complete" — a provider being removed is a harder stop than a model being toggled off). Aria should not show a streaming bubble after the provider row is gone. **This must be confirmed with Atlas before Aria implements.** |
| Roster change event: how does Aria subscribe to roster changes? | All three Aria issues | Gate's #93 implementation exposes sync CRUD functions. If Aria needs to react to roster changes (provider added/removed), the simplest approach is a local event emitter or React context that Aria controls — Gate doesn't need to change. Aria owns the subscription model; Gate provides the data. This is Aria's implementation decision, not a Gate contract change. |

---

## 5. Token Usage Summary for Aria

New visual elements introduced in this spec and their token mapping:

| Element | Token | CSS Class |
|---|---|---|
| Panel background | `{surfaces.background}` | `bg-bg` |
| Provider row background | `{surfaces.card}` | `bg-card` |
| Provider row border (default) | `{borders.default}` | `border-border` |
| Provider row border (hover) | `{borders.strong}` | `border-border-strong` |
| Provider row hover fill | `{interactive.hover}` | `bg-hover` |
| Provider name text | `{text.primary}` | `text-text-primary` |
| Section labels | `{text.muted}` | `text-text-muted` |
| "Key set" badge text + bg tint | `{semantic.success}` | `text-success` |
| "No key" badge text + bg tint | `{semantic.warning}` | `text-warning` |
| Error left border (confirmation) | `{semantic.error}` | `border-error` |
| Remove button hover icon | `{semantic.error}` | `text-error` |
| Form input background | `{surfaces.input}` | `bg-input` |
| Form input border (default) | `{borders.default}` | `border-border` |
| Form input border (focus) | `{borders.strong}` | `border-border-strong` |
| Form error message | `{semantic.error}` | `text-error` |
| Primary action buttons | `{accents.model-claude}` | `bg-accent-claude` |
| Primary button text | `{text.inverse}` | `text-text-inverse` |
| Onboarding heading | `{text.primary}` | `text-text-primary` |
| Onboarding description | `{text.secondary}` | `text-text-secondary` |
| Onboarding icon | `{accents.model-claude}` | `text-accent-claude` |
| Empty active state placeholder | `{borders.default}` | `border-border` |
| No-providers trigger `+` icon | `{text.muted}` | `text-text-muted` |
| Add-provider chip border | `{borders.default}` | `border-border` (dashed, CSS class + `border-dashed`) |
| Add-provider chip hover border | `{borders.strong}` | `border-border-strong` |

---

## 6. Motion Additions

These supplement the existing motion spec in `motion.md`.

**Provider row removal animation:**
- Height collapses from `48px` to `0` over `{timing.medium}` (200ms) with
  `ease-in` easing. `overflow: hidden` on the row wrapper. After collapse,
  remove from DOM.
- `opacity` simultaneously transitions from `1` to `0` over `{timing.fast}`
  (100ms), beginning immediately. The element fades out faster than it collapses
  — the row disappears visually before the space fully closes.
- `prefers-reduced-motion`: height collapses instantly (no animation). Row
  disappears immediately.

**Provider row addition animation:**
- On successful add (built-in chip click or custom form submit), new row enters
  with: `opacity: 0 → 1` over `{timing.medium}` (200ms) and `translateY(8px) →
  translateY(0)` over the same duration. Easing: `ease-out`.
- `prefers-reduced-motion`: row appears instantly, no animation.

**Provider settings panel open/close:**
Already specified in section 1.1. No additional motion spec needed.

**Onboarding empty state — no entrance animation.** It renders in the initial
state when the app loads. No fade-in, no delay. `prefers-reduced-motion`
has no effect (there is no animation to remove).

---

## 7. Accessibility Notes for Aria

- The panel must be wrapped in a `<dialog>` element or managed with `role="dialog"`,
  `aria-modal="false"` (not a modal — does not trap focus), `aria-labelledby`
  pointing to the "My Providers" heading.
- Focus management on panel open: move focus to the panel's first interactive
  element (the close button `×`).
- Focus management on panel close: return focus to the gear icon button in the
  sidebar header that opened the panel.
- Provider rows are `<div>` elements with `role="listitem"` inside a `role="list"`.
  The configured providers container has `aria-label="Configured providers"`.
- The add-provider chips are `<button>` elements. Already handled in section 1.6.
- Form labels are `<label>` elements with `for` attributes pointing to input IDs.
- Error messages use `role="alert"` so screen readers announce them immediately
  when they appear.
- The removal confirmation replaces the row content in place — no new dialog or
  modal. Aria adds `aria-live="polite"` on the row container so screen readers
  announce the confirmation message when it appears.
- The onboarding empty state heading is the `h1` of the conversation column
  when the roster is empty. Aria manages this heading level consistently with
  the rest of the heading hierarchy.
