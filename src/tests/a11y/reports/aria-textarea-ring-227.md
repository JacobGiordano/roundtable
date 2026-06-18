# Ada Audit Report — InputBar textarea focus ring
**Issue**: #227
**File**: `src/ui/InputBar.tsx` (textarea element, lines 293–318)
**Standard**: WCAG 2.1 AA
**Date**: 2026-06-18

---

## PASS

All three narrow checks pass. No WCAG violations found.

---

## Finding 1 — Bare `focus:` is correct for this element

**Verdict**: PASS

The textarea carries `id={textareaId}`, which AppLayout sets to `"skip-target"`. The skip link navigates via fragment (`href="#skip-target"`), causing the browser to call `.focus()` programmatically. `focus-visible:` does not fire on programmatic focus — only on keyboard Tab navigation — so bare `focus:` is the required choice here to satisfy WCAG 2.4.1 (Bypass Blocks) and 2.4.3 (Focus Order).

The ring will also appear briefly on mouse click. That is not a WCAG violation. WCAG 2.4.7 (Focus Visible) sets a floor — a visible indicator is required for keyboard users. Showing a ring on mouse click is permitted.

The `focus:outline-none` paired with `focus:ring-2 focus:ring-focus focus:ring-inset` correctly suppresses the browser default outline and substitutes the design-system ring. Pattern is sound.

---

## Finding 2 — `ring-inset` is correct; wrapper does not clip

**Verdict**: PASS

The wrapper div (lines 222–233) has no `overflow-hidden`. The classes present are `w-full bg-input border-t border-border shadow-md px-3 py-3 flex items-end gap-2` plus conditional border/rounding variants. Without `overflow-hidden`, an outset ring would not be clipped either, but `ring-inset` is the better choice here: the textarea has `border-none`, so there is no border gap to bridge with `ring-offset`. The inset ring draws inside the textarea's content area and is fully visible. No clipping occurs.

This is consistent with the established project pattern: `ring-inset` on full-height containers inside styled wrappers (HANDOFF.md gotcha: "ring-inset required on full-height containers inside overflow-hidden parents"). The wrapper is not `overflow-hidden`, but `ring-inset` is still the correct call for a borderless textarea.

---

## Finding 3 — No double-indicator conflict with `isFocused` border state

**Verdict**: PASS

On keyboard Tab:
- `isFocused` state fires `onFocus` → wrapper border shifts to `border-border-strong` (lines 232, 299)
- `focus:ring-2 focus:ring-focus` fires on the textarea itself (line 311)

These are two visually distinct signals on two structurally distinct elements. The wrapper border shift is a styled-container affordance. The textarea ring is the per-element focus indicator required by WCAG 2.4.7. Layering them is compositionally correct — the ring is on the actually-focused element (required), the border change is supplemental context (fine).

No redundancy problem. No conflicting indicator.

---

## Axe tests

No new axe tests warranted for this narrow change. The `focus:ring-*` classes produce no DOM structure changes; they are purely visual CSS state. Axe does not audit CSS class presence. The existing axe test at `src/tests/a11y/components/input-bar.test.tsx` covers the textarea element's accessible name and role — no modification needed.

---

## Summary

| Check | Result |
|---|---|
| Bare `focus:` appropriate for programmatic focus | PASS |
| `ring-inset` visually correct; wrapper does not clip | PASS |
| No double-indicator conflict with `isFocused` state | PASS |

No tickets opened. No issues found.
