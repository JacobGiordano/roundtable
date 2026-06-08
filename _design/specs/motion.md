# Roundtable Motion Language

All animations reference timing tokens by name. The token values are:
- `instant` = 0ms
- `fast` = 100ms
- `medium` = 200ms
- `slow` = 350ms

Every animation specifies its `prefers-reduced-motion` behavior. The rule is:
- If the animation communicates state (streaming, loading, error), `prefers-reduced-motion: reduce` replaces it with a static visual indicator — never removes feedback entirely.
- If the animation is purely decorative (entrance flair, theme transition flourish), `prefers-reduced-motion: reduce` sets `transition-duration: 0ms` — instant snap.

---

## 1. Message Entrance (Streaming Tokens Appearing)

### What it is
Individual tokens arriving from the model stream appear character-by-character. The feel should be like text materializing on a typewriter — not abrupt, not jaggy, but a smooth, rhythmic arrival.

### Specification

**Do not animate individual characters.** Animating each character is expensive and creates visual noise. Instead, animate at the sentence/chunk level:

- As each chunk arrives from the API stream (typically 1–15 tokens), the new text is appended to the bubble's text node.
- The **new text chunk** fades in: `opacity 0 → 1` over `fast` (100ms), `ease-out`.
- No slide, no scale — opacity only. This is subtle by design. The reader's eye follows the advancing cursor; the fade prevents harsh "pop-in."
- The streaming cursor (`|`) is already specified in component spec. It blinks at 500ms on/off using CSS `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`.

### CSS Implementation Note for Aria
Use a wrapper `<span>` on each appended chunk with a class like `.chunk-entering`. Apply the fade animation to `.chunk-entering` and remove the class after `fast` (100ms). The text node itself should not re-animate once settled.

```css
@keyframes chunkFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.chunk-entering {
  animation: chunkFadeIn 100ms ease-out forwards;
}
```

### `prefers-reduced-motion` Behavior
- Remove the fade animation entirely. Chunks appear instantly (no opacity transition).
- The streaming cursor still appears and disappears, but does not blink — it is shown as a static `|` until the stream ends. Use `animation-play-state: paused` or remove the blink `@keyframes` under the media query.
- The shimmer on the bottom border (see component spec) is also removed here — static border only.

---

## 2. Bubble Entrance (New Model Starts Responding)

### What it is
When a model begins generating a response, a new message bubble appears in the conversation column. This bubble should enter in a way that feels intentional — the user knows a new model is starting — without being disruptive to reading existing content.

### Specification

- **Entry**: The bubble enters from below with a combined translate + fade:
  - `transform: translateY(8px) → translateY(0)` and `opacity: 0 → 1`
  - Duration: `slow` (350ms), `cubic-bezier(0.22, 1, 0.36, 1)` (ease-out with slight overshoot settling — feels natural, like dropping something softly into place)
  - The 8px vertical travel is small — enough to feel like arrival without scrolling the user's view.
- **Stagger**: If multiple models start simultaneously (e.g., a new conversation prompt triggers all 3 active models), each bubble entrance is staggered by `fast` (100ms). First model: 0ms delay. Second: 100ms delay. Third: 200ms delay. Stagger is applied via `animation-delay`.
- **Content within the bubble**: The bubble itself enters, but the content inside starts empty and fills via the streaming token animation (Animation 1 above). The two animations run concurrently — bubble slides in as tokens start arriving.

### `prefers-reduced-motion` Behavior
- No translate, no fade. The bubble appears immediately at full opacity in its final position.
- The stagger is also removed — all bubbles appear simultaneously.

---

## 3. Model Selector Toggle Transition

### What it is
The model selector panel opens (slides up from above the input bar) and closes (slides back down). This must feel snappy — the user is making an active choice and the panel should respond without delay.

### Specification — Opening

- **Trigger**: User clicks the "X models" trigger chip.
- **Animation**: The panel enters by expanding from height `0` to its natural height.
  - `max-height: 0 → max-height: 320px` (the panel's max height — 320px is the natural maximum; use `max-height` trick for CSS animation compatibility)
  - `opacity: 0 → 1`
  - Duration: `medium` (200ms), `ease-out`
  - `overflow: hidden` on the panel during animation to prevent content clipping below.
- **Transform origin**: `transform-origin: bottom center` — the panel should appear to grow upward from the trigger.
- **Shadow**: `{shadow.lg}` appears immediately at full opacity (not animated).

### Specification — Closing

- **Animation**: Reverse of opening.
  - `max-height: natural → 0`
  - `opacity: 1 → 0`
  - Duration: `fast` (100ms), `ease-in` — closing is faster than opening. This is intentional. Open is a reveal (medium); close is a dismiss (fast).
- **Trigger chip**: The chevron rotates `180° → 0°` on close. `transform: rotate(180deg)` on open, `transform: rotate(0deg)` on close. Duration: same as open/close.

### `prefers-reduced-motion` Behavior
- No max-height animation, no opacity animation. The panel appears and disappears instantly (display: none toggled directly).
- The chevron still rotates — it is directional feedback, not decorative. But the rotation uses `timing.instant` (0ms).

---

## 4. Theme Switch Transition

### What it is
When the user changes themes, all surfaces, colors, and borders update. The transition should feel intentional and satisfying — not jarring. The exception is Outrun, which should feel electric (see below).

### Default Themes (Slate, Linen, Midnight, Ash, Ember, Chalk)

- **Mechanism**: CSS custom properties update on the `:root` element. Aria adds a transition on the `body` or a top-level wrapper element:
  ```css
  * {
    transition: background-color 350ms ease, color 350ms ease, border-color 350ms ease;
  }
  ```
  Duration: `slow` (350ms), `ease`.
- **What transitions**: `background-color`, `color`, `border-color` on all elements. `box-shadow` is excluded from the transition — shadows snap immediately.
- **What does NOT transition**: `transform`, `opacity`, layout properties. Only color-family properties.
- **Result**: A smooth, even fade from one color palette to another. All elements change simultaneously — no stagger on theme switch for default themes.

### Outrun Theme (Electric Entry)

Outrun is a deliberate creative showcase. The transition into Outrun should feel different from all other theme switches.

- **Transition in (entering Outrun)**:
  1. A brief "flash" — the entire viewport flashes to `#FF00AA` at 20% opacity for `fast` (100ms), then fades out over `medium` (200ms). Implemented as a full-viewport overlay div, `position: fixed`, `inset: 0`, `pointer-events: none`, `z-index: 9999`.
  2. The color properties transition over `medium` (200ms) `ease-out` — faster than default themes. The flash overlaps the color transition.
  3. After the flash clears, the neon border glow effects are visible. The `box-shadow` on cards transitions in over `slow` (350ms) `ease-out` — this is the exception where shadow IS animated, specifically for Outrun entry.
- **Transition out (leaving Outrun)**:
  - No flash. Color properties transition over `slow` (350ms) `ease` — the same as default theme transitions. Leaving Outrun is calm; entering is electric.
- **Implementation note**: Aria tracks "previous theme" state to know whether a transition is entering or leaving Outrun.

### `prefers-reduced-motion` Behavior (All Themes)
- No color transitions. CSS custom properties update instantly.
- The Outrun flash effect is completely removed — no overlay, no animation.
- Colors still update — the theme switch still works, it just snaps.

---

## 5. Sidebar Thread List Item Entrance

### What it is
When a new conversation is added to the thread list (either because the user starts a new chat, or because a background sync adds threads), new thread rows enter the top of the list.

### Specification

- **Entry**: New thread rows slide in from above with fade:
  - `transform: translateY(-8px) → translateY(0)` and `opacity: 0 → 1`
  - Duration: `medium` (200ms), `ease-out`
  - No stagger for single new items. If multiple items arrive simultaneously (bulk sync), stagger by `instant`... actually 50ms per item (this is between `instant` 0ms and `fast` 100ms — Luma specifies 50ms as a concrete value for this specific case, acknowledging it falls outside the scale as a one-time exception. The reason: 100ms stagger with 5+ items creates a slow cascade; 50ms per item with 5 items = 250ms total cascade which feels snappy.)
- **Existing items**: Do not re-animate items already in the list when a new one arrives at the top.

### `prefers-reduced-motion` Behavior
- No translate, no fade. New rows appear immediately.

---

## Motion Design Principles Summary

| Animation | Duration | Easing | `prefers-reduced-motion` |
|-----------|----------|--------|--------------------------|
| Streaming token chunk fade-in | `fast` (100ms) | `ease-out` | Static — instant appearance |
| Streaming cursor blink | 500ms on/500ms off | step / CSS blink | Static cursor, no blink |
| Bubble entrance | `slow` (350ms) | `cubic-bezier(0.22, 1, 0.36, 1)` | Instant appearance, no stagger |
| Bubble stagger (multi-model) | `fast` (100ms) delay between | — | Removed |
| Model selector open | `medium` (200ms) | `ease-out` | Instant toggle (display) |
| Model selector close | `fast` (100ms) | `ease-in` | Instant toggle (display) |
| Chevron rotate | Matches open/close duration | — | `instant` (0ms) |
| Theme switch (default) | `slow` (350ms) | `ease` | Instant snap |
| Outrun entry flash | `fast` (100ms) + `medium` (200ms) | — | Removed entirely |
| Outrun entry color | `medium` (200ms) | `ease-out` | Instant snap |
| Outrun exit | `slow` (350ms) | `ease` | Instant snap |
| Thread row entrance | `medium` (200ms) | `ease-out` | Instant appearance |
| Thread bulk stagger | 50ms between items | — | Removed |

---

## Implementation Notes for Aria

1. All timing values must use the CSS custom properties defined in `tailwind-mapping.md`. Do not hardcode `350ms` — use `var(--timing-slow)`.
2. The `prefers-reduced-motion` media query should wrap all animation definitions:
   ```css
   @media (prefers-reduced-motion: reduce) {
     * { transition-duration: 0ms !important; animation-duration: 0ms !important; }
   }
   ```
   This is a blunt override — Aria may want to be surgical instead (removing specific animations rather than all). Either approach is valid. The blunt override is simpler to maintain; surgical is more precise. Luma has no preference on implementation approach here — this is a code architecture decision, not a design decision.
3. The Outrun entry flash effect is the only animation in this spec that requires a JavaScript-driven DOM element (the overlay div). All other animations are CSS-only.
