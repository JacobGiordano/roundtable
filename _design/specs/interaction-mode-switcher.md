# InteractionModeSwitcher — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Purpose

The `InteractionModeSwitcher` is a segmented radio group that lets the user choose how the app routes their messages to models. It sits in the bottom controls strip above the `InputBar`. Three modes exist:

| Mode | Label | Status |
|------|-------|--------|
| `parallel` | Parallel | Active — fully functional |
| `manual` | Manual | Coming soon — rendered but non-selectable |
| `auto-chain` | Auto-chain | Active — fully functional |

The component renders at its natural (inline-flex) width. The parent container in `AppLayout` must carry `flex-shrink-0` so the switcher is never compressed.

---

## 2. Container Dimensions and Layout

### Outer radiogroup wrapper

- **Display**: `inline-flex`, `align-items: center`, `gap: 2px`
- **Padding**: `3px` on all sides
- **Background**: `{surfaces.sidebar}` — slightly recessed from the surrounding surface
- **Border**: `1px solid {borders.subtle}`
- **Border-radius**: `{radius.full}` (9999px) — fully pill-shaped outer shell
- **No shadow** on the container itself

The 3px padding creates the visual "pill-within-pill" effect where the selected mode button's background reads as inset within the outer track.

---

## 3. Mode Button — Enabled State

Each enabled mode button (`parallel`, `auto-chain`) is a `<button type="button" role="radio">`.

### Dimensions

- **Height**: `28px` (`h-7`)
- **Horizontal padding**: `12px` (`px-3`)
- **Border-radius**: `{radius.full}` (9999px) — fully pill-shaped
- **Display**: `inline-flex`, `align-items: center`
- **White-space**: `nowrap` — labels never wrap

### Typography

- **Font size**: `12px`
- **Font weight**: `500`
- **Letter spacing**: none (default)

### Selected state (`aria-checked="true"`)

- **Background**: `{interactive.hover}` — a filled background indicating the active selection
- **Border**: `1px solid {borders.default}`
- **Text color**: `{text.primary}`
- **Cursor**: `default` (already selected)

### Unselected state (`aria-checked="false"`)

- **Background**: transparent
- **Border**: `1px solid transparent` — border is present but invisible, preventing layout shift on selection
- **Text color**: `{text.muted}`
- **Cursor**: `pointer`

### Hover (unselected only)

- **Text color**: `{text.secondary}`
- **Border color**: `{borders.subtle}`
- **Transition**: `background-color`, `border-color`, `color` at `fast` (100ms) `ease-out`

### Focus ring

- `2px solid {interactive.focusRing}`, `2px offset`
- Applied via `focus-visible:` only — never on `:focus` alone. Do not show a ring on mouse click.

---

## 4. Mode Button — Disabled/Coming Soon State

The `manual` mode is non-interactive. It is rendered as a `<span role="radio" aria-checked="false" aria-disabled="true">` — not a `<button>`. Using `aria-disabled` (not the HTML `disabled` attribute) keeps the element in the tab order so keyboard users can Tab to it and hear the "Coming soon" tooltip, satisfying WCAG 4.1.2.

### Visual appearance

- **Height**: `28px` — same as enabled buttons
- **Horizontal padding**: `12px`
- **Border-radius**: `{radius.full}`
- **Background**: transparent
- **Border**: `1px solid transparent`
- **Text color**: `{text.muted}`
- **Opacity**: `0.5` applied to the entire element — distinguishes it from unselected-but-selectable buttons
- **Cursor**: `not-allowed`

### Tab behavior

`tabIndex={0}` is set explicitly because `<span>` is not natively focusable.

Focus ring: `2px solid {interactive.focusRing}`, `2px offset`, via `focus-visible:`.

---

## 5. Tooltip Behavior

Every mode button carries a tooltip — enabled and disabled alike.

- **Enabled buttons**: tooltip content is the mode's description (e.g. "All active models respond simultaneously to every message.")
- **Disabled button (Manual)**: tooltip content is "Coming soon — not yet available"

Tooltip spec follows `tooltip.md` §1 exactly:
- Hover show delay: `600ms`
- Focus show: immediate (0ms delay)
- Hide: immediate on `mouseleave` or `onBlur`
- `Escape` dismisses while visible (document-level listener required for hover-only case — the element may not have focus when hovered)

### Tooltip positioning

The switcher is a fixed-width component. Tooltips are edge-anchored to prevent right-edge viewport clipping:
- First item (Parallel): tooltip left-aligns with the button (`left-0`)
- Middle item (Manual): tooltip centers on the button (`left-1/2 -translate-x-1/2`)
- Last item (Auto-chain): tooltip right-aligns with the button (`right-0`)

The caret (5px CSS triangle) position matches the tooltip anchor — left-caret for left-anchored, centered-caret for centered, right-caret for right-anchored.

Tooltip visual spec: `{surfaces.sidebar}` background, `1px solid {borders.default}` border, `{radius.sm}` corners, `{shadow.sm}` shadow, `11px` text, `{text.primary}` color, `max-width: 200px`. See `tooltip.md §4` for the full appearance table across all 7 themes.

---

## 6. Keyboard Navigation

The ARIA APG radio group keyboard pattern applies:

- **Arrow Left / Up**: move focus to the previous radio (wraps from first to last). Disabled radios are skipped in the navigation cycle but remain Tab-reachable.
- **Arrow Right / Down**: move focus to the next radio (wraps from last to first). Same skip behavior.
- **Home**: focus the first radio.
- **End**: focus the last radio.
- **Tab / Shift+Tab**: moves focus out of the radiogroup entirely (standard tab order). The radiogroup is a single tab stop.
- **Enter / Space**: not used — radio group selection is immediate on arrow key navigation. Arrow key to a button selects it.
- **Escape**: dismisses any open tooltip.

Arrow-key navigation also selects the focused mode immediately (calls `onModeChange`). Navigating to the disabled Manual entry skips it — the arrow key jumps over it to the next enabled radio.

The radiogroup container element (`role="radiogroup"`) carries `aria-describedby` pointing to a visually-hidden note that reads: "Manual mode is coming soon and is not yet available." This note is a sibling of the radiogroup (not inside it) to prevent double-reads in older AT (JAWS/NVDA browse modes).

---

## 7. ARIA Contract

```html
<div role="radiogroup" aria-label="Interaction mode" aria-describedby="interaction-mode-coming-soon-note">
  <button role="radio" aria-checked="true" aria-label="Parallel" aria-describedby="tooltip-parallel">
    Parallel
  </button>
  <span role="radio" aria-checked="false" aria-disabled="true" aria-label="Manual — coming soon" aria-describedby="tooltip-manual" tabindex="0">
    Manual
  </span>
  <button role="radio" aria-checked="false" aria-label="Auto-chain" aria-describedby="tooltip-auto-chain">
    Auto-chain
  </button>
</div>
<span id="interaction-mode-coming-soon-note" class="sr-only">
  Manual mode is coming soon and is not yet available.
</span>
```

All children of `role="radiogroup"` must have `role="radio"`, including the disabled Manual entry. This satisfies `aria-required-children` without an `aria-owns` workaround.

---

## 8. Layout Context

The switcher is placed in the bottom controls strip in `AppLayout`, on the same horizontal row as the model selector trigger chip. Aria aligns these controls at the bottom of the input area, above the InputBar. The switcher must not be compressed — use `flex-shrink-0` on its container.

---

## 9. Reduced-Motion Behavior

The state transition on mode selection (background and border color change) uses `fast` (100ms) transitions. Under `prefers-reduced-motion: reduce`, these transitions snap to `0ms`. No translate or opacity animation is used — there is nothing else to suppress.

Tooltip entrance animation follows `tooltip.md §3` reduced-motion behavior.
