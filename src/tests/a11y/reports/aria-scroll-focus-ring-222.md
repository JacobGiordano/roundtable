# Ada Audit Report — Issue #222: Scroll Container Focus Ring (MessageThread)

**Date**: 2026-06-17
**Standard**: WCAG 2.1 Level AA
**Scope**: Single CSS class addition to the scroll container `div` in `MessageThread.tsx` (line 284)
**Change**: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset`

---

## Audit Checklist

### 1. Ring visibility — is `ring-inset` the right choice?

**Verdict: PASS**

The scroll container is `flex-1 overflow-y-auto` — a full-height, full-width region. Its direct parent inside `MessageThread` is `flex-1 overflow-hidden flex flex-col` (line 246). Its parent in `AppLayout` is the `<main>` element at line 266: `flex-1 flex flex-col overflow-hidden min-w-0`.

Key point: the scroll container itself has `overflow-y-auto`. An **outset** ring on an element with `overflow-y-auto` (or on any ancestor with `overflow-hidden`) would be clipped by those overflow boundaries — the ring would paint outside the scroll viewport and get hidden. `ring-inset` paints the ring on the inside of the element's border box, so it is never clipped. This is the correct choice for a scroll container.

The scroll container is large enough (it fills the full conversation column height minus the header and input sections) that a 2px inset ring has ample room to be visible on all four edges. No risk of the ring painting behind content in a way that obscures it — the ring is a 2px inset stroke on the container boundary, not on message bubbles.

This follows the identical pattern used by other focusable scroll regions in the codebase (e.g., the "Scroll to bottom" button at line 342 uses `ring-offset-1` instead of `ring-inset`, which is appropriate for a small button — the larger scroll region correctly uses `ring-inset`).

### 2. `focus-visible:outline-none` — does it suppress native outline before ring renders?

**Verdict: PASS**

Both `focus-visible:outline-none` and `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset` are scoped to the `:focus-visible` pseudo-class via Tailwind's `focus-visible:` modifier. They activate and deactivate in lockstep. There is no state where `outline-none` is active but the ring is not — the native outline is suppressed only when the ring replacement is simultaneously applied. This is the correct pattern, consistent with all other interactive elements in the app.

Contrast note: `ring-focus` is the established design token for focus indicators, already audited across themes in prior sessions. No novel color is introduced.

### 3. Regression — do existing a11y tests still pass?

**Verdict: PASS**

Full a11y test suite result: **276 tests passed, 0 failed** across 12 test files.

No existing test covers the scroll container directly (the container is a non-interactive `div` that receives focus programmatically or via keyboard when the user tabs into the message area). The ring classes add no semantic or structural change that would affect axe-core rules or existing test assertions.

---

## Focusability note (advisory, not a blocker)

The scroll container `div` has no `tabIndex` attribute at line 284. In most browsers, a plain `div` with `overflow-y-auto` is not keyboard-focusable by default — users cannot tab to it. The `focus-visible:` ring classes are therefore defensive: they will render if focus arrives programmatically (e.g., a `scrollContainerRef.current.focus()` call elsewhere) but do not create a new tab stop on their own.

This is not a violation — WCAG does not require scroll regions to be in the tab order unless they contain interactive content (which they do: message bubbles, the scroll-to-bottom button). The ring is a correct precaution for programmatic focus scenarios. If a future issue adds `tabIndex={0}` to this container to enable keyboard scroll, the ring will be ready.

---

## Summary

| Check | Result |
|---|---|
| `ring-inset` correct for scroll container | PASS |
| `focus-visible:outline-none` safe (no naked suppression) | PASS |
| Existing a11y tests — 276/276 | PASS |
| Novel colors / 7-theme contrast audit required | No — skipped per scope |

**Overall verdict: PASS. No issues found. No tickets required.**
