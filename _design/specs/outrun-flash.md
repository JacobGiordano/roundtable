# OutrunFlash — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21
**Source:** `motion.md §4 "Outrun Theme (Electric Entry)"` — this document is the standalone component spec for the overlay element described there.

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Purpose

`OutrunFlash` is a transient full-viewport overlay that fires exactly once each time the user switches *into* the Outrun theme. It is the visual "electric entry" effect described in `motion.md §4`. It has no idle state — it either doesn't exist in the DOM (default) or exists briefly while its animation plays.

This component owns no content, no interactivity, and no persistent visual state. It is purely theatrical infrastructure for the Outrun theme entry.

---

## 2. Trigger Condition

- **When it fires**: the `data-theme` attribute on `:root` (`document.documentElement`) changes **to** `"outrun"`.
- **When it does NOT fire**:
  - Page load with Outrun already active. The `MutationObserver` only fires on attribute changes, not on the initial DOM state. No flash on refresh.
  - Switching *away* from Outrun. Leaving Outrun is a calm transition (see `motion.md §4`).
  - Any theme switch other than into Outrun.
  - `prefers-reduced-motion: reduce` is active (see §6 below).

Detection mechanism: a `MutationObserver` watching `{ attributes: true, attributeFilter: ['data-theme'] }` on `document.documentElement`. Implemented in a `useEffect` with cleanup. No polling.

---

## 3. Visual Anatomy

The overlay is a single `<div>` with no children and no text content.

### Overlay element

- **Position**: `position: fixed`, `inset: 0` — covers the full viewport, including any content that has been scrolled.
- **Z-index**: `9999` — above every other layer. The overlay must appear on top of the fully-painted Outrun theme surface, not beneath it. See `z-index.md` for the full layer inventory; `9999` is a one-time exception reserved for this specific effect.
- **Pointer events**: `pointer-events: none` — the overlay never intercepts clicks, hovers, or keyboard events. It is a paint effect, not an interactive layer.
- **ARIA**: `aria-hidden="true"` — the overlay carries no semantic information. Screen readers must not announce it.
- **Color**: `#FF00AA` at `20%` opacity (`rgba(255, 0, 170, 0.20)`). This is the Outrun hot pink. Do not use a token — this value is specific to the flash effect and does not generalize to any theme token.
- **Background**: set via CSS `@keyframes` animation class, not via an inline `background-color` style. The animation class (`outrun-flash`) controls both the opacity curve and the color.

### CSS class: `outrun-flash`

Aria defines this class in `index.css` (or the global stylesheet):

```css
@keyframes outrunFlash {
  0%   { background: rgba(255, 0, 170, 0.20); }
  33%  { background: rgba(255, 0, 170, 0.20); }  /* hold at 20% for ~100ms */
  100% { background: rgba(255, 0, 170, 0.00); }  /* fade to transparent over ~200ms */
}

.outrun-flash {
  animation: outrunFlash 300ms linear forwards;
}
```

Total animation duration: `300ms` (100ms hold at `fast` timing + 200ms fade at `medium` timing). After `300ms`, the component unmounts from the DOM.

The `forwards` fill mode is required so the overlay does not snap back to its `from` state after the animation ends. The component unmounts at `300ms`, but `forwards` prevents any visual flash if unmount is slightly delayed by React's scheduler.

### DOM placement

The overlay must be rendered via `createPortal` into `document.body`. Rationale: the sidebar and other ancestor elements may carry CSS `transform`, `filter`, or `will-change` properties that create a new stacking context, which would cap the effective z-index at the stacking context's layer — not at `9999` on the document root. Rendering into `document.body` directly escapes all ancestor stacking contexts.

---

## 4. Lifecycle

1. **Before trigger**: component is mounted (part of the app's persistent tree, e.g. in `AppLayout`), renders `null`. No DOM element exists.
2. **Trigger fires**: `data-theme` changes to `"outrun"`. Component sets internal `isVisible` to `true`.
3. **Overlay appears**: a portal renders the `<div class="outrun-flash ...">` into `document.body`. The CSS animation begins immediately.
4. **Animation completes**: after `300ms`, the component sets `isVisible` to `false`, and the portal unmounts. No DOM element exists again.
5. **Subsequent triggers**: the cycle repeats each time the user re-enters Outrun from any other theme.

The `MutationObserver` lifecycle is tied to the component's mount. On unmount, `observer.disconnect()` is called in the cleanup function.

---

## 5. Relationship to Theme Color Transition

The overlay fires concurrently with the Outrun theme color transition (`medium`, 200ms, `ease-out`). The two effects overlap:

- The flash overlay appears and holds at `#FF00AA 20%` opacity for `100ms`.
- Simultaneously, CSS custom properties on `:root` update and the color transition runs.
- The flash fade (200ms) overlaps with the tail end of the color transition.

The flash does not delay or pause the color transition. Both run simultaneously via independent mechanisms (React state + portal for the flash; CSS transitions on `:root` for the colors). See `motion.md §4` for the full Outrun entry sequence including the box-shadow glow animation.

---

## 6. Reduced-Motion Behavior

| Condition | Behavior |
|-----------|----------|
| Default | 300ms flash: 100ms hold + 200ms fade |
| `prefers-reduced-motion: reduce` | No overlay rendered — component returns `null` |
| Page load with Outrun active | No flash — observer fires only on changes |
| Switching away from Outrun | No flash — trigger condition is entering Outrun only |

When `prefers-reduced-motion: reduce` is matched, the check is performed once on `useEffect` mount. If the user changes their system preference mid-session, the check is not re-evaluated until the next mount. This is acceptable — the cost of subscribing to the `change` event is not warranted.

---

## 7. Accessibility Notes

- `aria-hidden="true"`: required. Screen readers must not announce this element.
- `pointer-events: none`: required. The overlay must never capture pointer events.
- No focus trap, no focus management. The overlay is not interactive.
- Under `prefers-reduced-motion: reduce`, the component returns `null` — no overlay exists at all.
