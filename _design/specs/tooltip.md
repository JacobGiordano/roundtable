# Roundtable Tooltip Spec

Tooltips provide supplementary text for UI controls that are icon-only or have terse labels. They are not a primary communication mechanism — all critical information must be accessible without the tooltip. Tooltips are visible on hover and on focus; they dismiss automatically when the trigger loses hover or focus.

This spec supersedes the inline tooltip descriptions in `/_design/specs/components.md` (ghost mode indicator tooltip, line 189) and `/_design/specs/accent-color-customization.md`. Those documents remain authoritative for the component-level context in which a tooltip appears; this document is authoritative for all tooltip visual and behavioral decisions.

Token references use `{category.key}` notation — e.g. `{surfaces.sidebar}`, `{spacing.2}`. These map to the CSS custom properties defined in `tailwind-mapping.md`.

---

## 1. Trigger Behavior

### Hover

- **Show delay**: `600ms` after the pointer enters the trigger element. This value falls outside the timing scale (instant/fast/medium/slow) by design — a 600ms delay prevents tooltips from appearing during incidental mouse travel without making them feel sluggish when intentionally hovered. This is a one-time exception to the timing scale, documented here explicitly.
- **Hide delay**: `0ms` — the tooltip dismisses immediately when the pointer leaves the trigger or the tooltip itself. No linger.
- **Pointer enters tooltip body**: Tooltips that appear above their trigger may be briefly entered by the pointer as it moves away. `pointer-events: none` is applied to the tooltip element — it does not capture pointer events, and the hide logic fires on `mouseleave` of the trigger, not of the tooltip. This means a pointer that moves from trigger to tooltip will dismiss the tooltip. This is correct behavior — tooltips are not interactive.

### Focus

- **Show on focus**: The tooltip appears immediately (`0ms` delay, no wait) when the trigger receives keyboard focus. This gives keyboard users instant feedback without the intentionality-filtering delay that hover uses.
- **Hide on blur**: The tooltip dismisses immediately when the trigger loses focus.
- **Concurrent hover and focus**: If the trigger has both hover and focus, the tooltip shows (focus wins; focus triggered the immediate show). When focus is lost, the tooltip hides regardless of hover state.

### Dismiss Rules

| Trigger | Tooltip state |
|---------|---------------|
| Pointer leaves trigger | Hidden immediately |
| Trigger loses keyboard focus | Hidden immediately |
| `Escape` key pressed | Hidden immediately; focus remains on trigger |
| Trigger is clicked | Hidden immediately (the click action is taken; tooltip is not needed after) |
| Tooltip content changes while visible | Stays visible; content updates in place |
| Trigger is disabled | Tooltip still shows — disabled controls still benefit from explanation |

---

## 2. Positioning Strategy

### Preferred Placement

Tooltips appear **above** the trigger by default. The tooltip's bottom edge is offset `8px` from the trigger's top edge.

- Horizontal alignment: the tooltip centers on the trigger horizontally.
- When centering would clip the viewport edge (left or right), the tooltip shifts to align its near edge with the trigger's near edge. This is the only automatic repositioning that occurs horizontally.

### Fallback Placement

If the trigger is within `120px` of the top viewport edge, the tooltip appears **below** the trigger instead:
- The tooltip's top edge is offset `8px` from the trigger's bottom edge.
- The same horizontal centering and edge-clipping rules apply.

There is no left/right placement. Tooltips are always above or below. Components where left/right is strictly necessary (e.g., a trigger at the far right of a very tall narrow panel) should use an explicit `tooltipAlign` prop — the interaction mode switcher already implements this via `left`, `center`, and `right` alignment options. Those options control horizontal offset within the above/below placement axis, not a left/right axis flip.

### Offset

- **Vertical offset from trigger**: `8px` (`{spacing.2}`) — gap between trigger edge and tooltip edge.
- **Caret (arrow)**: A `5px` CSS triangle sits at the bottom of the tooltip (pointing downward toward the trigger) when the tooltip is above, and at the top (pointing upward) when the tooltip is below. The caret bridges the visual gap between tooltip and trigger. Caret color matches the tooltip border color.
  - Caret dimensions: `border-l: 5px transparent`, `border-r: 5px transparent`, `border-t: 5px {border-color}` (above placement) or `border-b: 5px {border-color}` (below placement).
  - Caret horizontal position: centered on the tooltip by default; shifts to match the tooltip edge when the edge-clipping adjustment fires.

### Z-Index

Tooltips use `z-dropdown` (20) from the z-index scale. See `/_design/specs/z-index.md` for the full layer inventory and usage rules. Tooltips never need to escape a positioned ancestor — their containing block already clears normal document flow.

---

## 3. Timing and Animation

### Enter Animation

- **Opacity**: `0 → 1` over `fast` (100ms), `ease-out`.
- **No translate, no scale.** Opacity only — a tooltip sliding in from above its already-above position creates redundant motion. The 600ms hover delay already creates a deliberate feel; the entrance animation just softens the pop-in.
- The enter animation begins after the show delay has elapsed. The delay and the animation are additive: total time from hover to fully-visible tooltip = 600ms delay + 100ms fade = 700ms.
- On focus (no delay): total time = 0ms delay + 100ms fade = 100ms to fully visible.

### Exit Animation

- **No animation.** The tooltip disappears at `0ms` — opacity snaps to `0` immediately. This is intentional. A fade-out on dismiss adds perceived latency: the user has already moved away, and seeing the tooltip fade feels like lag. Immediate dismissal matches the hide-delay of `0ms`.

### `prefers-reduced-motion`

- **Enter**: No opacity animation. The tooltip appears instantly (snaps from hidden to visible after the show delay).
- **Exit**: Unchanged — already instant.
- The hover show delay (600ms) is not an animation and is not removed under reduced-motion. It is an intentionality filter, not a decorative transition.

---

## 4. Appearance

### Dimensions and Layout

- **Max-width**: `240px`. Content wraps beyond this width. Tooltips are not truncated — if the content would require more than one line at `240px`, it wraps. Tooltips wider than `240px` indicate that the content is too long for a tooltip; that content should be moved to a label, help text, or modal.
- **Padding**: `8px` vertical (`{spacing.2}`), `12px` horizontal (`{spacing.3}`).
- **Border-radius**: `{radius.sm}` (4px). Tooltips are compact and sharp-cornered — they are not cards.
- **Border**: `1px solid` — color is per-theme (see table below).
- **Shadow**: `{shadow.sm}` — a light drop shadow to lift the tooltip off the surface beneath it. Does not use `{shadow.md}` or `{shadow.lg}` — the tooltip is a small element and a heavy shadow would overwhelm it.

### Typography

- **Font size**: `11px`. Tooltips are supplementary — they are smaller than body text.
- **Line height**: `1.4` — tighter than body line-height to keep multi-line tooltips compact.
- **Font weight**: `400`.
- **Color**: `{text.primary}` in all themes. Tooltip text is primary because it is the tooltip's only content — there is no hierarchy within a tooltip.

### Per-Theme Appearance

The tooltip background and border use existing surface tokens. No new tokens are introduced for tooltips — tooltips inherit from the theme's established surface language.

| Theme | Mode | Background | Border | Shadow |
|-------|------|-----------|--------|--------|
| Slate | dark | `{surfaces.sidebar}` — `#13151C` | `{borders.default}` — `#2A2E3D` | `{shadow.sm}` — `0 1px 3px rgba(0,0,0,0.4)` |
| Midnight | dark | `{surfaces.sidebar}` — `#080D1E` | `{borders.default}` — `#1E2D4A` | `{shadow.sm}` — `0 1px 4px rgba(0,0,0,0.5)` |
| Ash | dark | `{surfaces.sidebar}` — `#1B1D20` | `{borders.default}` — `#313539` | `{shadow.sm}` — `0 1px 3px rgba(0,0,0,0.35)` |
| Ember | dark | `{surfaces.sidebar}` — `#140F0A` | `{borders.default}` — `#2E2218` | `{shadow.sm}` — `0 1px 3px rgba(0,0,0,0.45)` |
| Linen | light | `{surfaces.sidebar}` — `#EDE8DF` | `{borders.default}` — `#D8D0C4` | `{shadow.sm}` — `0 1px 3px rgba(0,0,0,0.08)` |
| Chalk | light | `{surfaces.sidebar}` — `#F0F0F0` | `{borders.default}` — `#DCDCDC` | `{shadow.sm}` — `0 1px 2px rgba(0,0,0,0.07)` |
| Outrun | dark | `{surfaces.sidebar}` — `#0E1220` | `{borders.default}` — `#FF2070` | `{shadow.sm}` — neon glow value per theme |

**Token rationale**: `{surfaces.sidebar}` is chosen over `{surfaces.card}` because tooltip backgrounds should sit slightly darker/more distinct than the content surface beneath them. In dark themes the sidebar is darker than card; in light themes the sidebar is slightly warmer/darker than card. Both cases produce a legible contrast step between content and tooltip. Using `{surfaces.card}` would make tooltips nearly invisible over card surfaces, which is where most triggers live.

### Outrun Theme Notes

In Outrun, `{borders.default}` is `#FF2070` (hot pink). The tooltip border carries the neon accent. The background (`#0E1220`) is deep navy. Text (`{text.primary}` = `#EEEAF8`) on `#0E1220` achieves a contrast ratio of approximately 16.1:1, well above WCAG AA (4.5:1).

The hot pink border at `1px` is consistent with Outrun's neon aesthetic. It does not carry semantic meaning in a tooltip context (borders in other themes are neutral). Outrun's neon border is decorative here and that is appropriate — Outrun earns its maximalism.

`{shadow.sm}` in Outrun is `0 0 8px rgba(255,32,112,0.30), 0 0 5px rgba(61,200,255,0.20), 0 0 3px rgba(46,228,185,0.20)` — a neon glow composite rather than a directional drop shadow. The tooltip glow is intentional and matches Outrun's card and border glow. It does not need to be overridden.

---

## 5. Contrast Audit

All text-on-background pairings for tooltips across all 7 themes:

| Theme | Text color | Background | Contrast ratio | WCAG AA (4.5:1) |
|-------|-----------|-----------|----------------|-----------------|
| Slate | `#E8EAF0` on `#13151C` | Dark gray on near-black | ~13.2:1 | Pass |
| Midnight | `#F0F4FF` on `#080D1E` | Bright blue-white on deep navy | ~17.5:1 | Pass |
| Ash | `#D8DCDF` on `#1B1D20` | Light gray on near-black | ~10.8:1 | Pass |
| Ember | `#EDE5D8` on `#140F0A` | Warm off-white on very dark brown | ~14.6:1 | Pass |
| Linen | `#1C1A16` on `#EDE8DF` | Near-black on warm cream | ~14.2:1 | Pass |
| Chalk | `#111111` on `#F0F0F0` | Near-black on light gray | ~15.3:1 | Pass |
| Outrun | `#EEEAF8` on `#0E1220` | Near-white on deep navy | ~16.1:1 | Pass |

All pairings pass WCAG AA by a substantial margin. No remediation needed.

---

## 6. Accessibility

### ARIA Pattern

The tooltip element carries `role="tooltip"` and is identified by a unique `id`. The trigger element carries `aria-describedby` pointing to that `id`. This pattern is already implemented in Aria's components — `InteractionModeSwitcher.tsx` uses `tooltipId` and `aria-describedby` correctly.

```html
<!-- Trigger -->
<button aria-describedby="tooltip-ghost-mode">...</button>

<!-- Tooltip -->
<div id="tooltip-ghost-mode" role="tooltip">
  Ghost mode — this conversation won't be saved
</div>
```

The tooltip is always present in the DOM (not conditionally rendered) but visually hidden via `opacity: 0` when not shown. This ensures the `aria-describedby` reference is never broken. Screen readers announce the tooltip content when the trigger is focused; visual display is controlled by opacity.

**Exception**: The ghost mode tooltip in `InputBar.tsx` does not currently use `aria-describedby` — it uses the HTML `title` attribute. This is a gap to be addressed. Aria should wire up the `id` / `aria-describedby` pattern on the ghost icon trigger and tooltip div. The `title` attribute can remain as a fallback for non-ARIA consumers.

### What Tooltips Must Not Contain

- Interactive elements (buttons, links, inputs). Tooltips are `pointer-events: none` and cannot receive focus.
- The only information needed for the user to complete their task. If removing the tooltip would leave the user unable to understand a control, the tooltip content belongs in a visible label instead.
- Rich formatting (markdown, lists, code). Tooltip text is plain prose, one or two sentences maximum.

### Keyboard Dismissal

`Escape` dismisses an open tooltip when it was triggered by keyboard focus. Focus must remain on the trigger after dismissal — do not move focus. This is consistent with ARIA Authoring Practices Guide tooltip pattern.

---

## 7. Implementation Notes for Aria

### CSS

```css
/* Tooltip enter animation */
@keyframes tooltipFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.tooltip-enter {
  animation: tooltipFadeIn 100ms ease-out forwards;
}

@media (prefers-reduced-motion: reduce) {
  .tooltip-enter {
    animation: none;
  }
}
```

### Show/Hide Logic

The 600ms hover delay must be implemented via `setTimeout` — CSS `transition-delay` alone cannot be conditional on the trigger type (hover vs. focus). Use:

- `onMouseEnter`: set a timer for 600ms, then show
- `onMouseLeave`: clear the timer, hide immediately
- `onFocus`: cancel any pending timer, show immediately
- `onBlur`: hide immediately
- `onKeyDown (Escape)`: hide immediately

### Existing Tooltip Implementations to Align

Both existing tooltip implementations deviate slightly from this spec and should be aligned when Aria next touches those components:

1. **`InputBar.tsx` ghost mode tooltip**: Uses CSS `opacity-0 group-hover:opacity-100` without the 600ms hover delay, and uses `title` attribute without `aria-describedby`. Should be migrated to the pattern above.

2. **`InteractionModeSwitcher.tsx` mode tooltips**: Uses `z-20` (correct per `z-dropdown`) and `opacity-0 group-hover:opacity-100` without the hover delay. Has `aria-describedby` wired correctly. Should add hover delay behavior.

These are advisory — no immediate blocker. Align during the next session that touches either component.

### Tailwind Utility Pattern

```tsx
// Tooltip container (always in DOM, hidden via opacity)
<div
  id={tooltipId}
  role="tooltip"
  className={[
    'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
    'max-w-[240px] w-max',
    'px-3 py-2',
    'bg-sidebar border border-border rounded-sm shadow-sm',
    'text-[11px] leading-[1.4] text-text-primary',
    'pointer-events-none',
    'opacity-0',
    isVisible ? 'tooltip-enter opacity-100' : '',
    'z-20',  // z-dropdown — see z-index.md
  ].join(' ')}
>
  {content}
  {/* Caret */}
  <span
    className="absolute top-full left-1/2 -translate-x-1/2 -mt-px block border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-border"
    aria-hidden="true"
  />
</div>
```

The `opacity-0` default and `opacity-100` on show follow the same pattern already in use in `InteractionModeSwitcher.tsx`. The timer logic replaces the `group-hover:opacity-100` CSS-only approach to enable the conditional hover delay.
