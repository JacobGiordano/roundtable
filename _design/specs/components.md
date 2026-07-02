# Roundtable Component Specs

Aria implements these specs exactly. Every value here is a decision — not a suggestion. If a value is specified, that value is used. If a range appears, the exact value from that range is specified within the same line. No design decisions are deferred to Aria.

Token references use `{category.key}` notation — e.g. `{surfaces.card}`, `{spacing.4}`. These map to the CSS custom properties defined in `tailwind-mapping.md`.

---

## 1. Message Bubble

The message bubble is the primary content unit. Each model's response is one bubble. Multiple bubbles stack vertically in the conversation thread.

### Dimensions & Layout

- **Width**: Full width of the conversation column. No max-width constraint on the bubble itself — the conversation column handles max-width at the layout level (recommendation for Aria: 720px max-width on the column, centered).
- **Min-height**: None. Bubbles grow with content.
- **Padding**: `16px` horizontal (`{spacing.4}`), `12px` vertical (`{spacing.3}`).
- **Margin between consecutive bubbles**: `8px` (`{spacing.2}`).
- **Margin between bubbles from different models**: `16px` (`{spacing.4}`). Aria determines whether consecutive same-model bubbles exist — this spec covers both cases.

### Border Accent (Model Identity)

- **Left border**: `3px solid {accents.model-*}` — color is determined by the model that produced the message.
- **Left border style**: solid, no gap, no rounded ends. The border spans the full height of the bubble.
- **No other borders**: do not add a full perimeter border. The left accent is the only border.
- **Border-radius**: `{radius.md}` (8px) on all four corners.
- **Note**: The 3px left border combined with border-radius on the left creates a slight visual quirk where the border caps slightly. This is acceptable and consistent with how CSS handles this. Do not compensate with special border-radius overrides.

### Background & Shadow

- **Background**: `{surfaces.card}`
- **Shadow**: `{shadow.sm}` in all default states.
- **Shadow on hover**: `{shadow.md}` — subtle lift to indicate interactivity (future: copy, share actions).

### Model Name Header

- **Position**: Top-left of the bubble, inside padding, above message content.
- **Content**: Model display name (e.g. "Claude", "GPT-5.5", "Gemini").
- **Typography**: `12px`, `font-weight: 600`, `{text.secondary}`, `letter-spacing: 0.04em`, `text-transform: uppercase`.
- **Margin below header**: `8px` (`{spacing.2}`) between model name and message body.
- **Color**: `{text.secondary}` — intentionally lower prominence than message content. The left-border accent carries the model identity; the name label is supplementary.

### Message Body

- **Typography**: `15px`, `font-weight: 400`, `line-height: 1.6`, `{text.primary}`.
- **Markdown rendering**: Yes — Aria renders markdown. Code blocks, inline code, bold, italic, lists, headers. Aria owns markdown styling within the bubble.

### Streaming State

- **Active streaming indicator**: A 3px bottom border on the bubble, color `{accents.model-*}`, animated with a left-to-right shimmer sweep.
  - Shimmer: the bottom border is always present at full width; a brighter highlight (~30% opacity white or `#FFFFFF4D`) sweeps from left to right on a 1.4s loop using CSS `@keyframes`.
  - This animation runs until the stream completes.
  - On `prefers-reduced-motion`: the bottom border is shown as a static solid border (no shimmer). It persists until stream completes, then disappears.
- **Streaming cursor**: A `|` cursor character appended inline to the last streamed token. `{text.muted}` color. Blinks at 500ms on/off cycle using CSS `@keyframes`. Removed when stream completes.
  - On `prefers-reduced-motion`: cursor is shown as static, no blink.
- **Streaming bubble opacity**: `1.0` — full opacity. Do not fade or dim streaming bubbles.

### Error State

- **Trigger**: API call failed, network error, model returned error.
- **Left border color**: `{semantic.error}` — overrides the model accent color for the duration of the error state.
- **Background**: `{surfaces.card}` — unchanged. Do not add a red background tint.
- **Error message**: Displayed in place of or below partial content. Typography: `13px`, `{semantic.error}`, `font-style: italic`.
- **Error message format**: "Error: [short human-readable message]" — e.g. "Error: Request timed out. Check your API key."
- **Retry affordance**: A small "Retry" text button (`12px`, `{text.secondary}`, underline on hover) appears below the error message. Clicking it resends the last prompt to this model. **Cross-agent dependency: Atlas must expose a retry method. Aria surfaces the button; Atlas handles the request.**
- **Recovery**: When retry succeeds, the error state clears and the bubble returns to its normal streaming → complete flow.

### User Message Bubble

User message bubbles share all dimension, padding, background, shadow, and state specs from the main Message Bubble spec above. The only differences are the border accent and the absence of a model name header.

- **Left border**: `3px solid var(--accent-user)` — fixed. Not determined by any model ID. The border color never changes to a model accent, even on error (user bubbles have no error state).
- **No model name header.** User bubbles do not show a label above the content. The `var(--accent-user)` border is the sole identity signal. Do not add a "You" label or any other header text.
- **Bug fix note for Aria:** If the current implementation falls through to `var(--accent-claude)` or any other model accent for user bubbles, the fix is to write `border-left: 3px solid var(--accent-user)` explicitly when rendering a user message. There is no `modelId` on a user message — the fallback must not chain to any model accent.
- **Custom color override**: When the user has set a custom user accent color via `setUserAccentColor()` (Gate), `--accent-user` resolves to their chosen hex via the Pass 2 CSS override. No component-level change needed — the CSS variable handles it automatically.
- **All other specs** (border-radius, background, shadow, shadow on hover, message body typography, streaming state, reduced-motion behavior) apply identically from the main Message Bubble spec.

### Ghost Mode State

- **Ghost mode** means the conversation is not being persisted. The bubble itself has no visual difference.
- **The ghost mode indicator lives in the input bar** (see Input Bar spec). Bubbles do not carry individual ghost mode indicators.

---

## 2. Model Identity Pill / Chip

Used in the model selector panel and as active-model indicators. Compact representation of a model's identity with toggle behavior.

### Dimensions & Layout

- **Height**: `32px`
- **Horizontal padding**: `12px` left and right (`{spacing.3}`).
- **Display**: `inline-flex`, `align-items: center`, `gap: 8px` (`{spacing.2}`) between dot and label.
- **Border-radius**: `{radius.full}` (9999px) — fully pill-shaped.

### Model Color Dot

- **Size**: `7px` diameter (width and height both `7px`).
- **Shape**: `border-radius: {radius.full}` — perfectly circular.
- **Color**: `{accents.model-*}` matching the pill's model.
- **No border on the dot itself.**

### Label Typography

- **Font size**: `13px`
- **Font weight**: `500`
- **Color (active state)**: `{text.primary}`
- **Color (inactive state)**: `{text.muted}`
- **Letter spacing**: none (default)

### Active State (model is selected/enabled)

- **Background**: `{interactive.hover}` — a subtle fill indicating membership in the active set.
- **Border**: `1px solid {borders.default}`
- **Dot**: full color `{accents.model-*}`
- **Label**: `{text.primary}`
- **Cursor**: `pointer`

### Inactive State (model is deselected/disabled)

- **Background**: transparent
- **Border**: `1px solid {borders.subtle}`
- **Dot**: `{accents.model-*}` at `40%` opacity — Aria achieves this via CSS `opacity` on the dot element, not by computing a faded hex. This way the dot color tracks the token if themes change.
- **Label**: `{text.muted}`
- **Cursor**: `pointer`

### Toggle Behavior

- Clicking an active pill deactivates it (removes model from active set).
- Clicking an inactive pill activates it (adds model to active set).
- State transition: `timing.fast` (100ms) `ease-out` on background and border. Dot opacity transitions at the same duration.
- **Minimum active models**: 1. The last active pill cannot be deactivated. When a user attempts to deactivate the last pill, no state change occurs. Aria should provide feedback — a brief shake animation (`timing.fast`, 2px left-right translate, 2 cycles) on the pill.
- **Keyboard**: `Enter` and `Space` toggle the pill when focused. Focus ring: `2px solid {interactive.focusRing}`, `2px offset`.

### Cross-Agent Dependency

**What happens when a model is deactivated while it is actively streaming?** The behavior depends on Atlas. Options:
1. Atlas cancels the in-flight stream immediately and the bubble completes in error state.
2. Atlas lets the stream complete, then the model is deactivated (pill goes inactive after stream ends).
3. The streaming bubble finishes regardless, but no new prompts are sent to that model.

**Luma's lean**: Option 3. The stream completing is useful (the user may want to read it) and canceling a stream mid-word is visually disruptive. The pill goes inactive immediately (visual feedback), but the current stream completes. The pill should show a "completing" micro-state — dot pulses at `timing.slow` once — then transitions to inactive when the stream ends.

**This behavior spec must be confirmed with Atlas before Aria implements the streaming edge case.** The visual spec above handles the steady-state cases; the mid-stream deactivation state is flagged.

---

## 3. Input Bar

The primary user input surface. Fixed to the bottom of the conversation column. Contains the text input, send button, ghost mode indicator, and attach button (image-only, issue #285).

### Input Row Element Order

The main input row renders left-to-right in this order:

1. **Ghost mode icon** — shown only when ghost mode is active. Leftmost element.
2. **Attach button** — shown always except during edit mode. Appears immediately after the ghost icon (or at the leftmost position when ghost mode is off).
3. **Textarea** — fills remaining space.
4. **Stop button** (streaming) or **Send button** — rightmost element.

This matches the ChatGPT/Claude.ai/Gemini left-anchor pattern: secondary compose controls on the left, primary action on the right.

**When both ghost mode icon and attach button are present** (ghost mode active, not in edit mode): the two left-anchored icons each carry a 44px minimum touch target and render adjacently before the textarea. This is an intentional, tested two-icon state. On narrow mobile viewports this reduces textarea width; this is acceptable — both controls are necessary and the layout is consistent with the industry pattern.

### Container Dimensions & Layout

- **Height**: `auto` with `min-height: 64px`. Grows vertically as content exceeds one line.
- **Max-height**: `200px`. Beyond this, the textarea scrolls internally.
- **Width**: Full width of the conversation column.
- **Padding**: `12px` all sides (`{spacing.3}`).
- **Background**: `{surfaces.input}`
- **Border**: `1px solid {borders.default}` on top only (separator from conversation above). No bottom, left, or right border — the input bar sits flush with the viewport bottom.
- **Border-radius**: `{radius.lg}` (12px) on top-left and top-right corners only. Bottom corners have `border-radius: 0` — flat against the viewport bottom.
- **Shadow**: `{shadow.md}` — the input bar floats above the conversation content.

### Textarea

- **Element**: `<textarea>` or `contentEditable` div — Aria's choice. Either must support multi-line, auto-resize.
- **Font**: `15px`, `font-weight: 400`, `line-height: 1.5`, `{text.primary}`.
- **Placeholder text**: "Ask all models..." — `{text.muted}` color.
- **Background**: transparent — inherits from container.
- **Border**: none on the textarea itself. The container provides the boundary.
- **Focus**: No additional outline on the textarea — the container border transitions to `{borders.strong}` on focus (`timing.fast`).
- **Padding within textarea**: `0` — the container padding handles spacing.
- **Resize**: `resize: none` — the textarea does not show a drag handle.

### Send Button

- **Position**: Bottom-right of the input bar, aligned with the last line of text.
- **Dimensions**: `36px` × `36px`. Square with `border-radius: {radius.md}` (8px).
- **Background (active, text entered)**: `{accents.model-claude}` — Luma chooses Claude's amber as the send button accent across all themes. This is a deliberate decision: the send button is the primary action, and the amber family reads well across all 7 themes including Outrun (where it's #FFE600, which is bright and energetic). If a different default accent is preferred for the focusRing token, that can differ — the send button is specifically amber.
- **Background (disabled, empty input)**: `{interactive.hover}` — muted, not prominent.
- **Icon**: Right-pointing arrow or send icon. `16px` × `16px`, centered. Color: `{text.inverse}` when active, `{text.muted}` when disabled.
- **Hover (active state)**: `filter: brightness(1.1)` — do not specify a separate hover hex.
- **Active/press**: `filter: brightness(0.9)`, `transform: scale(0.96)`.
- **Disabled state**: `cursor: not-allowed`, `opacity: 0.5`.
- **Transition**: `timing.fast` on all state changes.

### Keyboard Behavior

- **Submit**: `Enter` sends the message. The textarea clears after send.
- **Newline**: `Shift+Enter` inserts a newline character. Does not submit.
- **Focus management**: After submit, focus returns to the textarea automatically.
- **Empty submit prevention**: Pressing Enter on an empty or whitespace-only textarea does nothing (no API call triggered, no visual feedback needed).
- **While streaming**: The send button is disabled and the textarea accepts input but pressing Enter does not submit a new message. A new message can be queued when all active models have completed their current response. **Cross-agent dependency: Atlas must expose a streaming state flag that Gate/Aria can observe to determine whether new submissions are allowed. This is a real-time state signal, not a one-time read.**

### Ghost Mode Indicator

- **Ghost mode** = conversation is ephemeral, not persisted to storage.
- **Position**: Leftmost element in the input row, vertically centered with the first line of text. `8px` (`{spacing.2}`) from the left edge of the container, before the attach button and textarea.
- **Visual**: A ghost icon (SVG ghost outline, `16px` × `16px`). The icon uses `{text.muted}` as its fill/stroke.
- **Tooltip**: On hover (600ms delay) or focus (immediate), shows "Ghost mode — this conversation won't be saved" in a standard tooltip. Tooltip uses `{surfaces.sidebar}` background, `{text.primary}` text, `{borders.default}` border, `{radius.sm}` corners, `10px` font, `8px` vertical padding, `12px` horizontal padding. Tooltip positioned above the icon, left-anchored.
- **When ghost mode is OFF**: The icon is not shown. No indicator — the default state is persistent, and absence of the indicator communicates persistence.
- **Toggle**: Ghost mode is toggled via a setting (Gate owns this). The input bar reflects but does not control ghost mode. Aria subscribes to the ghost mode state from Gate's API.

### Attach Button (Image Attachments — issue #285)

Allows users to attach images to a message via file picker. Drag-and-drop and clipboard paste are alternative entry points handled at the container level; this button is the primary explicit affordance.

- **Position**: Left of the textarea, right of the ghost icon (if present). See Input Row Element Order above.
- **Visibility**: Hidden during edit mode (`editingMessage` prop set). Always shown otherwise.
- **Icon**: `PhotoIcon` — mountain-in-frame silhouette, `16px` × `16px`. **Not** a paperclip — the paperclip implies any file type; this button accepts images only. The icon must visually communicate "image" not "generic attachment." See pending icon spec below.
- **Touch target**: `min-width: 44px`, `min-height: 44px` (WCAG 2.5.5). The visual button size is `36px` × `36px` with `border-radius: {radius.md}` (8px) — the touch target extends beyond the visual bounds via min-width/min-height.
- **Color (enabled)**: `{text.muted}`. Hover: `{text.secondary}` + `{interactive.hover}` background.
- **Color (ghost mode disabled)**: `{text.muted}` at `opacity: 0.5`. `cursor: not-allowed`.
- **Disabled state in ghost mode**: Use `aria-disabled="true"` (not the HTML `disabled` attribute) so the button remains keyboard-focusable and the tooltip is reachable by screen reader users. Click no-ops when `aria-disabled`.
- **Tooltip in ghost mode**: "Attachments aren't saved in ghost mode." 600ms hover delay, immediate on focus. Positioned above the button, left-anchored. Same tooltip spec as Ghost Mode Indicator.
- **Accepted formats**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`. Enforced at the file input `accept` attribute. This is the full set — do not expand without a spec update.
- **Max attachments**: enforced by `useAttachments` hook. Current limit is defined there; the spec does not hard-code the limit so the hook remains the single source of truth.
- **Transition**: `timing.fast` on color and background changes.
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`.

#### Pending icon spec — `PhotoIcon`

The current implementation uses `PaperclipIcon`. This is a spec divergence flagged in the design review (2026-07-02). The correct icon is `PhotoIcon`. A future Aria session must:

1. Add `PhotoIcon` to `/src/ui/icons/index.tsx` with this SVG spec:
   - ViewBox: `0 0 16 16`, default size `16`
   - Stroke: `currentColor`, `strokeWidth: 1.4`, `strokeLinecap: round`, `strokeLinejoin: round`, fill: none
   - Frame: rounded rectangle `x=1.5, y=2.5, width=13, height=11, rx=2`
   - Mountain peaks: path `M1.5 10.5 L5 7 L8.5 10.5 L11 8 L14.5 10.5`
   - Sun circle: `cx=11.5, cy=5.5, r=1.25` (stroke only)
2. Remove `PaperclipIcon` if it has no other usages.
3. Update `InputBar.tsx` to import and use `PhotoIcon` in place of `PaperclipIcon`.

### Attachment Chips Row

Rendered above the main input row when one or more images are pending. Below any directed-reply pill or edit-mode banner.

- **Layout**: Horizontal flex row, `gap: 8px`, `overflow-x: auto`.
- **Container background**: `{surfaces.input}`. Left and right borders `{borders.default}`. No top border if another section (pill, edit banner) is already rendering above. Top border + top-left/top-right `{radius.lg}` rounding if this is the topmost section.
- **Padding**: `12px` horizontal, `8px` top, `8px` bottom.

#### Chip

- **Height**: `40px`. `border-radius: {radius.md}`. `padding-left: 6px`, `padding-right: 8px`.
- **Max-width**: `160px`. Title truncates with ellipsis.
- **Background + border**: `color-mix(in srgb, var(--accent-user) 15%, transparent)` background; `color-mix(in srgb, var(--accent-user) 40%, transparent)` border. This follows the chip pattern: border 40% tint, background 15% tint.
- **Contents**: Thumbnail image (28px × 28px, `border-radius: {radius.sm}`, `object-fit: cover`) + filename or MIME type label (`12px`, `{text.secondary}`) + remove button.
- **Remove button**: `20px` × `20px`, `border-radius: {radius.full}`. `SmallCloseIcon` at 7px. Hover: `rgba(0,0,0,0.15)` background. Focus ring standard.
- **Keyboard**: `Delete` or `Backspace` on the remove button removes the chip. Focus moves to the previous chip's remove button, or to the attach button if this was the first chip.

#### Attachment error

- `font-size: 12px`, color `{semantic.error}`, `role="alert"`. Inline "Dismiss" text button (underline, same size) clears the error.

### Drag-and-Drop Zone

The entire InputBar container is a drop zone when the user drags files over it.

- **Drag-over overlay**: An absolutely-positioned overlay covering the full InputBar area. `border: 2px dashed {borders.strong}`. `background: color-mix(in srgb, var(--accent-user) 8%, transparent)`. `border-radius: {radius.lg}` on top corners. Centered text label: "Drop images here" (`13px`, `font-weight: 500`, `{text.secondary}`). `pointer-events: none` so it does not intercept the drop event.
- **Drag-over state**: Managed via counter (increment on `dragenter`, decrement on `dragleave`) to prevent flickering when the pointer crosses child elements.
- **Ghost mode**: Drop events no-op in ghost mode. The overlay still shows (the user dragged over the zone) but no files are processed.

---

## 4. Model Selector Panel

Where users choose which models are active for the current conversation. This appears as a panel above the input bar, toggled open/closed.

### Layout Choice

The model selector is a **panel that slides up from above the input bar**, not a sidebar or top bar. Rationale: the primary screen real estate is the conversation; adding a persistent sidebar or top bar reduces it. The toggle opens a panel that overlays nothing — it appears in the space between the input bar and the bottom of the conversation column.

### Trigger Button

- **Position**: Left side of the input bar container, below the textarea, at `8px` left offset.
- **Visual**: A compact chip showing the count of active models — e.g. "3 models" with a small chevron-down icon when closed, chevron-up when open.
- **Height**: `24px`. Font: `12px`, `font-weight: 500`, `{text.secondary}`.
- **Background**: transparent. **Border**: `1px solid {borders.subtle}`. **Border-radius**: `{radius.full}`.
- **Padding**: `4px 10px`.
- **Hover**: border color transitions to `{borders.default}` at `timing.fast`.

### Panel Container

- **Position**: Directly above the input bar. `margin-bottom: 8px` from the input bar top edge.
- **Width**: Full width of the input bar.
- **Padding**: `16px` (`{spacing.4}`).
- **Background**: `{surfaces.sidebar}`
- **Border**: `1px solid {borders.default}` on all sides.
- **Border-radius**: `{radius.lg}` (12px) on all corners.
- **Shadow**: `{shadow.lg}`
- **Open/close animation**: See `motion.md` — Model Selector Toggle Transition.

### Active Models Section

- **Label**: "Active models" — `11px`, `font-weight: 600`, `{text.muted}`, `letter-spacing: 0.06em`, `text-transform: uppercase`. `margin-bottom: 8px`.
- **Content**: A horizontal wrapping row of Model Identity Pills (see Pill spec above). `gap: 6px`.
- **Wrap behavior**: Pills wrap to multiple rows if needed. No horizontal scroll.

### Add Model Button

- **Position**: After the last active model pill in the flow.
- **Visual**: `+` icon followed by "Add model" text. Same pill shape as Model Identity Pills, but with a dashed border — `1px dashed {borders.default}`. `{text.muted}` color. Height `32px`.
- **Behavior**: Opens a model selection dropdown (spec follows below).
- **Aria label**: "Add model to conversation"

### Model Selection Dropdown (within panel)

- **Trigger**: Clicking "Add model".
- **Content**: Flat list of available models that are not currently active. Each row: model color dot (7px) + model name (`14px`, `{text.primary}`) + provider label (`12px`, `{text.muted}`).
- **Row height**: `40px`. Horizontal padding: `12px`.
- **Hover state**: background `{interactive.hover}`.
- **Background**: `{surfaces.card}`. **Border**: `1px solid {borders.default}`. **Border-radius**: `{radius.md}`. **Shadow**: `{shadow.md}`.
- **Width**: `220px`, left-aligned with the "Add model" pill.
- **Max-height**: `240px` with internal scroll if list exceeds it.

### Minimum State

When zero models are available to add (all configured models are already active), the "Add model" button is hidden. At least one model will always be active (enforced by pill toggle behavior).

---

## 5. Sidebar Thread List

The persistent left sidebar showing conversation history. Each row is a thread.

### Sidebar Container

- **Width**: `256px` fixed. Not resizable in Phase 1.
- **Background**: `{surfaces.sidebar}`
- **Border-right**: `1px solid {borders.default}`
- **Height**: 100vh, full height.
- **Overflow-y**: auto (scrollable thread list).

### Sidebar Header

- **Content**: "Roundtable" wordmark or app name.
- **Height**: `56px`. `padding: 0 16px`. Vertically centered content.
- **Border-bottom**: `1px solid {borders.default}`
- **New conversation button**: Top-right of header. A `+` icon button. `32px` × `32px`, `border-radius: {radius.md}`. Background: transparent. `{text.secondary}` icon color. Hover: `{interactive.hover}` background.

### Thread Row

- **Height**: `64px` (fixed — do not use auto-height; truncate long content)
- **Padding**: `12px 16px` (`{spacing.3}` vertical, `{spacing.4}` horizontal).
- **Layout**: Two rows within the fixed height:
  - Row 1: Thread title (left, truncated) + timestamp (right)
  - Row 2: Model dots row (left) + blank right

#### Thread Title

- **Typography**: `13px`, `font-weight: 500`, `{text.secondary}` (default), `{text.primary}` (active thread).
- **Truncation**: `overflow: hidden`, `text-overflow: ellipsis`, `white-space: nowrap`. Max-width: fill available space minus timestamp width.
- **Default title**: If the user has not named the thread, use the first 40 characters of the first message sent, stripped of newlines.

#### Timestamp

- **Format**: Relative — "2m", "1h", "3d", "Jan 4". Rules:
  - Under 60 minutes: "Xm" (e.g. "14m")
  - Under 24 hours: "Xh" (e.g. "3h")
  - Under 7 days: "Xd" (e.g. "2d")
  - 7+ days: "Mon D" abbreviated — "Jan 4", "Oct 22"
  - Same day: time — "2:34 PM"
- **Typography**: `11px`, `font-weight: 400`, `{text.muted}`.
- **Position**: Top-right of the thread row, vertically aligned with thread title.

#### Model Dots (Participating Models)

- **Position**: Row 2, left-aligned, `margin-top: 4px`.
- **Size**: `6px` diameter each. `border-radius: {radius.full}`.
- **Colors**: `{accents.model-*}` for each model that participated in the thread.
- **Spacing**: `3px` gap between dots.
- **Max dots displayed**: 4. If more than 4 models participated, show 4 dots followed by `+N` text (`10px`, `{text.muted}`).
- **Order**: Dots appear in the order models were first added to the conversation.

#### Active Thread State

- **Background**: `{interactive.hover}` — the active thread row has a filled background.
- **Left accent**: `2px solid {borders.strong}` on the left edge of the row (inside the padding — Aria achieves this with `border-left: 2px solid {borders.strong}` and adjusting padding-left to `14px` to compensate for the border width).
- **Thread title**: `{text.primary}` instead of `{text.secondary}`.

#### Hover State

- **Background**: `{interactive.hover}` at lower opacity — Aria achieves this with a semi-transparent overlay (`::before` pseudo-element at `50%` opacity, or a lighter `{interactive.hover}` value). The distinction between hover and active is important: active is a solid fill, hover is a lighter tint.
- **Transition**: `timing.fast` on background.

#### Context Menu / Actions

Not specced for Phase 1. Thread rows have no visible action buttons on hover. This is Phase 2 scope.

### Thread List Empty State

- When no threads exist (new user, first session): centered message in the sidebar body area.
- Text: "Start a conversation" — `13px`, `{text.muted}`, centered horizontally and vertically within the scrollable area.
- No illustration or icon.

---

## Cross-Agent Dependencies Summary

| Component | Dependency | Waiting on | Luma's notes |
|-----------|------------|-----------|-------------|
| Message Bubble → Retry | Atlas must expose a retry method | Atlas | Aria shows the button; Atlas handles the re-request |
| Input Bar → Stream gating | Atlas must expose a streaming state flag | Atlas | Aria disables send while any model is streaming |
| Model Pill → Mid-stream deactivation | What happens when a model is deactivated mid-stream | Atlas | Luma's lean: stream completes, then model goes inactive |
| Ghost Mode indicator | Gate must expose ghost mode state | Gate | Aria reads state; Gate owns the toggle |

These are the only behavioral ambiguities Luma cannot resolve from design alone. All other component states are fully specced.
