# BulkActionBar — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Purpose

`BulkActionBar` is a compact control strip that appears at the top of the sidebar thread list when multi-select mode is active. It provides:

- A select-all / deselect-all checkbox
- A selected-count label
- A "Clear" deselect button
- Archive and Delete action buttons
- An inline delete-confirmation sub-state

The bar is not a modal or overlay — it is an inline element that sits above the thread list in normal document flow. When it appears, the thread list scrolls below it.

---

## 2. Container Layout

- **Position**: In the sidebar column, between the sidebar header and the thread list. `flex-shrink: 0` — it never compresses, the thread list scrolls.
- **Width**: Full sidebar width (`256px` fixed, inherits from `Sidebar`).
- **Background**: `{interactive.hover}` at `30%` opacity (`bg-hover/30`). This tint distinguishes the bar from the plain sidebar background without using a full-strength fill.
- **Border-bottom**: `1px solid {borders.default}` — separates the bar from the thread list below.
- **No border-top** — the sidebar header above provides the upper boundary.
- **Two rows**: header row and action row (or confirmation row in `confirm-delete` state). Each row has its own padding.

---

## 3. Header Row

The header row is always visible when the bar is shown. It contains the select-all checkbox, the count label, and the Clear button.

### Layout

- **Padding**: `6px 12px` (top and bottom 6px, left and right 12px)
- **Flex row**: `align-items: center`, `gap: 8px`

### Select-all Checkbox

- **Touch target wrapper**: `min-width: 24px`, `min-height: 24px`, flex-centered. The actual `<input>` is smaller; the wrapper provides a WCAG 2.5.8-compliant tap target.
- **Checkbox size**: `14px × 14px` (`w-3.5 h-3.5`). `border-radius: {radius.sm}`.
- **Accent color**: `{accents.model-claude}` (amber) — applied via CSS `accent-color`. This is consistent with the app's primary action color convention.
- **Cursor**: `pointer`
- **`aria-label`**: `"Deselect all"` when all threads are selected; `"Select all"` otherwise. Label updates dynamically.
- **Checked state**: when `selectedCount === totalCount && totalCount > 0`
- **Indeterminate state**: not implemented. The checkbox is either checked (all selected) or unchecked (not all selected). Indeterminate is a future enhancement if needed.

### Count Label

- **Content**: `"{selectedCount} selected"` — e.g. "3 selected"
- **Typography**: `11px`, `font-weight: 400`, `{text.secondary}`
- **Flex**: `flex: 1` — fills available space between checkbox and Clear button

### Clear Button

- **Content**: "Clear"
- **Typography**: `11px`, `{text.muted}`
- **Hover**: `{text.secondary}`
- **Background**: transparent (no background)
- **Border**: none
- **Cursor**: `pointer`
- **Action**: calls `onDeselectAll` — deselects all threads, does not close multi-select mode
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`, `{radius.sm}` corners
- **Transition**: `color` at `fast` (100ms)

---

## 4. Action Row — Idle State

The action row appears below the header row when the bar is in `idle` state.

### Layout

- **Padding**: `0 12px 6px 12px` (no top padding — header row provides spacing above)
- **Flex row**: `align-items: center`, `gap: 8px`

### Archive Selected Button

- **Content**: "Archive selected"
- **Typography**: `11px`, `{text.secondary}`
- **Height**: `auto` with `padding-top: 6px`, `padding-bottom: 6px` (`py-1.5`)
- **Flex**: `flex: 1` — equal width with Delete Selected button
- **Background**: `{interactive.hover}`
- **Hover**: `{interactive.hover}` at `80%` opacity
- **Border-radius**: `{radius.sm}` (4px)
- **Border**: none
- **Cursor**: `pointer`
- **Action**: calls `onBulkArchive` immediately. No confirmation step.
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Transition**: `background-color`, `color` at `fast` (100ms)

### Delete Selected Button

- **Content**: "Delete selected"
- **Typography**: `11px`, `{semantic.error}` — red to signal destructive action
- **Height/padding**: same as Archive Selected button
- **Flex**: `flex: 1`
- **Background**: `{interactive.hover}`
- **Hover**: `{interactive.hover}` at `80%` opacity
- **Border-radius**: `{radius.sm}`
- **Border**: none
- **Cursor**: `pointer`
- **Action**: transitions the bar to `confirm-delete` state. Does not immediately delete.
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Transition**: `background-color` at `fast` (100ms)
- **Ref**: this button holds a ref (`deleteSelectedRef`) so focus returns to it when the confirm-delete state is dismissed.

---

## 5. Action Row — Confirm Delete State

When the user clicks "Delete selected", the action row is replaced with an inline confirmation. The header row (checkbox + count + Clear) remains visible above.

### Layout

- **Padding**: `0 12px 6px 12px`
- **Stack**: a `<p>` confirmation message, then a flex row of two buttons below it

### Confirmation Message

- **Content**: `"Delete {selectedCount} conversation{s}?"` — e.g. "Delete 3 conversations?" or "Delete 1 conversation?" (no trailing 's' for singular)
- **Typography**: `11px`, `{text.secondary}`
- **Margin-bottom**: `6px`

### Cancel Button

- **Content**: "Cancel"
- **Typography**: `11px`, `{text.secondary}`
- **Height/padding**: `py-1.5`, flex: 1
- **Background**: `{interactive.hover}`
- **Hover**: `{interactive.hover}` at `80%` opacity
- **Border-radius**: `{radius.sm}`
- **Action**: returns to `idle` state; returns focus to the "Delete selected" button (`deleteSelectedRef`)
- **Focus management**: this button receives focus automatically when the confirm-delete state is entered (WCAG 2.4.3 — keyboard users land on the safe/cancel action, not the destructive button). Use a `useEffect` on state transition.
- **Ref**: `confirmCancelRef`
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Transition**: `background-color` at `fast` (100ms)

### Confirm Delete Button

- **Content**: "Delete"
- **Typography**: `11px`, `font-weight: 400`, `#FFFFFF` (white in all themes — the button uses a filled error background)
- **Height/padding**: `py-1.5`, flex: 1
- **Background**: `{semantic.error}` background variant (the `bg-error-bg` token — typically a muted/darkened version of the error color suitable for a filled button)
- **Hover**: `opacity: 0.90`
- **Border-radius**: `{radius.sm}`
- **Action**: calls `onBulkDelete`, returns to `idle` state, returns focus to "Delete selected" button
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Transition**: `opacity` at `fast` (100ms)

---

## 6. State Machine

```
idle
  ├── "Archive selected" clicked → onBulkArchive() → stays in idle
  └── "Delete selected" clicked → confirm-delete

confirm-delete
  ├── "Cancel" clicked → idle (focus: deleteSelectedRef)
  └── "Delete" clicked → onBulkDelete() → idle (focus: deleteSelectedRef)
```

There is no animation between states — the action row content swaps instantly. The transition is fast enough (and the row is compact enough) that animation would feel excessive.

---

## 7. Focus Management

Focus management is WCAG 2.4.3 compliant:

1. When entering `confirm-delete`: focus moves to the "Cancel" button (safe default for a destructive action). Implemented via `useEffect` on state transition.
2. When leaving `confirm-delete` (either via Cancel or Confirm Delete): focus returns to the "Delete selected" button. Implemented via `setTimeout(() => deleteSelectedRef.current?.focus(), 0)` — deferred one tick to ensure the button is in the DOM before focus is applied.

---

## 8. Accessibility Notes

- The select-all `<input type="checkbox">` carries a dynamic `aria-label` ("Select all" / "Deselect all") because the label must update as state changes.
- The count label ("3 selected") is not in an `aria-live` region — it changes only when the user takes an action, so the change is announced via the action itself.
- The bar as a whole does not have a container role. It is a plain flex container within the sidebar's natural document order.
- The confirm-delete confirmation message (`"Delete 3 conversations?"`) does not use `role="alert"`. The focus move to "Cancel" is sufficient to communicate the transition — an alert announcement would overlap with the focus announcement.

---

## 9. Reduced-Motion Behavior

All transitions in this component are color/opacity only (`fast`, 100ms). Under `prefers-reduced-motion: reduce`, these snap to `0ms`. No translate or scale animations are used. The state swap between idle and confirm-delete is already instant — no additional reduced-motion handling required.
