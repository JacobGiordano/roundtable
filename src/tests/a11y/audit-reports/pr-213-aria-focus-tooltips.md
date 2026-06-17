# Accessibility Audit — PR #213
**Auditor:** Ada  
**Date:** 2026-06-17  
**Branch:** `worktree-agent-acaec0b4c5b950170`  
**Issues covered:** #205, #210, #211, #212  
**Files audited:** `Sidebar.tsx`, `InputBar.tsx`, `InteractionModeSwitcher.tsx`, `ModelSelectorPanel.tsx`  
**Scope:** Focus rings, tooltip ARIA, confirm-delete focus management, comingSoon label. No 7-theme contrast audit (no novel color choices introduced).

---

## Summary

| Category | Count |
|---|---|
| BLOCKER | 3 |
| ADVISORY | 4 |

**Merge recommendation:** BLOCKED — 3 blockers must be resolved before merge.

---

## BLOCKERS

### BLOCKER-1 — Ghost mode indicator tooltip is inaccessible to keyboard users (`InputBar.tsx` lines 228–260)

**Standard:** WCAG 2.1 SC 1.3.1 (Info and Relationships) / SC 4.1.3 (Status Messages advisory overlap)

The ghost mode tooltip is wired correctly for mouse users (600ms hover delay, `role="tooltip"`, `id`/`aria-describedby`). However, the tooltip anchor is a plain `<div>` with no `tabIndex`, no interactive role, and no `onFocus`/`onBlur` handlers. The `aria-describedby` attribute on a non-focusable, non-interactive `<div>` is not consumed by screen readers in any meaningful way. More critically, keyboard users cannot reach the ghost icon at all — there is no keyboard path to trigger or read the tooltip.

The spec (tooltip.md §1) requires: "Focus shows immediately (0ms delay)." There is no `onFocus` handler on the ghost indicator's wrapping element, so the keyboard requirement is unimplemented.

The `title="Ghost mode — this conversation won't be saved"` attribute on the `<div>` (line 230) provides a browser tooltip for mouse-hover-then-pause, but this is inaccessible to keyboard users and unreliable for screen readers.

**Separate concern:** The ghost icon `<GhostIcon />` carries `aria-hidden="true"` (correct), but there is a `<span aria-live="polite">` at line 269–272 that announces ghost mode state changes to screen readers. This live region correctly conveys the ghost mode *state* to screen readers. However, the *tooltip content* ("this conversation won't be saved") is never reachable by keyboard or screen reader navigation.

**Fix required:** The ghost mode indicator needs a keyboard-accessible path. Options include: (a) wrap `GhostIcon` in a `<button>` with `aria-label` and `aria-describedby`, with `onFocus`/`onBlur` handlers mirroring `InteractionModeSwitcher`'s pattern; or (b) if a button is semantically wrong, add a `tabIndex={0}` and appropriate role, plus `onFocus`/`onBlur`.

---

### BLOCKER-2 — ThreadActionMenu `menuitem` buttons have no visible focus ring (`Sidebar.tsx` lines 376–415)

**Standard:** WCAG 2.1 SC 2.4.7 (Focus Visible)

The three top-level menu items ("Archive"/"Unarchive", "Move to group…", "Delete") have `role="menuitem"` and `tabIndex={-1}`. Focus is programmatically managed via `querySelector('[role="menuitem"]')` and `item.focus()`. These elements receive genuine keyboard focus and therefore must have a visible focus indicator.

All three buttons have no focus ring class at all in their `className`. The `className` string is: `"w-full text-left px-3 py-1.5 text-text-secondary hover:bg-hover hover:text-text-primary transition-colors duration-fast"` (and the Delete variant with `text-error`).

**Contrast note:** While the issue #212 sweep added `focus-visible:ring-2 focus-visible:ring-focus` to the confirm-delete Cancel/Delete buttons and group-input Cancel/Confirm buttons, it missed the main menu items. The confirm-delete sub-state and group-input sub-state buttons are correctly ringed; the `type: 'menu'` state buttons are not.

**Fix required:** Add `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset` to all three `role="menuitem"` buttons in `ThreadActionMenu`. Note that because `tabIndex={-1}` + JS-managed focus triggers the `:focus-visible` pseudo-class in modern browsers (the browser's heuristic treats programmatic focus on non-pointer-initiated focus as keyboard-type), using `focus-visible:ring` is correct here.

---

### BLOCKER-3 — Drag-resize handle has no visible focus ring (`Sidebar.tsx` lines 1265–1284)

**Standard:** WCAG 2.1 SC 2.4.7 (Focus Visible) / WCAG 2.1 SC 1.4.11 (Non-text Contrast)

The `role="separator"` drag handle has `tabIndex={0}` and is keyboard-operable (arrow keys resize). On focus, it applies `focus-visible:bg-border-strong`. The handle is `w-1` (4px) wide and positioned at the right edge of the sidebar. The background color change from transparent to `--border-strong` on a 4px strip, with no ring extending outside the element bounds, is almost certainly insufficient for WCAG 1.4.11 non-text contrast (3:1 against adjacent surfaces). More importantly, the element uses `focus-visible:outline-none` with no ring — the 4px color shift is the only indicator.

This predates PR #213, but the PR explicitly expanded the focus ring sweep and this element was not included. Per audit scope, "general sweep: any interactive element you can spot in the changed files that still lacks a `focus-visible:ring-*` class" — this qualifies.

**Fix required:** Add `focus-visible:ring-2 focus-visible:ring-focus` (or `ring-offset-0 ring-inset` depending on visual preference) to the drag handle separator to bring it in line with all other interactive elements in the file.

---

## ADVISORIES

### ADVISORY-1 — Ghost mode tooltip: `title` attribute causes double-announcement in some screen readers (`InputBar.tsx` line 230)

The wrapper `<div>` carries both `title="Ghost mode — this conversation won't be saved"` and `aria-describedby={ghostTooltipId}`. Some screen readers (NVDA/Firefox in particular) announce both the `title` and the `aria-describedby` target. Once BLOCKER-1 is fixed, the `title` attribute should be removed from the wrapper since the tooltip serves the same purpose and is properly wired.

**File a ticket, defer.**

---

### ADVISORY-2 — `SystemPromptRow` textarea and `ModelVersionRow` select use `focus:` not `focus-visible:` (`ModelSelectorPanel.tsx` lines 549, 669)

Both elements use `focus:outline-none focus:border-border-strong` instead of `focus-visible:`. For mouse users clicking into a textarea or select, the browser's default focus ring fires even after a click; `focus:outline-none` suppresses it. Using `focus-visible:outline-none focus-visible:border-border-strong` would correctly suppress the ring after pointer interaction while preserving it for keyboard users.

These elements are not in the PR's stated scope (they predate #212 and #205) but are in files that were touched. This pattern matches the `Aria focus/token/confirm patterns` memory feedback about recurring `focus:` vs `focus-visible:` leaks.

**File a ticket, defer.**

---

### ADVISORY-3 — `comingSoon` span wires `aria-describedby` but the tooltip is never reachable by keyboard or screen reader (`InteractionModeSwitcher.tsx` lines 143–150)

The disabled mode spans correctly use `aria-label={`${config.label} — coming soon`}` and carry `aria-describedby={tooltipId}`. However, the span is not focusable (no `tabIndex`), so `aria-describedby` is never consumed. For mouse users the 600ms hover tooltip appears. For keyboard-only or screen reader users, the `aria-label` conveys "coming soon" but the full description ("Coming soon — not yet available") from the tooltip is inaccessible.

The `aria-label` does communicate the relevant state ("coming soon"), so screen reader users are not misled — this is an enhancement gap, not a failure. The comment in the code (lines 131–133) correctly explains why `aria-disabled` is not used here. This is the same pattern flagged in issue #199 (deferred) — it is not materially worse after this PR.

**File a ticket, defer (same as #199 scope).**

---

### ADVISORY-4 — `ArchiveToggle` semantic: two `aria-pressed` buttons instead of a `radiogroup` (`Sidebar.tsx` lines 770–803)

The Active/Archived filter uses two buttons with `aria-pressed`, which is valid per ARIA spec. However, ARIA's intended pattern for mutually exclusive toggle groups (one and only one active at a time) is `role="radiogroup"` + `role="radio"` with arrow-key navigation. The current `aria-pressed` pattern allows screen readers to believe both can be pressed simultaneously. This predates PR #212 (the ring was added in this PR; the semantic is pre-existing).

Focus rings are now correctly applied (`focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset`). The semantic gap is minor and consistent with common toggle-button practice.

**File a ticket, defer.**

---

## Checklist against audit scope

| Scope item | Result |
|---|---|
| `focus-visible:` (not `focus:`) on all newly-ringed elements | PASS — all new rings use `focus-visible:` |
| Ring color uses `ring-focus` token | PASS — all new rings use `ring-focus` |
| Ghost mode tooltip `aria-describedby` / `role="tooltip"` / `id` wired | PARTIAL — wired but inaccessible to keyboard (BLOCKER-1) |
| Ghost mode tooltip 600ms hover delay | PASS |
| Ghost mode tooltip shows on focus (0ms) | FAIL — no focus handler on indicator (BLOCKER-1) |
| InteractionModeSwitcher 600ms hover delay | PASS |
| InteractionModeSwitcher focus shows immediately (0ms) | PASS — `handleFocus` sets visible immediately |
| Escape hides InteractionModeSwitcher tooltip | PASS — `handleKeyDown` sets invisible |
| `comingSoon` spans — aria-disabled / radiogroup ownership | ADVISORY-3 (unchanged from #199, not worse) |
| BulkActionBar Cancel gets focus on confirm-delete open | PASS — `confirmCancelRef` + `useEffect` |
| BulkActionBar Tab/arrow cycles between Cancel and Delete | PASS — `handleMenuKeyDown` handles Tab and ArrowLeft/Right |
| BulkActionBar confirm buttons have visible focus rings | PASS |
| General sweep — unlisted interactive elements lacking ring | BLOCKER-2 (menu items), BLOCKER-3 (drag handle) |

---

## What does not need fixing

- All elements explicitly listed in the PR description (#212 sweep) are correctly using `focus-visible:ring-2 focus-visible:ring-focus`.
- `ThreadRow` main button: correct (`ring-inset`).
- `ArchiveToggle` buttons: correct (`ring-inset`).
- `BulkActionBar` Clear, Archive, Delete selected, Cancel, Delete (confirm): correct.
- `ThreadActionMenu` confirm-delete Cancel/Delete: correct.
- `ThreadActionMenu` group-input suggestion buttons, Cancel, Confirm: correct.
- `ThreadActionMenu` group-input textarea: corrected to `focus-visible:ring-1 focus-visible:ring-focus` (still uses `focus:outline-none` prefix — see ADVISORY-2 for the broader `focus:` cleanup, but the ring itself is now `focus-visible:`).
- `ModelSelectorPanel` AddModelButton dropdown menu items: correct (`ring-inset`).
- `InteractionModeSwitcher` ModeButton: correct (`ring-offset-2`).
- Focus management in BulkActionBar confirm-delete: correct (Cancel lands focus, focus returns to Delete selected trigger on cancel/confirm).
- Focus management in ThreadActionMenu confirm-delete: correct (Cancel ref, Escape returns to trigger via `closeAndReturnFocus`).
