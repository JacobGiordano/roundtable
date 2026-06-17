# Ada Audit — PR #213 (#205 #210 #211 #212)
Date: 2026-06-17
Auditor: Ada
Scope: Focused audit (no full 7-theme contrast — no novel color values introduced)

---

## Verdict: PASS WITH ADVISORIES

**Blockers: 0**
**Advisories: 3**
**Merge recommendation: PASS**

---

## Blockers (must fix before merge)

None.

---

## Advisories (file as issues, defer)

### ADVISORY 1 — `focus:outline-none` in group-input text field (Sidebar.tsx line 462)

The group-name `<input>` inside `ThreadActionMenu` uses:
```
'focus:outline-none focus-visible:ring-1 focus-visible:ring-focus'
```
The bare `focus:outline-none` suppresses the native outline in all focus contexts (mouse and keyboard alike). This is technically correct when paired with a `focus-visible:` ring — the ring replaces the outline for keyboard users. However, the bare `focus:` class is a code smell and can mask the ring in browsers that don't fully support `:focus-visible`. Recommend replacing `focus:outline-none` with `focus-visible:outline-none` for consistency with the rest of the codebase and defense-in-depth.

**Criterion:** WCAG 2.4.7 Focus Visible (AA) — not a violation at this time, but fragile.

### ADVISORY 2 — `focus:outline-none focus:border-border-strong` in ModelSelectorPanel.tsx (lines 552, 670)

The system prompt `<textarea>` (SystemPromptRow) and model version `<select>` (ModelVersionRow) use:
```
'focus:outline-none focus:border-border-strong'
```
These are bare `focus:` classes, not `focus-visible:`. Keyboard and pointer focus both suppress the native outline and apply a border highlight. This means keyboard-only users see only a border color change with no dedicated focus ring. The border change alone meets minimum contrast requirements (border color shifts to `--border-strong`), so this is not a WCAG AA failure — but a `focus-visible:ring-*` addition would give keyboard users a stronger, standards-consistent signal. These two instances are pre-existing in the codebase and were not introduced by this PR; noted here for completeness.

**Criterion:** WCAG 2.4.7 Focus Visible (AA) — not a violation, but improvement opportunity.

### ADVISORY 3 — "Coming soon" modes in InteractionModeSwitcher not keyboard-discoverable

`Manual` and `Auto-chain` are rendered as `<span>` elements with no `tabIndex`. Their `aria-describedby` attribute references the tooltip `id`, but since the span is not focusable, the `aria-describedby` relationship is never surfaced to assistive technology — AT ignores `aria-describedby` on non-focusable elements. The `aria-label="Manual — coming soon"` is also never read aloud because the span is not in the tab order. Keyboard-only users cannot discover these modes exist or that they are forthcoming.

This is advisory (not a blocker) because:
- The modes are genuinely not implemented; hiding them from keyboard users prevents confusion about non-functional affordances.
- The existing deferred issue #199 covers the broader radiogroup ownership question for this component.

Recommendation: add `tabIndex={0}` and `onFocus`/`onBlur` tooltip handlers to the disabled span, mirroring the ghost mode indicator pattern now established in InputBar.tsx. Or remove `aria-describedby` from the non-focusable span to avoid a dangling reference.

**Criterion:** WCAG 1.3.1 Info and Relationships / 2.1.1 Keyboard — advisory, not a blocker at this stage.

---

## Confirmed Fixes

### Blocker 1 — Ghost mode tooltip keyboard access (InputBar.tsx, #210)

CONFIRMED FIXED. The ghost icon `<div>` now has:
- `tabIndex={0}` — keyboard reachable
- `aria-label="Ghost mode — this conversation won't be saved"` — screen reader label
- `aria-describedby={ghostTooltipId}` — tooltip reference wired correctly
- `onFocus={() => setIsGhostTooltipVisible(true)}` — immediate show on keyboard focus (0ms delay)
- `onBlur={() => setIsGhostTooltipVisible(false)}` — immediate hide on blur
- `onKeyDown` — Escape hides immediately
- `onMouseEnter` fires a 600ms `setTimeout` before showing — hover intentionality delay only
- `onMouseLeave` clears the timer and hides immediately
- Tooltip `<div>` has `role="tooltip"` and the `id` matching `aria-describedby`
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded` — correct `focus-visible:` ring, no bare `focus:ring-*`

The 600ms delay is hover-only; focus shows at 0ms. This is correct per tooltip.md §1.

### Blocker 2 — ThreadActionMenu menuitem buttons missing focus rings (Sidebar.tsx, #212)

CONFIRMED FIXED. All three menu item buttons (Archive/Unarchive, Move to group, Delete) now have:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset
```
All use `focus-visible:` not bare `focus:`. Correct.

Confirm-delete sub-state Cancel and Delete buttons also have:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1
```

### Blocker 3 — Drag-resize handle missing focus ring (Sidebar.tsx, #212)

CONFIRMED FIXED. The resize `<div>` now has:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus
```
No bare `focus:ring-*`. ARIA attributes confirmed: `tabIndex={0}`, `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Keyboard nudge via `ArrowLeft`/`ArrowRight` handlers confirmed (8px steps, clamped to min/max). This is the correct WAI-ARIA splitter pattern.

---

## Additional Verification

### Tooltip ARIA contract (#210, #211)

CONFIRMED CORRECT across both affected components:

**InputBar.tsx ghost tooltip:** trigger `div` has `aria-describedby={ghostTooltipId}`, tooltip `div` has `role="tooltip"` and `id={ghostTooltipId}`. Focus shows immediately (0ms); hover requires 600ms delay. onBlur and Escape hide immediately. Spec compliant.

**InteractionModeSwitcher.tsx ModeButton (active button path):** button has `aria-describedby={tooltipId}`, tooltip has `role="tooltip"` and the correct `id`. `onFocus` handler shows immediately and cancels any pending hover timer. `onBlur` hides immediately. `onKeyDown` hides on Escape. 600ms delay is hover-only. Spec compliant.

### BulkActionBar confirm-delete focus management (#205)

CONFIRMED CORRECT. The `confirmCancelRef` is attached to the Cancel button. `useEffect` keyed on `barState === 'confirm-delete'` calls `confirmCancelRef.current?.focus()` — Cancel receives focus when the confirm state opens. Focus returns to `deleteSelectedRef` on Cancel and after confirm. The prior fix from #197 is fully preserved. Both buttons have correct `focus-visible:ring-*` classes.

### Focus ring discipline — all changed files

Every interactive element in the four changed files uses `focus-visible:` prefix for focus rings. No instance of bare `focus:ring-*` was introduced by this PR. The three `focus:outline-none` / `focus:border-border-strong` instances noted in Advisories 1–2 are either pre-existing or acceptable for text inputs.

### ArchiveToggle buttons (Sidebar.tsx, #212)

CONFIRMED CORRECT. Both Active and Archived buttons have:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset
```

### ThreadRow main button (Sidebar.tsx, #212)

CONFIRMED CORRECT. The thread row `<button>` now has:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset
```

### BulkActionBar "Clear" button (Sidebar.tsx)

CONFIRMED CORRECT. Has `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-1 rounded`.

### AddModelButton dropdown items (ModelSelectorPanel.tsx, #213)

CONFIRMED FIXED. Each `<button role="menuitem">` in the AddModelButton dropdown now has:
```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset focus-visible:bg-hover
```
Previously it had only `focus-visible:outline-none focus-visible:bg-hover` with no ring.

### Ghost mode live region (InputBar.tsx)

`<span aria-live="polite" aria-atomic="true" className="sr-only">` announces ghost mode state changes to screen readers. Always in DOM before any toggle fires. Correct pattern.

### InteractionModeSwitcher active ModeButton

CONFIRMED CORRECT. Has `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`.

### comingSoon span `aria-describedby` (pre-existing, not introduced by this PR)

The `aria-describedby` on the non-focusable `<span>` for disabled modes is a no-op — AT ignores `aria-describedby` on non-focusable elements. The `aria-label` similarly goes unread. This is the status-quo from before this PR; Aria's changes did not make it worse. Captured as Advisory 3 and linked to existing #199.

---

## Summary

| Category | Count |
|----------|-------|
| Blockers | 0 |
| Advisories | 3 |

All three self-reported blockers (ghost mode tooltip keyboard access, ThreadActionMenu menuitem rings, drag-resize handle ring) are confirmed fixed and correct. No regressions found. No WCAG 2.1 AA failures introduced by this PR.

**Merge recommendation: PASS.** File Advisories 1–3 as separate GitHub issues before next wave.
