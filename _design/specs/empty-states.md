# Empty States — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21
**Components covered:** `ConversationEmptyState`, `OnboardingEmptyState`

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Overview

Two distinct empty states exist in Roundtable:

| Component | When shown | Location |
|-----------|------------|----------|
| `OnboardingEmptyState` | No providers configured (first-run) | Replaces the conversation column body |
| `ConversationEmptyState` | Providers exist, but no messages sent yet | Replaces the message list in an active conversation |

They share the same layout region (the conversation column) but serve different user situations and have different designs. They must not be confused.

---

## 2. OnboardingEmptyState

Shown when the provider roster is empty — the user has not configured any API keys yet. It is a first-run onboarding experience.

The sidebar, sidebar header, model selector trigger, and input bar remain visible behind/around this state. Only the conversation column body is replaced.

**No entrance animation.** It renders in the initial app load state and persists until the user adds a provider. An entrance animation would fire on every page refresh, which would be annoying.

### 2.1 Container

- **Layout**: `width: 100%`, `height: 100%`, flex column, `align-items: center`, `justify-content: center`, `padding: 0 24px`
- **Role**: `role="region"`, `aria-label="Welcome to Roundtable"`
- **Background**: inherits from the conversation column (`{surfaces.background}`)

### 2.2 Content Block

A centered column, `max-width: 400px`, `width: 100%`, centered horizontally.

### 2.3 Icon

- **Size**: `64px × 64px` SVG
- **Concept**: two overlapping chat bubbles (left bubble larger, right bubble offset lower-right), with a plus symbol inside the right bubble and three dots in the left bubble. Communicates "multi-model conversation, add to get started."
- **Color**: `{accents.model-claude}` (amber) — warm and welcoming, consistent with the primary CTA button color
- **Stroke**: `2.5px`, `stroke="currentColor"`, no fill
- **Margin-bottom**: `24px` (`mb-6`)
- **ARIA**: `aria-hidden="true"` — the icon is decorative; the heading below carries the accessible text

### 2.4 Heading

- **Content**: "Welcome to Roundtable"
- **Element**: `<h2>`
- **Typography**: `24px`, `font-weight: 700`, `{text.primary}`
- **Text-align**: center
- **Margin-bottom**: `12px` (`mb-3`)

### 2.5 Description

- **Content**: "Roundtable lets you talk with multiple AI models at once — same question, multiple perspectives, side by side. Add a provider to get started."
- **Element**: `<p>`
- **Typography**: `15px`, `font-weight: 400`, `line-height: 1.6`, `{text.secondary}`
- **Text-align**: center
- **Margin-bottom**: `32px` (`mb-8`)

### 2.6 Primary CTA Button

- **Content**: "Add your first provider"
- **Height**: `48px` (`h-12`)
- **Horizontal padding**: `28px` (`px-7`)
- **Border-radius**: `{radius.md}` (8px)
- **Background**: `{accents.model-claude}` (amber)
- **Text**: `15px`, `font-weight: 600`, `{text.inverse}` (white/light)
- **Hover**: `filter: brightness(1.1)` — do not specify a separate hover hex
- **Active/press**: `filter: brightness(0.9)`, `transform: scale(0.98)`
- **Transition**: `filter`, `transform` at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `2px offset`
- **Cursor**: `pointer`
- **Margin-bottom**: `24px` (`mb-6`)
- **`id` prop**: when `ctaId` is provided (e.g. `id="skip-target"`), Aria applies it as the element `id`. This supports the app's skip-to-main-content link landing on a focusable element (WCAG 2.4.1). `AppLayout` is responsible for passing the `ctaId`.
- **Action**: calls `onOpenProviderSettings`

### 2.7 Secondary Link

- **Content**: `"Have an OpenAI-compatible API? "` + `"Add a custom endpoint."` (the second sentence is a button styled as an inline link)
- **Typography**: `13px`, `{text.muted}`, center-aligned
- **Link text**: "Add a custom endpoint." — `text-decoration: underline`, `decoration-color: {text.muted}`
- **Link hover**: `{text.secondary}`, `decoration-color: {text.secondary}`
- **Transition**: `color`, `text-decoration-color` at `fast` (100ms)
- **Focus ring on link**: `1px solid {interactive.focusRing}`, `1px offset`, `{radius.sm}` corners
- **Action**: calls `onOpenProviderSettings` (same as primary CTA)
- **Rendered as**: `<button type="button">` styled as a link — not an `<a>` tag, since there is no URL destination

---

## 3. ConversationEmptyState

Shown when a conversation exists (providers are configured, models may or may not be active) but no messages have been sent yet. It lives inside the message thread area.

Three rendering states are keyed on the count of active models:

| State | Models count | Content |
|-------|-------------|---------|
| A | 0 | "No models active" heading + "Add a model to get started" button |
| B | 1 | Single model beacon + "Ask [Name] anything" heading |
| C | 2+ | Beacon row + heading + description + suggestion chips |

### 3.1 Container

- **Layout**: `flex: 1`, flex column, `align-items: center`, `justify-content: center`, `overflow-y: auto`, `padding: 48px 24px` (`py-12 px-6`)
- **Role**: `role="region"`, `aria-label="New conversation"`
- **Background**: inherits from the conversation column

### 3.2 Content Block (shared across states)

A centered column, `max-width: 480px`, `width: 100%`, `text-align: center`, centered horizontally.

**Entrance animation**: the content block uses a `emptyStateEnter` CSS keyframe — `opacity: 0 → 1` + `translateY(8px → 0)` over `200ms ease-out`. Class: `empty-state-enter`. See §3.6 for animation specs.

---

### 3.3 State A — Zero Models

Displayed when no models are active in the conversation.

#### Heading

- **Content**: "No models active"
- **Element**: `<h2>`
- **Typography**: `18px`, `font-weight: 600`, `{text.primary}`

#### Button

- **Content**: small plus icon (12px) + "Add a model to get started"
- **Purpose**: opens the ModelSelectorPanel so the user can activate a model
- **Height**: `36px` (`h-9`)
- **Horizontal padding**: `20px` (`px-5`)
- **Display**: `inline-flex`, `align-items: center`, `gap: 8px`
- **Border-radius**: `{radius.full}` (pill)
- **Background**: `{interactive.hover}`
- **Border**: `1px solid {borders.default}`
- **Text**: `13px`, `font-weight: 500`, `{text.secondary}`
- **Hover**: border → `{borders.strong}`, background → `{interactive.hover}` at 80%, text → `{text.primary}`
- **Transition**: `background-color`, `border-color`, `color` at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `2px offset`
- **Cursor**: `pointer`
- **Action**: calls `onOpenModelSelector`

#### Plus icon in button

- `12px × 12px` SVG. Path: a horizontal and vertical line crossing at center (`M6 1v10M1 6h10`, `strokeWidth: 1.5`, `strokeLinecap: round`). `stroke="currentColor"`, no fill.
- `aria-hidden="true"` — decorative

---

### 3.4 State B — Single Model

Displayed when exactly one model is active.

#### Single model beacon

- **Layout**: flex column, `align-items: center`, `gap: 8px`
- **Animation class**: `beacon-enter` with `--beacon-index: 0` CSS custom property (for stagger offset, though there is only one beacon in State B)

**Dot**
- **Size**: `20px × 20px` (`w-5 h-5`), `border-radius: {radius.full}`
- **Color**: the model's accent color, applied via `getModelDotStyle(model.modelId)` (inline style using the model's `--accent-*` CSS variable)
- **ARIA**: `aria-hidden="true"` — the model name label carries the accessible text

**Model name label**
- **Typography**: `12px`, `font-weight: 500`, `{text.muted}`, `line-height: 1`
- **Content**: `model.name` (e.g. "Claude", "GPT-5.5")

#### Heading

- **Content**: `"Ask {model.name} anything"` — e.g. "Ask Claude anything"
- **Element**: `<h2>`
- **Typography**: `20px`, `font-weight: 600`, `{text.primary}`
- **Margin-top**: `16px` (`mt-4`)

---

### 3.5 State C — Two or More Models

Displayed when two or more models are active.

#### Beacon row

- **Layout**: flex row, `gap: 20px` (`gap-5`), `justify-content: center`, `align-items: flex-end` — dots with labels anchor at their bottom edge
- **Max visible beacons**: 4. Additional models beyond 4 are represented by a `+N` label.

**Each beacon** (ModelBeacon sub-component):
- **Layout**: flex column, `align-items: center`, `gap: 8px`
- **Dot**: `20px × 20px`, `border-radius: {radius.full}`, `getModelDotStyle(model.modelId)`, `aria-hidden="true"`
- **Label**: `12px`, `font-weight: 500`, `{text.muted}`, `line-height: 1`
- **Animation**: `beacon-enter` class with `--beacon-index: {i}` CSS custom property (see §3.6 for stagger spec)

**Overflow label** (when models.length > 4):
- **Content**: `"+{overflowCount}"` — e.g. "+2"
- **Typography**: `13px`, `{text.muted}`, `align-self: flex-end`, `line-height: 1`, `padding-bottom: 1px` to align baseline with beacon labels
- **ARIA**: `aria-hidden="true"` — the heading below communicates multi-model context; "+2" alone adds noise for screen readers

#### Copy block

Below the beacon row, `margin-top: 32px` (`gap-8` on the parent flex column):

**Heading**
- **Content**: "Ask anything — all models will respond"
- **Element**: `<h2>`
- **Typography**: `20px`, `font-weight: 600`, `{text.primary}`
- **Margin-bottom**: `8px` (`mb-2`)

**Description**
- **Content**: "Compare perspectives, get multiple takes, or let the models build on each other's answers."
- **Element**: `<p>`
- **Typography**: `14px`, `line-height: 1.65` (`leading-relaxed`), `{text.secondary}`

#### Suggestion chips

Three chips in a flex-wrap row, `gap: 8px`, `justify-content: center`, `margin-top: 24px` (`gap-6` on the copy block's flex column):

**Default chips** (hardcoded, not user-configurable):
1. "Compare approaches to a decision"
2. "What are the tradeoffs of X vs. Y?"
3. "Explain something from different angles"

**Each chip**:
- **Height**: `32px` (`h-8`)
- **Horizontal padding**: `14px` (`px-3.5`)
- **Display**: `inline-flex`, `align-items: center`
- **Border-radius**: `{radius.full}` (pill)
- **Background**: transparent
- **Border**: `1px solid {borders.subtle}`
- **Text**: `13px`, `{text.muted}`
- **Hover**: border → `{borders.default}`, background → `{interactive.hover}`, text → `{text.secondary}`
- **Transition**: `background-color`, `border-color`, `color` at `fast` (100ms)
- **Focus ring**: `2px solid {interactive.focusRing}`, `2px offset`
- **Cursor**: `pointer`
- **`aria-label`**: `"Start with: {chip text}"` — the full label is prefixed so screen readers can distinguish chips from generic buttons
- **Action**: calls `onSuggestionSelect(chipText)`. The parent (`AppLayout`) stores the text as `prefillText` and passes it to `InputBar`, which populates the textarea and focuses it.

---

### 3.6 Animation Specs

**Content block entrance** (`emptyStateEnter` / `empty-state-enter` class)

```css
@keyframes emptyStateEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.empty-state-enter {
  animation: emptyStateEnter 200ms ease-out both;
}
```

Duration: `medium` (200ms), `ease-out`. `both` fill mode so the element starts invisible even if the animation is slightly delayed by the scheduler.

**Model beacon entrance** (`beaconEnter` / `beacon-enter` class)

```css
@keyframes beaconEnter {
  from {
    opacity: 0;
    transform: scale(0.85);
  }
  to {
    opacity: 1;
    transform: scale(1.0);
  }
}

.beacon-enter {
  animation: beaconEnter 100ms ease-out both;
  animation-delay: calc(var(--beacon-index, 0) * 50ms);
}
```

Duration: `fast` (100ms), `ease-out`. Stagger: `50ms` per beacon index. First beacon: `0ms` delay. Second: `50ms`. Third: `100ms`. Fourth: `150ms`. This is a one-time exception to the timing scale (same exception documented in `motion.md §5` for thread list stagger) — 50ms produces a snappy cascade without feeling slow.

**Reduced-motion**: under `prefers-reduced-motion: reduce`, both animations are suppressed by the global override in `index.css`. Beacons and content block appear instantly at full opacity in their final positions. No stagger.

---

## 4. Accessibility Notes

### OnboardingEmptyState

- `role="region"` with `aria-label="Welcome to Roundtable"` creates a navigable landmark for screen reader users.
- The icon is `aria-hidden="true"` — it is decorative.
- The primary CTA button and secondary link are both `<button>` elements. They call `onOpenProviderSettings` which opens the provider settings panel.
- The `ctaId` prop allows `AppLayout` to place a meaningful skip-to-main-content focus target when the roster is empty (WCAG 2.4.1).

### ConversationEmptyState

- `role="region"` with `aria-label="New conversation"` creates a navigable landmark.
- Model beacon dots are `aria-hidden="true"` — the beacon label (`model.name`) carries the accessible text.
- The overflow label (`+N`) is `aria-hidden="true"` — the heading "Ask anything — all models will respond" communicates multi-model context without needing the count.
- Suggestion chips have descriptive `aria-label` prefixes ("Start with: …") so they are distinguishable in a screen reader's button list.
- The "Add a model to get started" button in State A is a `<button type="button">`, not a `<div>` or `<span>`. It is natively keyboard-activatable via `Enter` and `Space`.
