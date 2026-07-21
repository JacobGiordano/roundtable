# Model Pill Dismiss Affordance — Issue #531

**Owner:** Luma
**Pipeline:** Luma (spec) → Aria (implementation)
**Status:** Spec complete
**Date:** 2026-07-21
**Blocks:** Aria re-implementation of ModelPill.tsx × dismiss button

---

## Problem Statement

Wave 10 (#528) shipped a × dismiss button on active model pills that has two
structural failures:

1. **Touch target too small.** The `×` button is `16×16px`. WCAG 2.5.8 requires
   a minimum 24×24px touch target for all interactive controls. Apple HIG
   recommends 44×44px.

2. **Hover-only disclosure.** The `×` appears only on `mouseenter` (controlled
   by `isPillHovered` state). On touch devices there is no hover event — the
   button is permanently invisible and models cannot be dismissed via this
   affordance.

The pill itself (`role="switch"`) is the correct keyboard and accessibility
path for toggling model state. The `×` is a pointer shortcut intended for
quicker removal without reading the pill as a toggle.

---

## Existing Layout Constraints

These are fixed constraints Aria must work within.

**Pill dimensions:**
- Height: `h-8` → 32px fixed
- Right padding in selector context: `pr-7` → 28px (accommodates palette icon
  plus breathing room from label)
- `border-radius: 9999px` (fully pill-shaped)
- Display: `inline-flex items-center`

**Palette icon (accent color picker trigger):**
- Positioned `absolute top-1/2 -translate-y-1/2` inside the pill wrapper
- When dismiss `×` is NOT present: `right-2` (8px from pill right edge)
- When dismiss `×` IS present: `right-[22px]` (shifted left to make room)
- Size: `18×18px` with `w-[18px] h-[18px]`
- Visibility: `opacity-0` at rest, `opacity-100` on hover/focus (unless override
  is active, in which case always visible)

**Dismiss button current position:**
- `ml-0.5` sibling element to the right of the pill `<button>`
- `16×16px` — too small per WCAG 2.5.8
- `opacity-0` at rest, `opacity-100` on `isPillHovered` — hover-only

---

## Rejected Alternatives

### Alternative A: Always-visible × (remove hover-only disclosure)

Make the dismiss button permanently visible at full opacity, no hover condition.

**Rejected.** The pill is already 32px tall and visually dense. With both the
palette icon (inside the pill, right side) and an always-visible × outside the
pill, active pills in a crowded selector become cluttered — the affordances
visually compete with the label and dot. With 4–8 active models, the selector
row becomes a string of symbols. This pattern is visually acceptable only for
tags in a dismissible tag list where removal is the primary action; here the
primary action is toggle, and the palette icon is already an interior affordance.

### Alternative B: Tap-to-reveal (first tap shows ×, second tap dismisses)

First touch opens a "staged" state on the pill where the × is revealed; a
second touch on the × dismisses.

**Rejected.** This pattern is disorienting: the same tap on the pill produces
two different outcomes (reveal vs. toggle) with no visual signal distinguishing
the two modes. It breaks the mental model that tapping a pill toggles it
(which is what `role="switch"` communicates). It also requires managing a
per-pill open/staged state, which creates accidental staged-state leakage when
the user taps elsewhere. Complexity is not justified when simpler options exist.

### Alternative C: Remove the × entirely; rely solely on the pill toggle

Eliminate the dismiss affordance. Deactivation is only via the pill's own
`role="switch"` behavior (click/tap/Space/Enter toggles state). No separate
× control.

**Rejected — but narrowly.** This is the simplest solution and has zero
accessibility risk (the toggle path is already correct on all input modalities).
The reason it is not chosen: the × provides meaningful UX value as a quicker
pointer shortcut that does not require precisely targeting the pill label region.
On a dense selector with 6–8 active models, pointer users benefit from a clear
"remove this" affordance distinct from "toggle" — especially when the pill's
toggle behavior also goes through a confirmation shake on the last model. The
shortcut is worth keeping if it can be done correctly.

**If the chosen pattern below introduces significant implementation complexity
or regresses any existing behavior, Aria is authorized to fall back to
Alternative C** without reopening this spec. Document the fallback decision in
the commit message.

### Alternative D: Visual badge/indicator making pills "obviously tappable"

Add a colored badge (e.g. accent-colored ring or dot in the corner of the pill)
to signal active/dismissable state to touch users, relying on tap-on-pill as
the dismiss mechanism.

**Rejected.** The pill already communicates "active" through background fill
and full-opacity dot. Adding another badge conflates "active state indicator"
with "dismiss affordance" — it is ambiguous whether the badge means "this is
active" or "tap here to remove." The toggle affordance already handles this
correctly; what touch users need is not a new indicator but a correctly-sized
interactive target.

---

## Recommended Pattern: Expanded Touch Target on the × Button

### Core principle

Keep the × button. Fix the two failures directly:
1. Expand the touch target to meet WCAG 2.5.8 (minimum 24×24px).
2. Remove the hover-only condition — the × is always in the DOM and always
   interactive, with a reduced-opacity resting state that adjusts for touch
   vs. pointer devices.

The × remains visually small (the visible glyph stays proportionate to the
32px pill height) while the interactive tap target is expanded by sizing the
button element itself to 24×24px. This is the standard pattern for
small-glyph / large-target controls (browser tab close buttons, tag dismissal
chips, notification badges).

### Why reduced-but-visible opacity on touch works

Alternative A was rejected for making the × always-visible at full opacity,
creating visual clutter on desktop. The recommended pattern distinguishes
between input modalities:

On **pointer devices** (mouse/trackpad): × rests at `opacity-[0.35]` — present
but subdued. It becomes `opacity-100` on pill group hover, rewarding intentional
interaction.

On **touch devices** (`@media (hover: none)`): × rests at `opacity-[0.55]` —
slightly more prominent since hover is unavailable. The button is always
interactive and always tappable.

This gives desktop users a clean, low-clutter pill row while giving touch users
a visible and correctly-sized dismiss affordance.

---

## Sizing and Layout Spec

### Dismiss × button

**Button element size:** `w-6 h-6` → 24×24px

This is the minimum WCAG 2.5.8 compliant touch target. The button element
itself is sized to 24×24px; no padding trick is needed. 24×24px satisfies
WCAG 2.5.8 and fits within the 32px pill height with 4px clearance on each
side when the wrapper uses `items-center`.

**Glyph:** `×` (U+00D7 MULTIPLICATION SIGN). Typography: `text-[11px]
leading-none font-medium`. Do not switch to an SVG × icon — the text glyph
is visually correct at this size.

**Position:** `ml-1` sibling to the right of the pill `<button>`. Increased
from current `ml-0.5` to provide a small visual gap between the pill's right
edge and the × hit area.

**Shape:** `rounded-full` — matches the pill's pill shape language.

**Color (rest):** `text-text-muted`

**Color (hover, direct):** `text-text-secondary`

**Background (rest):** transparent

**Background (hover, direct):** `bg-hover`

**Opacity (rest, pointer devices):** `opacity-[0.35]`

**Opacity (rest, touch devices):** `opacity-[0.55]` via `[@media(hover:none)]`
Tailwind variant

**Opacity (pill group hover, pointer):** `opacity-100` via `group-hover:opacity-100`

**Opacity (direct hover on ×):** `opacity-100` via `hover:opacity-100`

**Transition:** `transition-[opacity,color,background-color] duration-fast`
(100ms)

**Accessibility:**
- `tabIndex={-1}` — keyboard users deactivate via the pill's `role="switch"`
  (Space/Enter toggle). The × is a pointer/touch shortcut only.
- `aria-hidden={true}` — the dismiss action is already exposed via the switch
  role on the pill button. Announcing a duplicate dismiss button to screen
  readers adds noise without benefit.
- No `focus-visible` styles — this element is never keyboard-focused by design.

### Palette icon coexistence

No change to the existing palette icon position logic:
- When `showDismiss` is `true`: palette icon uses `right-[22px]`
- When `showDismiss` is `false`: palette icon uses `right-2`

This offset logic is correct and handles the coexistence. Aria preserves it
exactly. No additional offset adjustments are needed.

### Pill right padding

The `pr-7` (28px) right padding on the pill `<button>` in selector context
does not change. The × button is a sibling element outside the pill `<button>`,
so it does not affect interior pill padding.

---

## Full Layout Diagram

```
Inactive pill — no dismiss, no palette shift:
┌─────────────────────────────────────────────┐
│  •  Label                          🎨        │
└─────────────────────────────────────────────┘
   7px dot                    abs right-2 (8px)
                               18×18px palette icon

Active pill (not last) — dismiss present, palette shifted:
┌─────────────────────────────────────────────┐  ┌────────┐
│  •  Label                    🎨              │  │   ×    │
└─────────────────────────────────────────────┘  └────────┘
   7px dot            abs right-[22px]              ml-1
                       18×18px palette icon        24×24px

Last active pill — no dismiss, palette at normal position:
┌─────────────────────────────────────────────┐
│  •  Label                          🎨        │
└─────────────────────────────────────────────┘
   7px dot                    abs right-2 (8px)

Wrapper div: inline-flex items-center flex-shrink-0
Vertical alignment: items-center centers the 24px × within the 32px wrapper
```

---

## Motion and Responsive Behavior

### Pointer devices (hover: hover, pointer: fine)

- × rests at `opacity-[0.35]`
- Pill wrapper `.group` hover → `group-hover:opacity-100` at `timing.fast`
- Direct hover on × → `hover:opacity-100` + `hover:bg-hover` at `timing.fast`
- Transition: `transition-[opacity,color,background-color] duration-fast`

### Touch devices (@media (hover: none))

- × rests at `[@media(hover:none)]:opacity-[0.55]`
- No hover state behavior (inapplicable on touch)
- Tap on × fires click handler immediately; no staged reveal

### prefers-reduced-motion

Under `prefers-reduced-motion: reduce`, suppress the opacity and color
transitions on the × button. The button appears at its final opacity/color
immediately — no easing. Apply via Tailwind's `motion-reduce:transition-none`
utility class.

The dismiss action itself (click handler → toggle call) is not animated.
Nothing else to suppress.

---

## State Table

| Pill state | Last active? | × rendered? | Pointer resting opacity | Touch resting opacity |
|---|---|---|---|---|
| Active | No | Yes | 0.35 | 0.55 |
| Active | Yes | No | — | — |
| Inactive | — | No | — | — |

---

## Token References

| Property | Token |
|---|---|
| × glyph color (rest) | `{text.muted}` |
| × glyph color (direct hover) | `{text.secondary}` |
| × background (direct hover) | `{interactive.hover}` |
| Transition timing | `{timing.fast}` (100ms) |

No new tokens required for this change.

---

## Aria Implementation Notes

1. **Increase button size from `w-4 h-4` (16px) to `w-6 h-6` (24px).** The
   glyph (`text-[11px]`) does not change. The larger element size provides the
   touch target — no padding trick needed.

2. **Replace JS-state opacity gating with CSS-only opacity control.** The
   current implementation gates the × opacity on `isPillHovered` React state.
   Replace this entirely with:
   - `opacity-[0.35]` base class (pointer resting)
   - `group-hover:opacity-100` (pill group hover reveal)
   - `hover:opacity-100` (direct × hover)
   - `[@media(hover:none)]:opacity-[0.55]` (touch resting)
   - `motion-reduce:transition-none` (reduced motion)

3. **Audit `isPillHovered` before removing it.** The palette icon also uses
   `isPillHovered` (`paletteIconOpacity = isOverrideActive || isPillHovered ?
   1 : 0`). If the palette icon is converted to CSS group-hover as well, the
   state variable can be removed entirely. If the palette icon retains JS-state
   control (acceptable), keep `isPillHovered` for that purpose and only remove
   it from the × opacity calculation.

4. **Change `ml-0.5` to `ml-1`** on the × button for a slightly cleaner visual
   gap between pill right edge and × hit area.

5. **Preserve `e.stopPropagation()` on the × click handler.** The × is a sibling
   of the pill button, not a child, so bubbling is not a structural concern here.
   Keep it as a defensive guard against future layout changes.

6. **Do not add `focus-visible` styles.** The × is `tabIndex={-1}` and
   `aria-hidden`. It is never keyboard-focused. No focus ring.

7. **Palette icon offset logic is unchanged.** `right-[22px]` when `showDismiss`
   is true, `right-2` when false. Aria keeps this exactly.

---

## Acceptance Criteria

- [ ] × button is `w-6 h-6` (24×24px)
- [ ] × button resting opacity is `opacity-[0.35]` on pointer devices
- [ ] × button resting opacity is `opacity-[0.55]` on `@media (hover: none)` devices
- [ ] × button reaches `opacity-100` on `.group` (pill wrapper) hover — CSS-only, no JS state
- [ ] × button reaches `opacity-100` + `bg-hover` on direct hover
- [ ] × button IS NOT gated on `isPillHovered` JS state for its opacity
- [ ] × button is `tabIndex={-1}` and `aria-hidden`
- [ ] × button does NOT render when pill is inactive
- [ ] × button does NOT render when pill is the last active model
- [ ] Palette icon retains `right-[22px]` when dismiss shows, `right-2` otherwise
- [ ] `motion-reduce:transition-none` is applied to the × button
- [ ] No changes to pill toggle behavior (`role="switch"`, Space/Enter, shake on last-active)
- [ ] `ml-0.5` changed to `ml-1` on the × button
