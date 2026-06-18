# Ada Audit Report — Skip-Link Target Fix (#226)

**Date**: 2026-06-18
**Standard**: WCAG 2.1 Level AA
**Components audited**: `AppLayout.tsx`, `InputBar.tsx`, `OnboardingEmptyState.tsx`
**Audit scope**: Narrow — skip-link `href` target changed from `#main-content` (non-focusable `<main>`) to `#skip-target` (focusable interactive element). No color changes. Full 7-theme contrast audit not required.
**Testing methods**: Static code review, axe-core automated scans, JSdom rendered tests.

---

## Summary

PASS — no blockers. One advisory filed.

---

## Findings

### 1. No duplicate `id="skip-target"` — PASS

**WCAG 4.1.1 Parsing**

The conditional in `AppLayout.tsx` is a ternary on `isRosterEmpty`:

- `isRosterEmpty === true`: `OnboardingEmptyState` renders with `ctaId="skip-target"`. `InputBar` renders with `textareaId={undefined}`. One element holds the id.
- `isRosterEmpty === false`: `OnboardingEmptyState` does not render. `InputBar` renders with `textareaId="skip-target"`. One element holds the id.

The mutual exclusion is structural — `OnboardingEmptyState` only mounts inside the `true` branch of the ternary. There is no code path where both elements exist in the DOM simultaneously. Axe-core confirmed no `duplicate-id-active` violation in either state.

### 2. WCAG 2.4.1 Bypass Block — PASS

**WCAG 2.4.1 Bypass Blocks**

Both skip-link targets are naturally focusable interactive elements:

- **Active conversation state** (`isRosterEmpty === false`): `id="skip-target"` lands on `<textarea aria-label="Message input">`. This is a native `<textarea>` — keyboard focusable without `tabIndex`. Users can type immediately after the skip link deposits focus.
- **Onboarding state** (`isRosterEmpty === true`): `id="skip-target"` lands on `<button type="button">Add your first provider</button>`. This is a native `<button>` — keyboard focusable and operable without `tabIndex`. Users can activate the CTA with Enter or Space.

Neither target requires `tabIndex` to be focusable. Neither requires `focus()` called programmatically. Fragment navigation from the skip link (`<a href="#skip-target">`) moves focus to the targeted element directly.

**Improvement over prior behavior**: The previous target was `<main id="main-content" tabIndex={-1}>`. `tabIndex={-1}` accepts programmatic focus but is not keyboard-interactive — users could not do anything on the `<main>` element itself. The new targets are both interactive, satisfying the bypass block intent.

Note: `<main id="main-content" tabIndex={-1}>` remains in the DOM (the element still has that id) but is no longer the skip link's target. The lingering `tabIndex={-1}` is harmless — it does not create a tab stop and does not conflict with the new `#skip-target` anchor.

### 3. Focus ring visibility — ADVISORY (see below)

**WCAG 2.4.7 Focus Visible**

**CTA button (`OnboardingEmptyState`)**: Has `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`. A full 2px ring renders on keyboard focus. Skip-link activation is treated as keyboard-initiated focus by all major browsers (the user pressed Tab then Enter to activate the link). The `focus-visible` pseudo-class fires. Ring is present. PASS.

**Textarea (`InputBar`)**: The textarea element itself has `outline-none` and no `focus-visible:ring-*`. Its visual focus indicator is indirect: the parent wrapper `<div>` changes its top-border from `border-border` to `border-border-strong` when `isFocused` state is true (driven by `onFocus`/`onBlur` on the textarea). `onFocus` fires regardless of input modality, including fragment navigation. The border-top color change is present.

**Assessment**: The border-top color shift is a valid focus indicator under WCAG 2.4.7 (any visible change qualifies at AA). However, it is a subtle single-edge color change on a container element — not a ring on the focused element itself. For a skip-link destination — which users specifically activate to reach the "main content" — a more conspicuous indicator would better serve the intent. This does not fail 2.4.7 at WCAG 2.1 AA.

**Advisory**: The textarea's indirect focus indicator (parent border-top color shift) is technically compliant at WCAG 2.1 AA but weaker than expected for a skip-link destination. Adding `focus:ring-2 focus:ring-focus focus:ring-offset-2` directly to the textarea (using `focus:` not `focus-visible:`, since the indicator should show after skip-link activation) would give skip-link users a clear visual confirmation that focus has landed. Filed as issue #227.

---

## Tickets opened

- **#227** (Advisory — Aria): Textarea in InputBar lacks a direct focus ring. The indirect container-border change is technically WCAG 2.4.7 compliant but provides weaker feedback at a skip-link destination. Add `focus:ring-2 focus:ring-focus focus:ring-offset-2` to the `<textarea>` element's class list (using `focus:` not `focus-visible:` so it fires after fragment navigation). Defer: does not block ship.

---

## Axe test results

New tests added:
- `/workspace/src/tests/a11y/components/input-bar.test.tsx` — 4 tests (new file)
  - Default state: no axe violations
  - `textareaId="skip-target"` applied: id present on textarea
  - `textareaId="skip-target"` applied: no axe violations (no `duplicate-id-active`)
  - `textareaId` omitted: textarea id is empty string
- `/workspace/src/tests/a11y/components/onboarding-empty-state.test.tsx` — 3 tests added (9 total, was 6)
  - `ctaId="skip-target"` applied: id present on CTA button
  - `ctaId="skip-target"` applied: no axe violations
  - `ctaId` omitted: CTA button id is empty string

**Counts**: 6 pre-existing + 3 new OnboardingEmptyState + 4 new InputBar = **13 tests, all passing**

---

## Lint and build

- `npm run lint`: PASS (0 warnings, 0 errors)
- `npm run build`: PASS (clean production build)

---

## Clean findings

- **Duplicate-id prevention**: The ternary conditional in AppLayout provides structural mutual exclusion — no runtime guard or deduplication logic is needed. The implementation is correct.
- **Natural focusability**: Both skip-link targets are native interactive elements. No `tabIndex` manipulation was introduced. This is the right pattern.
- **CTA button focus ring**: `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` is present on the CTA button — skip-link users who activate the link via keyboard will see the ring. Preserve this.
- **Prop documentation**: Both `textareaId` and `ctaId` include JSDoc comments explicitly calling out their WCAG 2.4.1 purpose. This is good practice — future maintainers will understand why these props exist.
