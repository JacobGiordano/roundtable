# Ada Audit Report — Issues #224 and #225: ThreadRow Checkbox Visibility + closeAndReturnFocus

**Date**: 2026-06-17
**Standard**: WCAG 2.1 Level AA
**Scope**: Two targeted changes in `Sidebar.tsx`
- #224 — `focus-within:opacity-100` added to checkbox wrapper div (`Sidebar.tsx:606`)
- #225 — `closeAndReturnFocus` changed from single-rAF to double-rAF (`Sidebar.tsx:237–241`)
**Testing methods**: Static source analysis; axe-core baseline confirmation (886 tests, 0 failed);
  keyboard interaction pattern review

---

## Issue #224 — focus-within on the checkbox wrapper

### The change

```tsx
// Before
'opacity-0 group-hover:opacity-100'
// After
'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
```

The checkbox wrapper `<div>` (absolute-positioned, left-2, top-1/2) holds a single `<input type="checkbox">`.
`focus-within` fires when any descendant of the div receives focus — including via mouse click on the checkbox.

### Question 1: focus-within vs focus-visible — is this the right choice?

**Verdict: PASS with advisory note**

`focus-within` is a CSS pseudo-class that fires on a container when any descendant receives focus,
regardless of how that focus arrived (mouse, keyboard, programmatic). `focus-visible` is a pseudo-class
on the focused element itself indicating keyboard-initiated or script-initiated focus. They are not
interchangeable here because the visibility modifier is on the *wrapper div*, not the *checkbox input*.
CSS does not have a `:has(:focus-visible)` workaround available in all browsers — `:focus-within` is
the appropriate tool for revealing a parent container when a child receives focus.

The real question is whether mouse-clicking the checkbox creates unexpected visual noise. The answer is
no — it does not. The sequence on mouse click is:

1. User moves the mouse over the row → `group-hover:opacity-100` fires, checkbox becomes visible.
2. User clicks the checkbox → `focus-within:opacity-100` fires simultaneously with the click.

At no point does the checkbox appear unexpectedly. The hover state already revealed it; the
`focus-within` rule fires in a state where the element is already visible. There is no flash-in,
flash-out, or surprising reveal on mouse interaction.

The only scenario where `focus-within` would produce unexpected behavior is if the user clicks
directly on the checkbox without first hovering the row (e.g., via touch with no hover state).
In that case, `focus-within:opacity-100` is the *correct* behavior — the checkbox received focus,
so it must be visible. Without `focus-within`, a touch user who tapped the checkbox at full opacity
zero would interact with a completely invisible element, which would be a WCAG 2.1 SC 2.4.7 failure
(Focus Visible) and a practical usability failure.

**WCAG relevance**: SC 2.4.7 (Focus Visible) — Level AA. A focused interactive element must have
a visible focus indicator. Without `focus-within:opacity-100`, the checkbox at `opacity-0` in
non-hover state would receive keyboard focus while visually invisible. The change is required by
WCAG, not cosmetically motivated.

**Advisory**: The codebase uses `focus-visible:opacity-100` for the three-dot menu trigger button
directly below (line 676: `focus-visible:opacity-100`). The menu button reveals itself only on
keyboard focus (correct — no mouse-click stickiness for that element). The checkbox uses
`focus-within` instead because the CSS modifier is on the wrapper div, not the input.
These are different tools for different DOM structures, both correct.

If Aria wanted consistent semantics, the checkbox wrapper could be restructured so the input itself
carries the visibility class (`focus-visible:opacity-100` directly on the `<input>`). However, since
the input is inside an absolutely-positioned wrapper for layout reasons, and since `focus-within`
produces correct accessible behavior with no user-facing downside, this is not a blocker. Document
it as an advisory if a future refactor happens.

---

## Issue #225 — double-rAF in closeAndReturnFocus

### The change

```tsx
// Before: single rAF
requestAnimationFrame(() => { triggerRef.current?.focus(); });
// After: double rAF
requestAnimationFrame(() => {
  requestAnimationFrame(() => { triggerRef.current?.focus(); });
});
```

### Question 2: Is double-rAF reliable? Does it introduce perceptible delay?

**Verdict: PASS**

**Reliability analysis**

The single-rAF pattern has a known race condition. When `onClose()` is called, React schedules a
re-render to unmount the menu component. `requestAnimationFrame` fires before the browser paints,
but React's state updates are batched and may not have committed to the DOM by the time the first
rAF callback runs. Result: `triggerRef.current?.focus()` executes, the browser sets focus on the
trigger, React then commits its re-render (unmounting the menu), and the browser may move focus
to `document.body` because the previously-focused element (if it was inside the unmounting menu)
is gone.

The double-rAF pattern breaks this race by ensuring two browser task queue turns pass between
`onClose()` and the focus call. By the second rAF:
1. React's re-render for `onClose()` has committed — the menu is unmounted.
2. The browser has processed the DOM mutations from that commit.
3. `triggerRef.current` is still valid (it points to the trigger *outside* the menu).
4. The focus call succeeds without being immediately stolen by React's cleanup.

This is a well-established browser pattern for post-unmount focus management. It is not a hack —
it correctly models the async relationship between React state commits and browser paint cycles.

A more robust approach in a React 18 project would be `flushSync()` to force synchronous DOM
commit before focusing. However, double-rAF is correct and idiomatic for this pattern and does
not require any additional imports or React internals.

**Perceptible delay analysis**

At 60fps, one rAF is ~16.7ms. Two rAFs is ~33ms. Human perception of focus placement lag begins
around 100ms. 33ms is not perceptible as a delay to keyboard users. The trigger button receives
focus in the same animation frame cycle from the user's perspective — the menu disappears and
focus returns to the trigger atomically from a human-perception standpoint.

No WCAG criterion governs focus-return latency at this scale. SC 3.2.2 (On Input) and SC 2.4.3
(Focus Order) require predictable, logical focus placement — not sub-frame timing. Both are
satisfied: focus returns to the trigger that launched the menu, which is the correct location
per WCAG 2.4.3.

**Usage sites confirmed**

`closeAndReturnFocus` is called in three places in `ThreadActionMenu`:
1. `handleGroupKeyDown` — Escape key from group-input sub-state
2. `handleMenuKeyDown` — Tab key in non-confirm-delete state (closes menu)
3. `handleMenuKeyDown` — Escape key from any state

All three are keyboard-initiated. No mouse path calls `closeAndReturnFocus`. Double-rAF is
appropriate for all three — they are all post-keyboard-action focus returns where the menu
is about to unmount.

---

## Axe-core baseline

Baseline at session start: **886 tests passed, 0 failed** (40 test files).

Confirmed passing after analysis. No new axe-core tests are warranted for these two changes:

- #224 adds a CSS class to a wrapper div. axe-core does not audit opacity-based visibility or
  CSS focus-within patterns — those are behavioral concerns requiring manual review. The checkbox
  itself already has an explicit `aria-label` (`Select conversation: <title>`) which is the
  substantive accessibility attribute. The existing checkbox structure is unchanged and already
  correct.
- #225 changes rAF nesting depth. axe-core does not test timing or focus-return latency — those
  are behavioral/temporal concerns. The trigger button's ARIA attributes (`aria-haspopup="menu"`,
  `aria-expanded`) are unchanged.

Adding axe tests for these changes would test the harness, not the accessibility. Not warranted.

---

## Summary

| Check | #224 Result | #225 Result |
|---|---|---|
| WCAG criterion addressed | SC 2.4.7 Focus Visible (AA) — checkbox invisible at opacity-0 without fix | SC 2.4.3 Focus Order (AA) — focus returns to trigger after menu closes |
| Correct choice of CSS pseudo-class | PASS — focus-within correct for container-reveals-child pattern | N/A |
| Unexpected visual behavior on mouse | PASS — no flash; element already visible on hover before click | N/A |
| Focus-visible consistency | Advisory — three-dot button uses focus-visible:opacity directly; checkbox wrapper cannot (different DOM structure) | N/A |
| Double-rAF reliability | N/A | PASS — correctly models React async unmount + browser paint cycle |
| Perceptible delay for keyboard users | N/A | PASS — ~33ms is below human perception threshold (~100ms) |
| Focus destination correct | N/A | PASS — returns to trigger (WCAG 2.4.3) |
| Existing 886 tests | PASS — all green | PASS — all green |
| Novel colors / 7-theme contrast | Skipped — no color changes | Skipped — no color changes |

**Overall verdict: PASS on both issues. No blockers. One advisory (no ticket required).**

**Advisory (no ticket)**: The three-dot menu button in the same ThreadRow uses `focus-visible:opacity-100`
directly on the button element. The checkbox uses `focus-within:opacity-100` on the wrapper div.
These are different mechanisms due to different DOM structures, both correct. If ThreadRow is
refactored in a future session, Aria should consider whether the checkbox visibility class can be
moved to the input itself to use `focus-visible:opacity-100` consistently — this would be a cosmetic
consistency improvement, not a correctness fix.
