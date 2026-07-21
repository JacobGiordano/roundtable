# ThreadActionMenu — Component Spec

**Owner:** Luma
**Issue:** #466
**Date:** 2026-07-21
**Prior status:** Listed as "Phase 2 scope — not specced" in `components.md §5` but shipped as a full implementation. This document retroactively specs the shipped component.

Aria implements these specs exactly. Every value here is a decision. No design decisions are deferred to Aria. Token references use `{category.key}` notation matching `tailwind-mapping.md`.

---

## 1. Purpose

`ThreadActionMenu` is a context menu that appears on a sidebar thread row when the user activates the three-dot trigger button. It provides per-conversation actions: Rename, Archive/Unarchive, Move to group, and Delete.

The menu has four possible states:

| State | Role | Description |
|-------|------|-------------|
| `menu` | `role="menu"` | Top-level list of actions |
| `confirm-delete` | `role="dialog"` | Inline delete confirmation |
| `group-input` | `role="dialog"` | Text input for group assignment |
| `rename` | `role="dialog"` | Text input for renaming the conversation |

The role switches from `role="menu"` to `role="dialog"` when any sub-state is active. This resolves a WCAG 4.1.2 `aria-required-children` violation: `role="menu"` requires all owned children to be `menuitem` variants, but sub-state panels contain plain `<button>` and `<input>` elements. Sub-state panels use `role="dialog" aria-modal="true"`.

---

## 2. Trigger Button

The trigger button lives in `ThreadRow` (not in `ThreadActionMenu` itself). This spec describes it for completeness.

- **Visual**: a three-dot horizontal ellipsis icon (`⋯`), `16px × 16px`.
- **Dimensions**: `28px × 28px` touch target minimum. `border-radius: {radius.sm}`.
- **Background**: transparent in default state; `{interactive.hover}` on hover.
- **Color**: `{text.muted}` by default; `{text.secondary}` on hover.
- **Visibility**: The trigger is shown on thread row hover and on keyboard focus. It is hidden (opacity: 0) when the row is neither hovered nor focused, to keep the list scannable.
- **Focus ring**: `2px solid {interactive.focusRing}`, inset (`ring-inset`) to avoid clipping by the row bounds.
- **Cursor**: `pointer`
- **Ref**: A `triggerRef` is passed to `ThreadActionMenu` so focus can return to the trigger on menu close.

---

## 3. Menu Container

The menu container renders as a positioned absolute element, overlapping the thread row.

### Dimensions and position

- **Position**: `absolute`, `right: 8px`, `top: 4px` — sits at the top-right of the thread row.
- **Min-width**: `160px`
- **Padding**: `4px` vertical (`py-1`)
- **Border-radius**: `{radius.md}` (8px)
- **Background**: `{surfaces.card}`
- **Border**: `1px solid {borders.default}`
- **Shadow**: `{shadow.md}`
- **Font size**: `12px` (base for all menu text)
- **Z-index**: `z-40` — above normal sidebar content, below the full-viewport backdrop.

### Full-viewport backdrop

A `position: fixed`, `inset: 0`, `z-30` invisible backdrop sits behind the menu container and above the rest of the sidebar. It intercepts pointer events so:
1. Rows beneath the open menu cannot receive hover or click events (prevents hover bleed).
2. A `onMouseDown` on the backdrop closes the menu (outside-click-to-close behavior). `e.preventDefault()` and `e.stopPropagation()` are called to prevent any downstream event handling.
3. The backdrop is `aria-hidden="true"`.

Z-index values: backdrop `z-30`, menu container `z-40`.

---

## 4. Menu State — Top-Level (`role="menu"`)

### Menu items

Each action is a `<button role="menuitem" tabIndex={-1}>`. `tabIndex={-1}` removes the items from the tab order — menu navigation uses arrow keys, not Tab.

| Item | Content | Color | Condition |
|------|---------|-------|-----------|
| Rename | "Rename" | `{text.secondary}` | Always shown |
| Archive | "Archive" | `{text.secondary}` | `conversation.archivedAt` is undefined |
| Unarchive | "Unarchive" | `{text.secondary}` | `conversation.archivedAt` is set |
| Move to group | "Move to group…" | `{text.secondary}` | Always shown |
| Delete | "Delete" | `{semantic.error}` | Always shown — red signals destructive action |

### Menuitem visual spec

- **Height**: `auto` with `padding: 6px 12px` (`py-1.5 px-3`) — rows are compact
- **Text**: left-aligned, `12px`, weights as noted in table above
- **Hover**: background `{interactive.hover}`, text color `{text.primary}` (except Delete, which stays `{semantic.error}`)
- **Focus**: `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset` — no offset on inset ring to avoid layout shift within the compact row
- **Transition**: `color`, `background-color` at `fast` (100ms)
- **Cursor**: `pointer`
- **Width**: full width of the menu container

### Archive vs. Unarchive

Only one of Archive or Unarchive is shown at a time based on `conversation.archivedAt`. They occupy the same position in the item list.

---

## 5. Sub-State — Confirm Delete (`role="dialog"`)

Replaces the menu items. The container role switches to `role="dialog" aria-modal="true"`.

### Layout

- **Padding**: `8px 12px` (`py-2 px-3`)
- **Stack**: confirmation text above, button row below

### Confirmation text

- **Content**: "Delete this conversation?"
- **Typography**: `12px`, `{text.secondary}`
- **Margin-bottom**: `8px`

### Button row

Two buttons in a flex row with `gap: 8px`:

**Cancel button**
- **Content**: "Cancel"
- **Typography**: `11px`, `{text.secondary}`
- **Padding**: `4px 8px` (`py-1 px-2`)
- **Flex**: `flex: 1`
- **Background**: `{interactive.hover}`
- **Hover**: `{interactive.hover}` at `80%` opacity
- **Border-radius**: `{radius.sm}`
- **Action**: closes menu, returns focus to trigger button (`triggerRef`)
- **Focus**: receives focus automatically when confirm-delete state opens (WCAG 2.4.3 — safe default)
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Data attribute**: `data-confirm="true"` — used by keyboard Tab-cycling logic
- **Transition**: `background-color`, `color` at `fast` (100ms)

**Delete button**
- **Content**: "Delete"
- **Typography**: `11px`, `#FFFFFF`
- **Padding/flex**: same as Cancel
- **Background**: `{semantic.error}` background variant (`bg-error-bg`)
- **Hover**: `opacity: 0.90`
- **Border-radius**: `{radius.sm}`
- **Action**: calls `onDelete()`, closes menu, returns focus to trigger
- **Focus ring**: `2px solid {interactive.focusRing}`, `1px offset`
- **Data attribute**: `data-confirm="true"`
- **Transition**: `opacity` at `fast` (100ms)

---

## 6. Sub-State — Move to Group (`role="dialog"`)

### Layout

- **Padding**: `8px 12px`
- **`data-substate`** attribute on the panel wrapper — used by Tab-cycling keyboard logic

### Instruction text

- **Content**: "Group name (blank to clear)"
- **Typography**: `11px`, `{text.muted}`
- **Margin-bottom**: `6px`

### Text input

- **Placeholder**: "Enter group name"
- **Height**: auto with `padding: 4px 8px` (`py-1 px-2`)
- **Width**: full width
- **Font size**: `12px`
- **Background**: `{surfaces.input}`
- **Border**: `1px solid {borders.default}`; `{borders.strong}` on focus
- **Border-radius**: `{radius.sm}`
- **Text color**: `{text.primary}`; placeholder: `{text.muted}`
- **Focus ring**: `2px solid {interactive.focusRing}`, `2px offset`
- **Keyboard**: `Enter` confirms; `Escape` closes menu and returns focus to trigger
- **On mount**: input receives focus automatically

### Existing group suggestions

If `existingGroups.length > 0`, a suggestion list appears below the input:
- **List**: `max-height: 96px` (`max-h-24`), `overflow-y: auto`, `margin-top: 6px`
- **Each row**: full-width button, `padding: 4px 8px`, `border-radius: {radius.sm}`, `11px`, `{text.secondary}`
- **Hover**: `{interactive.hover}` background, `{text.primary}`
- **Action**: clicking a suggestion calls `onSetGroup(groupName)` and closes the menu

### Button row

Same structure as confirm-delete: Cancel (left) + Confirm (right) in `gap: 8px` flex row, `margin-top: 8px`.

**Cancel**: `{text.secondary}`, `{interactive.hover}` bg — closes menu, returns focus to trigger.

**Confirm**: `{text.primary}`, `{interactive.active}` background (`bg-interactive-active`), hover `opacity: 0.9` — calls `onSetGroup(trimmedInput)`. Empty input clears the group (`onSetGroup(undefined)`).

Both buttons: `11px`, `px-2 py-1`, `{radius.sm}`, `flex: 1`, `{interactive.focusRing}` focus ring.

---

## 7. Sub-State — Rename (`role="dialog"`)

### Layout

- **Padding**: `8px 12px`
- **`data-substate`** attribute on panel wrapper

### Instruction text

- **Content**: "Rename conversation"
- **Typography**: `11px`, `{text.muted}`
- **Margin-bottom**: `6px`

### Text input

- **Pre-filled**: current conversation title (derived from `getThreadTitle(conversation)`)
- **Placeholder**: "Conversation title"
- **Specs**: identical to group-input text input above
- **On mount**: input receives focus AND selects all text, so the user can immediately overtype

### Button row

Same as group-input: Cancel + Rename (confirm) buttons.

**Confirm button label**: "Rename" (not "Confirm")

**Empty input behavior**: if the user clears the input and confirms, `onRename(conversation.title ?? '')` is called — passing the original title or an empty string, which the parent treats as "derive title from messages."

---

## 8. Keyboard Contract

### Top-level menu state

| Key | Behavior |
|-----|----------|
| `Arrow Down` | Focus next `role="menuitem"`, wraps at bottom |
| `Arrow Up` | Focus previous `role="menuitem"`, wraps at top |
| `Home` | Focus first menuitem |
| `End` | Focus last menuitem |
| `Tab` | Close menu, return focus to trigger |
| `Shift+Tab` | Close menu, return focus to trigger |
| `Escape` | Close menu, return focus to trigger |
| `Enter` / `Space` | Activate focused menuitem |

Arrow-key navigation fires only in `menu` state. Sub-states have their own keyboard handling.

### Sub-states (confirm-delete, group-input, rename)

| Key | Behavior |
|-----|----------|
| `Tab` | Cycle through the sub-state's focusable elements only (confirm buttons, input, action buttons) |
| `Shift+Tab` | Reverse cycle |
| `Escape` | Close menu, return focus to trigger |
| `Arrow Left` / `Arrow Right` (confirm-delete only) | Cycle between the two confirm buttons |

The Tab-cycle is bounded to the sub-state's elements — focus does not escape to the rest of the page while a sub-state is open. This implements a lightweight focus trap appropriate for `role="dialog"`.

### Focus on menu open

When the menu opens (state: `menu`), focus moves to the first `role="menuitem"` element. Implemented via `useEffect` on `menuState.type`.

### Focus on menu close

When the menu closes (from any state), focus returns to the trigger button via `triggerRef.current?.focus()`. A double-rAF (`requestAnimationFrame` twice) ensures React has fully unmounted the menu before the focus restoration fires, preventing React from moving focus to `<body>` between unmount and restore.

---

## 9. Accessibility Notes

- `role="menu"` ↔ `role="dialog"` switch: the container role is dynamic. `role="dialog" aria-modal="true"` applies in all sub-states. `role="menu"` applies in the top-level menu state. `aria-label="Conversation actions"` is set on the container at all times.
- `tabIndex={-1}` on `role="menuitem"` elements: required. Menu items are not Tab-reachable — arrow keys are the navigation mechanism in a menu.
- `data-menu-container` attribute: placed on the container so tests can locate it regardless of its current role.
- The full-viewport backdrop is `aria-hidden="true"` and does not receive keyboard focus.

---

## 10. Reduced-Motion Behavior

No enter or exit animation is specified for the menu. The menu appears and disappears instantly (no slide, no fade). This is by design — context menus must feel responsive. There is nothing to suppress under `prefers-reduced-motion: reduce`.

Color and background transitions on hover/focus use `fast` (100ms). Under `prefers-reduced-motion: reduce`, these snap to `0ms`.
