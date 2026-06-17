# Ada Audit Report — Issues #222 and #223: Scroll Ring + Inert Panel

**Date**: 2026-06-17
**Standard**: WCAG 2.1 Level AA
**Scope**: Two targeted fixes on local main (commit bb7c40a)
- #222 — `focus-visible` ring on `MessageThread` scroll container (`MessageThread.tsx:284`)
- #223 — `inert` attribute on closed `ProviderSettingsPanel` drawer (`ProviderSettingsPanel.tsx:907–916`)
**Testing methods**: Static source analysis; axe-core baseline confirmation; manual keyboard flow
  and DOM logic review (dev server not required for structural/semantic findings at this scope)

---

## Issue #222 — MessageThread scroll container focus ring

### 1. ring-inset correctness — will it be visible or clipped?

**Verdict: PASS**

`ring-inset` is the correct variant for this element. The scroll container (`flex-1 overflow-y-auto`)
sits inside a parent with `overflow-hidden` (`MessageThread.tsx:246`). An outset ring would paint
outside the scroll container's border box and be clipped by the parent's `overflow-hidden`. `ring-inset`
draws a 2px stroke on the inside of the element's own border box, so it is never subject to the parent's
overflow clipping. The element fills the full conversation column height (viewport height minus the sticky
header and input bar), giving the inset ring ample space to be visible on all four edges without
overlapping message content in a distracting way.

This is the correct choice. Using `ring-offset` instead would have clipped; using `outline` with a
negative offset would have been functionally equivalent but diverges from the codebase's established
`ring-inset` convention for full-height containers.

### 2. Focusability prerequisite — will the ring ever fire?

**Advisory** — not a WCAG violation, but worth documenting.

The scroll container `div` at line 284 has no `tabIndex` attribute. In all major browsers, a plain
`div` with `overflow-y-auto` is not keyboard-focusable by default — it does not appear in the tab
order. The `focus-visible:` ring classes are therefore defensive: they will render correctly if
focus arrives programmatically via `scrollContainerRef.current.focus()`, but they do not create a
new keyboard tab stop on their own.

This is not a violation. WCAG 2.1 SC 2.1.1 does not require scroll containers to be in the tab
order when they contain keyboard-operable interactive children (message bubbles, the scroll-to-bottom
button). The ring is correctly in place for any future `tabIndex={0}` addition and for programmatic
focus scenarios. No ticket required — advisory note only, already documented in the prior
`aria-scroll-focus-ring-222.md` report.

### 3. focus-visible:outline-none — no naked suppression?

**Verdict: PASS**

Both `focus-visible:outline-none` and `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset`
are gated on the `:focus-visible` pseudo-class. They activate and deactivate in lockstep. There is no state
where the native outline is suppressed without the ring replacement being active. Correct pattern,
consistent with all other interactive elements in the codebase.

---

## Issue #223 — ProviderSettingsPanel inert attribute

### 1. inert="" (empty string) — is this the correct value?

**Verdict: PASS**

The HTML Living Standard specifies `inert` as a boolean attribute. Boolean HTML attributes are truthy
when present regardless of value — `inert`, `inert=""`, and `inert="inert"` are all equivalent and
all activate the inert subtree behavior. The empty-string form `inert=""` is the canonical serialization
for boolean attributes in HTML5. The implementation correctly uses `!isOpen ? '' : undefined`: when
closed the attribute is present (empty string = inert active); when open the attribute is absent
(undefined causes React to omit the attribute entirely = inert inactive). This is correct.

### 2. What inert guarantees when closed — tab order AND AT tree?

**Verdict: PASS**

The HTML `inert` attribute has three normative effects on the subtree:
1. All descendant elements are removed from the tab order (as if they had `tabindex="-1"`).
2. All descendant elements are removed from the accessibility tree (AT cannot reach them).
3. Pointer events on all descendants are suppressed.

This makes `inert` strictly stronger than `aria-hidden` alone (which covers only item 2) or
`pointer-events-none` alone (item 3 only). The panel already had `pointer-events-none` when closed
(line 920) and `aria-hidden={!isOpen}` (line 912). The `inert` addition unifies all three behaviors
under a single authoritative mechanism and removes the keyboard-reachability gap that `aria-hidden`
alone cannot close.

Browser support: `inert` is supported in all evergreen browsers (Chrome 102+, Firefox 112+,
Safari 15.5+). No polyfill is required for the project's stated support targets.

### 3. No regression on open panel — is inert genuinely absent when isOpen = true?

**Verdict: PASS**

The spread expression is:
```tsx
{...({ inert: !isOpen ? '' : undefined } as React.HTMLAttributes<HTMLDivElement>)}
```

When `isOpen = true`: `!isOpen` is `false`, so the value is `undefined`. React omits attributes
with `undefined` values from the rendered DOM. The attribute is absent — not `inert="false"` (which
would still activate inert in browsers that treat any attribute presence as truthy) but fully absent.
This is the correct behavior.

Complementary check: `aria-hidden={!isOpen}` at line 912. When `isOpen = true`, `aria-hidden` is
`false`. React renders boolean `false` for `aria-*` attributes as the string `"false"`, which is the
correct AT-visible signal that the element is not hidden. This is standard React behavior and correct.

### 4. Focus trap still engages correctly when open?

**Verdict: PASS**

The focus trap effect at lines 832–868 is gated on `if (!isOpen) return` at line 833. It only
attaches the `keydown` listener when `isOpen` is `true`. Since `inert` is absent when `isOpen = true`,
all descendants are fully focusable and the trap's `querySelectorAll` at line 840 will find them
normally. There is no interaction between the inert attribute and the focus trap.

Additional guard: the focus trap's `querySelectorAll` already filters out `[aria-hidden="true"]`
descendants (line 843). This filter is technically redundant with `inert` (inert elements are also
not focusable) but is harmless and was present before the `inert` addition.

The open-on-focus-to-close-button behavior (lines 798–806, `requestAnimationFrame` + `closeBtnRef.current?.focus()`)
is unaffected — `inert` is absent when `isOpen` transitions to `true`, so the close button receives
focus normally.

### 5. DOM tab order with closed panel — no hidden elements in the path?

**Verdict: PASS**

With `inert=""` on the closed drawer root, all drawer descendants are removed from the tab order at
the browser level. The prior `pointer-events-none` class (line 920) and `translateX(100%)` transform
(line 932) made the panel visually and pointer-inaccessible when closed, but neither removed it from
the keyboard tab order. `inert` closes this gap. The tab sequence when the panel is closed now reads:
sidebar interactive elements → main content area (including message thread) → input bar — with no
off-screen drawer elements intercepting Tab. This is the correct, expected behavior.

### 6. Dual aria-hidden + inert — redundancy or conflict?

**Verdict: PASS (intentional redundancy)**

The panel sets both `aria-hidden={!isOpen}` and `inert` (when closed). This is redundant — `inert`
subsumes `aria-hidden` for AT-tree removal. The redundancy is harmless: `aria-hidden="true"` on an
already-inert subtree has no additional effect. The prior `aria-hidden` was the correct pre-`inert`
mechanism; retaining it is defensive and compatible. No conflict exists.

---

## Axe-core baseline

Baseline at session start: **886 tests passed, 0 failed** (40 test files).

No new axe-core tests are warranted for these changes:
- #222 adds CSS classes to a non-interactive container; axe-core does not test focus ring
  rendering or `overflow` clipping — these are visual/behavioral concerns requiring manual review.
- #223 adds an `inert` attribute; axe-core's `aria-hidden-body` and `aria-required-children` rules
  cover `aria-hidden` but do not specifically audit `inert` attribute semantics, which are a
  structural/keyboard concern. The existing `ProviderSettingsPanel` axe test continues to cover
  the open-panel state and passes unchanged.

---

## Summary

| Check | #222 Result | #223 Result |
|---|---|---|
| Core implementation correct | PASS — ring-inset right for clipped container | PASS — empty string correct for boolean attr |
| Clipping risk (ring-inset) | PASS — inset, not clipped by overflow-hidden parent | N/A |
| Attribute absent when open | N/A | PASS — undefined → no DOM attribute |
| Tab order fixed when closed | Advisory — ring present but container not in tab order | PASS — inert removes all descendants |
| AT tree correct when closed | N/A | PASS — inert + aria-hidden together |
| Focus trap unaffected | N/A | PASS — trap gated on isOpen, inert absent when open |
| Focus-on-open unaffected | N/A | PASS — requestAnimationFrame fires after inert clears |
| Existing 886 tests | PASS — all green | PASS — all green |
| Novel colors / 7-theme contrast | Skipped — no color changes | Skipped — no color changes |

**Overall verdict: PASS on both issues. No blockers. No advisory tickets required.**

The `ring-inset` advisory (scroll container not keyboard-focusable by tabIndex) is pre-existing and
already documented. The fixes are correct, complete, and do not introduce regressions.
