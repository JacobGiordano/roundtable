# Font Size Controls — UI Scale and Message Content Scale

**Owner:** Luma
**Issue:** #600
**Date:** 2026-08-15
**Downstream:** Aria (implementation), Ada (a11y audit after Aria ships)

Aria implements these specs exactly. Every value is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Token Schema

### 1.1 CSS Custom Properties

Two new CSS custom properties are introduced. Neither belongs in the theme JSON files — they are user preferences, not design tokens. They live on `:root` and are written by the preference persistence layer (Gate/Vault), not by `applyTheme()`.

| Property | Purpose | Type | Default |
|----------|---------|------|---------|
| `--font-scale-ui` | Scales all chrome/panel/control text | Unitless multiplier | `1.0` |
| `--font-scale-content` | Scales all message body text | Unitless multiplier | `1.0` |

**Why multipliers, not px offsets or rem values:** Tailwind v3's JIT compiler generates static class names at build time. `calc()`-based multipliers let Aria keep Tailwind classes unchanged — she wraps the relevant containers with a CSS rule that applies the multiplier via `font-size: calc(Npx * var(--font-scale-ui))` on a scoping element. This is the only approach that works with Tailwind's static class output without dynamic class generation or a build-time reconfiguration. Absolute px or rem offsets would require Aria to either duplicate every text-size class or use inline styles — both are worse than the multiplier approach.

**Naming rationale:** `--font-scale-ui` and `--font-scale-content` follow the existing `--{category}-{descriptor}` convention in `tailwind-mapping.md`. The `font-scale` category is new and does not collide with any existing property namespace.

### 1.2 DOM Application

**Do not set `font-size` on `:root` or `<html>`.** Setting `font-size` at root distorts every rem-based value in the page including Tailwind's `rem` utilities (`text-sm`, `text-base`, etc.) and any third-party libraries. Instead, both scales are applied via scoping wrapper elements in the component tree.

**UI scale** is set on a wrapper that encloses sidebar, input bar, model selector, settings panel, and thread action menu. Aria chooses the appropriate ancestor element — the spec requires that this wrapper is a direct child of `<body>` or the outermost layout div that encloses all chrome. The wrapper receives:

```css
/* Applied inline by Aria's preference initialization */
font-size: calc(1rem * var(--font-scale-ui));
```

All pixel-specified text sizes inside this wrapper (e.g. `text-[12px]`, `text-[13px]`) must also be written as `calc()` expressions referencing the scale. Because Tailwind generates static class names, Aria writes these sizes as inline style overrides on the scoping wrapper, or wraps sub-regions using a `style` attribute on a containing element. The recommended pattern is a single `<div style={{ fontSize: `calc(1rem * ${uiScale})` }}>` at the layout shell level.

**Content scale** is set on the message thread container — the scrollable area that holds all `MessageBubble` instances. This element already exists in `MessageThread.tsx`. Aria adds:

```css
/* Applied inline by Aria's preference initialization */
font-size: calc(1rem * var(--font-scale-content));
```

All pixel-specified text inside `MessageBubble` (bubble body, markdown, code blocks, metadata) is then expressed as `em` units relative to this container, OR Aria applies `calc(Npx * var(--font-scale-content))` inline on the scoping container and leaves child classes unchanged (since `em` descends from the nearest font-size-setting ancestor).

**Recommended implementation approach for Aria:** Apply `font-size` as an inline style on the two scoping containers using the CSS custom property. Child elements using `text-[Npx]` Tailwind classes will NOT automatically scale — they are in px. Aria must convert the relevant text-size declarations within each scope to use `em` units, or apply `font-size: calc(1em * var(--font-scale-X))` at the container level and replace `px` sizes within that scope with `em` equivalents. The simpler path is `em`-based child sizing within each scoped container.

**Important:** The `--font-scale-ui` and `--font-scale-content` CSS custom properties are set on `:root` by the preference loader. The actual `font-size: calc(...)` expressions are applied inline to the two scoping containers. This distinction matters: `:root` carries the value, the containers carry the application.

### 1.3 Persistence

Both values are stored as user preferences via Gate's settings storage. Storage key naming:
- `fontScaleUi` — stores a float (e.g. `1.0`, `1.125`, `1.25`)
- `fontScaleContent` — stores a float

These keys export and import with user setup (they are preferences, not secrets). Aria reads these values at app initialization and writes `--font-scale-ui` and `--font-scale-content` to `:root` before first paint.

On first load (no stored preference), both default to `1.0`.

---

## 2. Scope Mapping

### 2.1 UI Scale (`--font-scale-ui`) Applies To

All chrome elements — text that is part of the app interface, not part of conversation content.

**Sidebar**
- Conversation thread list: title text, participating model dot labels (if any), timestamp text
- Section headers ("Today", "Yesterday", date group labels, "Archive" toggle label)
- Bulk action bar text (action button labels, selection count)
- "New conversation" button label
- Search input placeholder and typed text
- Any empty state text within the sidebar

**Input bar**
- Textarea placeholder text and user-typed text
- Character count or limit indicator (if present)
- Attachment chips (filename text, remove button label)
- Directed-reply strip: "@ModelName" label text
- Ghost mode indicator label
- At-mention autocomplete popover text (model names, keyboard hints)
- Model count or status text adjacent to the input area

**Model selector panel**
- Model chip labels (model name, version text)
- Active/inactive state labels
- Panel header text
- "Add model" or similar affordance labels

**Settings panel and all sub-panels**
- ProviderSettingsPanel: section headings, provider name labels, field labels, field values, button labels, error messages, status badges
- BackendServerPanel: all text within
- TransferSetupPanel: all text within
- ApiKeyPanel: all labels and values
- ProxySettingsPanel: all labels and values
- UserAccentColorPicker: labels and descriptions

**Thread action menu**
- All menu item labels
- Keyboard shortcut hint text

**Other chrome**
- TooltipContent (tooltips triggered from UI chrome)
- Empty state text in OnboardingEmptyState and ConversationEmptyState (these are chrome, not conversation content)
- Modal headers and body copy (ProxyOnboardingModal)

### 2.2 Message Content Scale (`--font-scale-content`) Applies To

All elements inside the message thread scroll area — text that is conversation content, not app chrome.

**Message bubble body**
- User message text (plain text rendering path)
- Assistant message text (markdown rendering path)
- Streaming token text as it arrives

**Markdown content inside message bubbles**
- Headings (h1 through h6 equivalents — currently `text-[18px]` through `text-[12px]` in `MessageBubble.tsx`)
- Paragraphs (`text-[15px]`)
- Lists and list items (`text-[15px]`)
- Blockquotes (inherits paragraph size)
- Inline code spans (`text-[13px]`, `font-mono`)

**Code blocks**
- The `<pre>`/`<code>` area (`text-[13px]`, `font-mono`)
- Copy button text within code blocks (the "Copy" / "Copied" label) — content scale; 11px base, use `max()` floor (see §5.4)

**Message metadata (per bubble)**
- Model name label in bubble header (`text-[12px]`) — content scale; use `max()` floor (see §5.4)
- Timestamp text (`text-[11px]`) — content scale; use `max()` floor (see §5.4)
- "→ ModelName" directed reply label (`text-[11px]`) — content scale; use `max()` floor (see §5.4)
- Token count or cost display (if present)
- Thinking indicator text (if present inside bubbles)

**Minimum floor for small metadata text:** Any element in this category with a base size ≤ 11px scales with `--font-scale-content` but uses a CSS `max()` floor to prevent illegible rendering at the 0.875× minimum. The implementation pattern for Aria:

```css
font-size: max(10px, calc(11px * var(--font-scale-content)));
```

This preserves scale-up behavior (the dominant use case — users enlarging content to 150% or 200%) while preventing sub-10px text at the 0.875× floor. The 10px floor value is the minimum legible size for incidental text; it applies only when the calculated value would fall below it (i.e. at 0.875× on 11px base, `calc` yields ~9.6px — the `max()` clamps to 10px).

**Ambiguous elements — resolution documented below**

### 2.3 Ambiguous Elements and Resolution

**Code block copy button label ("Copy" / "Copied")**: This sits inside the message bubble. It is a UI action, but it lives within content scale scope. Resolution: **content scale**. Rationale: the button is visually integrated into the code block; scaling the code block text but leaving the button label unscaled creates a visual mismatch. The button's 24px minimum touch target is preserved regardless of text scale.

**Thinking indicator (`ThinkingIndicator`)**: When rendered inside a message bubble during streaming, it is **content scale**. The "Thinking…" text accompanies in-progress content. If `ThinkingIndicator` renders outside bubbles (e.g. as a standalone component in the thread area), it is still content scale — it is part of the conversation stream, not chrome.

**Tooltip text**: Tooltips triggered from chrome elements (model selector, send button, UI icons) are **UI scale**. Tooltips triggered from within a message bubble (e.g. a link hover tooltip) would be content scale, but no such tooltip currently exists.

**Error state text on message bubbles** (the "failed to send" / retry UI): This is **content scale** because it is scoped within the bubble. The error text size tracks the content scale.

**At-mention autocomplete popover**: Resolved as **UI scale**. It is triggered from the input bar and is chrome behavior, not conversation content.

---

## 3. Range and Step

### 3.1 UI Scale Range

| Property | Min | Default | Max | Step |
|----------|-----|---------|-----|------|
| `--font-scale-ui` | `0.875` | `1.0` | `1.25` | `0.125` |

This gives 3 steps below default and 2 above: 0.875 → 1.0 → 1.125 → 1.25.

At `0.875`, a 12px label renders at 10.5px — this is the floor. Text smaller than ~10px becomes illegible for most users; 10.5px is the minimum defensible value. Going lower would harm accessibility without providing meaningful density gain.

At `1.25`, a 12px label renders at 15px — equivalent to body text in many interfaces. This gives meaningful enlargement to all chrome elements without breaking the sidebar layout at the minimum sidebar width (330px, per HANDOFF.md).

**Why not extend UI scale to 200%?** WCAG 1.4.4 (Resize Text) applies to "text" in the sense of body copy and reading content — not form controls or navigation UI. The WCAG intent is that users who need large text for reading can access content. WCAG 1.4.4 is satisfied by the **content scale** reaching 200%. UI chrome at 200% would break every fixed-width panel in the current layout (sidebar at 330px, model chips at set dimensions). A 125% cap is a reasonable, implementable maximum that improves legibility without destroying the layout.

**WCAG note:** The UI scale is a convenience feature, not the primary accessibility path for text enlargement. Users requiring large UI text can use the OS/browser zoom, which satisfies WCAG 1.4.4 independently. The content scale (below) is where WCAG 1.4.4 compliance is directly addressed.

### 3.2 Content Scale Range

| Property | Min | Default | Max | Step |
|----------|-----|---------|-----|------|
| `--font-scale-content` | `0.875` | `1.0` | `2.0` | `0.125` |

This gives 3 steps below default and 8 above: 0.875, 1.0, 1.125, 1.25, 1.375, 1.5, 1.625, 1.75, 1.875, 2.0.

At `2.0`, the base message paragraph (`text-[15px]`) renders at 30px. This directly satisfies WCAG 1.4.4, which requires that text can be resized up to 200% without loss of content or functionality.

At `0.875`, the base paragraph renders at ~13px — denser reading for users who prefer it. This is not an accessibility affordance; it is a density preference. WCAG does not prohibit making text smaller by user choice.

At `2.0`, code blocks render at 26px — large but functional. The `overflow-x: auto` on code blocks handles horizontal overflow at all scales. Bubble max-width and padding remain fixed; only text size grows.

**Step rationale:** 0.125 steps correspond to 1/8 increments. At 15px base: each step = 1.875px change. This is perceptibly different without being jarring. 11 total steps for content (3 below, 8 above) is a wider range than UI but necessary to reach 200%.

### 3.3 Are the Ranges the Same?

No. The ranges differ deliberately:
- **UI scale**: 0.875–1.25. Chrome layout constrains how large UI text can grow.
- **Content scale**: 0.875–2.0. Message content is in a scrollable container; it can grow without breaking layout. WCAG 1.4.4 compliance requires reaching 200%.

The minimum (0.875) and step (0.125) are identical for both — this creates consistency in the controls and reduces cognitive load for users operating both.

---

## 4. Settings Component Spec

### 4.1 Placement

The two font scale controls appear in a new **"Reading"** section within `ProviderSettingsPanel`, above the existing "Appearance" or theme section. The "Reading" section sits between the provider list and the "Appearance" section.

**Section heading**: "Reading" — same typographic treatment as existing section headings: `11px`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.05em`, `{text.muted}`, `margin-bottom: 8px`.

**Why a new section, not folded into "Appearance"?** These controls are reading preferences, not visual style choices. A user who wants large message text does not necessarily want to change their theme. Separating them by function reduces cognitive load and makes the controls easier to find.

### 4.2 Control Type: Stepper

Both controls use a **stepper (+/–)** rather than a slider, segmented control, or dropdown.

**Justification:**
- Sliders at this precision (0.125 steps) are difficult to hit accurately, especially at small panel widths. A slider spanning 0.875–2.0 with 9 stops would need precise targeting.
- Segmented controls with 11 options are too wide for the settings panel (the panel is `calc(100vw - 330px)` minus inner padding — this is adequate for a stepper but not for 11 segments).
- Dropdowns work but require an extra interaction to reveal options. For a preference users adjust occasionally and preview in real time, a stepper with live preview is better UX.
- Steppers give clear discrete steps, which matters here — 0.125 increments are meaningful, and the user should not be able to set arbitrary fractional values.

### 4.3 Stepper Anatomy

Each control is a labeled row:

```
[Label]                    [–] [Value display] [+]
```

**Label** (left-aligned, takes remaining flex space):
- UI scale label: "Interface size"
- Content scale label: "Message text size"
- Typography: `13px`, `font-weight: 500`, `{text.secondary}`

**Value display** (centered between the +/– buttons):
- Shows the current scale as a percentage: `87%`, `100%`, `113%`, `125%`, etc.
- Computed as `Math.round(scale * 100) + '%'`
- Typography: `13px`, `font-weight: 600`, `{text.primary}`
- Min-width: `44px` (accommodates "200%" without layout shift)
- Text-align: `center`

**Why percentage, not multiplier?** `100%` is meaningfully legible to non-technical users as "default." `1.0` is not. `113%` conveys "slightly larger than default." The raw multiplier is stored internally; only the display is converted.

**Decrement button (–)**:
- Icon: a minus symbol rendered as text `–` or via a MinusIcon (16px)
- Dimensions: `28px × 28px` (`w-7 h-7`)
- Border-radius: `{radius.sm}` (4px) — tighter than `md` because the button is small
- Background: `{surfaces.input}` default; `{interactive.hover}` on hover; `{interactive.active}` on press
- Border: `1px solid {borders.default}`
- Text/icon color: `{text.secondary}` default; `{text.primary}` on hover
- Disabled state (when at minimum): `opacity: 0.4`, `cursor: not-allowed`, no hover effect
- `aria-label`: "Decrease interface size" / "Decrease message text size"
- Focus ring: `2px solid {interactive.focusRing}`, `1px offset` (`focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1`)
- Transition: `background-color`, `border-color`, `color` at `fast` (100ms)

**Increment button (+)**:
- Same dimensions and styling as decrement
- Icon: plus symbol `+` or PlusIcon (16px)
- Disabled state (when at maximum): same as decrement disabled
- `aria-label`: "Increase interface size" / "Increase message text size"

**Keyboard behavior on the stepper buttons:**
- `Space` and `Enter` activate the button (standard button behavior)
- Arrow keys do NOT adjust the value from the buttons — they are standard buttons, not a slider. If Aria wants to add arrow key adjustment, it goes on the value display element (as a `role="spinbutton"` — see below).

**Value display as `role="spinbutton"` (recommended):**
Aria should render the value display as a `<div role="spinbutton">` (or a visually-styled `<input type="number">` with `min`, `max`, `step` suppressing native spin UI via CSS). The spinbutton:
- `aria-valuemin`: min multiplier as integer percentage (87)
- `aria-valuemax`: max multiplier as integer percentage (200 for content, 125 for UI)
- `aria-valuenow`: current multiplier as integer percentage (e.g. 100)
- `aria-valuetext`: current display string (e.g. "100 percent, default")
- `aria-label`: "Interface size" / "Message text size"
- Arrow Up / Arrow Right: increment one step
- Arrow Down / Arrow Left: decrement one step
- `Home`: jump to minimum
- `End`: jump to maximum
- The spinbutton is keyboard-focusable (`tabIndex={0}`) and sits between the two buttons in DOM order (matching visual order)

### 4.4 Layout

The two stepper rows sit in a vertical flex column with `gap: 16px` (`gap-4`) between rows, inside the "Reading" section container.

Each row is a flex row: `display: flex`, `align-items: center`, `justify-content: space-between`, `gap: 12px`.

The +/– cluster (right side) is a flex row: `display: flex`, `align-items: center`, `gap: 8px` (gap between – button, value display, + button).

**Full section layout:**

```
Reading                                          ← section header (11px uppercase muted)

Interface size                    [–] [100%] [+]
Message text size                 [–] [100%] [+]
                    [Reset to defaults]           ← right-aligned or centered reset link
```

### 4.5 Reset-to-Default Affordance

**Yes.** A single "Reset to defaults" text button appears below both controls. It resets both scales to `1.0` simultaneously. It does not reset theme or any other preference.

- **Content**: "Reset to defaults"
- **Typography**: `12px`, `font-weight: 500`, `{text.muted}` default; `{text.secondary}` hover
- **Background**: none (text link style — no border, no background)
- **Underline**: none at rest; `text-decoration: underline` on `focus-visible` only (WCAG 1.4.1 — do not rely solely on color to indicate interactivity)
- **Placement**: right-aligned below the two stepper rows, `margin-top: 8px`
- **Disabled state**: when both scales are already at `1.0`, the button is `aria-disabled="true"` and `pointer-events: none`. It does not hide — hiding creates a confusing disappearance. Opacity: `0.4` when disabled.
- `aria-label`: "Reset interface size and message text size to defaults"
- Focus ring: `2px solid {interactive.focusRing}`, `1px offset`

**Why a single reset for both, not per-control resets?** Per-control resets add two more interactive elements to a small section without meaningfully improving usability. Users rarely reset just one scale. A single reset is simpler and has a clearer scope (the whole "Reading" section).

### 4.6 Live Preview

When the user adjusts either scale, the effect is **immediate and live** — the CSS custom property on `:root` updates with each step. The user sees the result in real time behind the settings panel (the message thread is visible through the panel on wide viewports, and the settings panel itself reflects UI scale changes immediately since it is in the UI scale scope).

No "Apply" button. No confirmation. This is a reversible preference with immediate visual feedback.

---

## 5. Edge Cases

### 5.1 Minimum UI Scale + Maximum Content Scale

`--font-scale-ui: 0.875` + `--font-scale-content: 2.0`

- The sidebar and chrome render at ~87% of default — slightly more compact
- Message bubbles render at 200% — very large text
- The message thread occupies the same layout column regardless of content scale; the thread scrolls vertically, so large text simply requires more scrolling
- Bubble max-width is unchanged; at 200%, a paragraph line may wrap more aggressively, increasing vertical height of individual bubbles

**Risk**: At 200% content scale, code blocks with long lines overflow horizontally. The existing `overflow-x: auto` on code blocks handles this — horizontal scrolling within the code block. Aria does not need to add additional overflow protection; it is already in place per the `MessageBubble.tsx` code block spec.

**Layout verdict**: This combination holds. No layout breakage expected. The thread scrolls, the sidebar stays compact. The combination is unusual but functional.

### 5.2 Maximum UI Scale + Minimum Content Scale

`--font-scale-ui: 1.25` + `--font-scale-content: 0.875`

- Chrome text renders at 125% — labels, section headers, and button text all larger
- Message content renders at ~87% — compact reading

**Risk**: At UI scale 1.25, the model selector chip labels (currently `text-[12px]` → 15px at 125%) may overflow their chip containers if model names are long. Aria must add `text-overflow: ellipsis` and `overflow: hidden` with `max-width` constraints on chip labels as a precaution. This is an existing partial concern at default scale; the spec makes it explicit.

**Risk**: The sidebar thread list titles (currently `text-sm` → `14px` → 17.5px at 1.25) within a 330px sidebar. Title text should already be `truncate` (which it is, per existing component code). This holds at 1.25.

**Risk**: The settings panel form labels grow to 15–17px range. This increases the vertical height of the settings panel content, potentially making it scrollable. The settings panel already handles overflow scroll — this is expected behavior, not a breakage.

**Layout verdict**: This combination holds with the chip label overflow guard noted above.

### 5.3 Both at Maximum

`--font-scale-ui: 1.25` + `--font-scale-content: 2.0`

- All UI elements are 25% larger than default
- All message content is 200% of default

At 2.0 content scale, message bubbles become very tall. In a busy conversation thread, each bubble requires significantly more scroll distance. This is intentional — the user has chosen maximum text size. The layout must not break; it just becomes more scroll-heavy.

The sidebar model dots (7px per `components.md`) are not text, so they do not scale. Their visual relationship to nearby text will change when text is very large. This is acceptable — dots are decorative identity indicators, not navigational elements.

### 5.4 Tailwind v3 Constraints for Aria

**Static class names:** Tailwind v3 JIT does not generate `calc()` class names. `text-[calc(15px*var(--font-scale-content))]` would not be valid Tailwind syntax and will not work. Aria must apply scaling through one of these approaches:
1. Inline `style` prop on the scoping container (`style={{ fontSize: `calc(1rem * ${scale})` }}`), with all children using relative `em` units for their sizing
2. CSS custom property on `:root` + a wrapper element whose `font-size` is set via inline style, with children using `em` — this is the recommended path per this spec

**`text-xs` minimum and the `max()` floor pattern:** Tailwind's `text-xs` = 12px. At content scale 0.875, a `text-xs` element in a scoped container would render at ~10.5px. For elements that are content and should scale — timestamps, directed-reply labels, bubble header model names, code block copy button labels — the correct resolution is a CSS `max()` floor, not exclusion from scaling. Excluding these elements creates the worse problem in the opposite direction: at content scale 1.5× or 2.0×, a fixed 11px timestamp next to 24–30px body text looks tiny and disconnected. The scale-up case is far more common than scale-down, and the 0.875× floor concern is an implementation detail, not a reason for exclusion.

**Implementation pattern for small text elements (base size ≤ 11px):**

```css
font-size: max(10px, calc(11px * var(--font-scale-content)));
```

For the 12px bubble header model name:

```css
font-size: max(10px, calc(12px * var(--font-scale-content)));
```

The `max()` floor prevents the calculated value from dropping below 10px at the 0.875× minimum. At 0.875×, `calc(11px * 0.875)` = 9.625px — the `max()` clamps to 10px. At 1.0× and above, the `max()` has no effect and the element scales normally. The 10px floor value is the minimum legible size for incidental metadata text.

**Revised content scale scope (final):**

Elements that scale with `--font-scale-content` (no floor needed — base size > 11px):
- Message body text (15px base)
- Markdown headings (18px, 16px, 15px, 14px, 13px, 12px)
- Markdown paragraphs, lists, blockquotes (15px base)
- Inline code spans (13px)
- Code block content (13px)

Elements that scale with `--font-scale-content` using `max(10px, ...)` floor:
- Timestamp text (11px base — use `max(10px, calc(11px * var(--font-scale-content)))`)
- Directed reply label (11px base — use `max(10px, calc(11px * var(--font-scale-content)))`)
- Bubble header model name label (12px base — use `max(10px, calc(12px * var(--font-scale-content)))`)
- Code block copy button label (11px base — use `max(10px, calc(11px * var(--font-scale-content)))`)

All four small-text elements are content. They are visually integrated into the message bubble or code block. Leaving them fixed while body text scales to 200% produces a broken visual result. The `max()` floor handles the only real concern (sub-10px rendering at minimum scale) without sacrificing the scale-up behavior users need.

Aria should apply the content scale scoping container to the full bubble interior, including header metadata. The `max()` floor pattern applies individually to each small-text element via inline style or a scoped CSS rule — not by excluding them from the scoped container.

### 5.5 Interaction Between the Two Scales

The two scales are fully independent and do not interact at the CSS level — they apply to separate DOM regions. There is no mathematical relationship between `--font-scale-ui` and `--font-scale-content`. A user can set them to different values with no side effects between them.

The only visual tension is aesthetic: at extreme combinations (tiny UI + huge content, or vice versa), the app may look visually unbalanced. This is intentional user choice and requires no programmatic guard.

### 5.6 Export and Import

Both values (`fontScaleUi`, `fontScaleContent`) are included in the settings export payload and restored on import. When importing, the values are validated:
- Must be a number
- Must be within the valid range for their respective scale (ui: 0.875–1.25, content: 0.875–2.0)
- Must be a valid step value (i.e. `(value - 0.875) % 0.125 === 0` within floating-point tolerance)
- If validation fails, the value silently resets to the default (1.0) — do not block the import for an out-of-range preference

---

## 6. Tailwind Mapping Addendum

These are not color tokens and do not belong in the theme JSON. They do not require `tailwind.config.js` changes. No new Tailwind keys are introduced.

The two CSS custom properties are set programmatically (by the preference loader) and consumed via inline style on two container elements. This is the correct and complete integration surface.

**CSS variables to set on `:root` at initialization:**
```
--font-scale-ui: 1.0       /* read from stored preference, default 1.0 */
--font-scale-content: 1.0  /* read from stored preference, default 1.0 */
```

**Applied to containers (Aria's responsibility):**
```
UI chrome wrapper:     style={{ fontSize: `calc(1rem * var(--font-scale-ui))` }}
Message thread wrapper: style={{ fontSize: `calc(1rem * var(--font-scale-content))` }}
```

Child elements within each scope should use `em` for text sizes where scaling is desired. Elements with a base size ≤ 11px use the `max()` floor pattern (see §5.4) rather than being excluded from scaling — they are content and must track content scale.

---

## 7. WCAG Compliance

**1.4.4 Resize Text (AA):** Content scale reaches 200% of default. At 2.0, message body text renders at 30px (from 15px base). No content is lost, clipped, or made inaccessible — the thread scrolls. Code blocks have horizontal overflow scroll. This satisfies 1.4.4.

**1.4.4 for UI scale:** The UI scale tops at 125%, below the 200% WCAG threshold. This is compliant because WCAG 1.4.4 explicitly exempts "captions and images of text" and in practice applies to body/reading text. The primary accessibility path for users needing large UI text is OS/browser zoom, which enlarges everything including chrome. The UI scale control is an additional convenience, not the required a11y path. Aria must not suppress or override browser zoom behavior.

**1.4.12 Text Spacing (AA):** The scoped font-size scaling does not alter line-height, letter-spacing, or word-spacing. Those remain at their authored values. If a user overrides spacing via browser/OS tools, the scoped `font-size` on the container must not conflict. Aria should not hardcode `line-height` as `px` values inside the scaled scope — prefer unitless line-height ratios (e.g. `leading-[1.6]`) so they scale proportionally with the font size.

**2.1.1 Keyboard (A):** The stepper buttons are standard `<button>` elements. The value display uses `role="spinbutton"` with arrow key support. All controls are keyboard-operable. See §4.3 for the full keyboard spec.

**Focus management:** No focus management is needed when scale values change — the settings panel remains open and the user's focus stays on the stepper button they just activated. The live preview updates behind them without requiring focus to move.
