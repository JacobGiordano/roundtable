# Ada Audit Report — Aria Focus-Visible Batch #216–#220

**Date:** 2026-06-17
**Standard:** WCAG 2.1 Level AA
**Branch:** 216-aria-a11y-focus-visible-batch (commit ccac6a5)
**Audit scope:** Narrow — existing design token sweep using canonical `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` pattern already audited in prior sessions. Full 7-theme contrast audit skipped per CLAUDE.md wave cost optimization rules (no novel color choices introduced).

---

## Components Audited

1. **Sidebar.tsx** — `ThreadActionMenu` group-name `<input>` (line 459)
2. **ModelSelectorPanel.tsx** — `SystemPromptRow` textarea (line 549), `ModelVersionRow` select (line 667)
3. **InteractionModeSwitcher.tsx** — radiogroup `aria-describedby` addition + sr-only note (#220)

---

## Testing Method

- Static code analysis of the diff (ccac6a5 vs main)
- Axe-core automated suite: all 276 a11y tests run via `npm run test:run src/tests/a11y/`
- Existing axe-core test for `InteractionModeSwitcher` (7 tests) run in isolation
- Manual ARIA model analysis for the `aria-describedby` + radiogroup ownership question

---

## Findings

### Blockers (must fix before merge)

None.

---

### Advisories (file as issues, can defer)

#### Advisory A — `sr-only` span inside `role="radiogroup"` may surface as unexpected child in some AT implementations

**WCAG criterion:** 4.1.2 Name, Role, Value (Level A)
**Severity:** Minor
**Components:** `InteractionModeSwitcher.tsx` line 293–296

The `<span id="interaction-mode-coming-soon-note" className="sr-only">` is a direct child of the `role="radiogroup"` div. The WAI-ARIA specification (1.1 §5.3.7) permits any phrasing content as children of a `radiogroup`, and screen readers that process `aria-describedby` by reading the referenced element's text content will correctly announce the note when focus enters the group. However, some older AT implementations (specifically JAWS ≤ 2022, NVDA in some browse modes) may also read the sr-only span's content inline when navigating through the group's children in virtual/browse mode, potentially producing a double-read: once as inline content and once via the `aria-describedby` association.

**Observed behavior in this implementation:** Axe passes. The affected AT versions are declining in share and the behavior is cosmetic (redundant announcement, not blocking).

**Recommended mitigation (optional):** Move the `<span id="interaction-mode-coming-soon-note">` outside the `role="radiogroup"` div — place it as a sibling immediately before or after. The `aria-describedby` reference remains valid from outside the group. This eliminates the double-read risk entirely. Not a blocker because the content communicated is identical either way, and the fix is purely positional.

**File:** `/workspace/.claude/worktrees/agent-a01765c2982141b20/src/ui/InteractionModeSwitcher.tsx`

---

#### Advisory B — `ModelVersionRow` select focus ring may clip on some OS/browser combinations due to missing `ring-offset` color

**WCAG criterion:** 2.4.11 Focus Appearance (AA in WCAG 2.2 — advisory under 2.1)
**Severity:** Minor
**Components:** `ModelSelectorPanel.tsx` line 667

The `<select>` element uses `focus-visible:ring-offset-2` to create visual separation between the ring and the element border. On macOS Safari and some Windows high-contrast modes, native `<select>` elements sometimes receive a system-rendered focus indicator that overrides `ring-offset`. This is not a WCAG 2.1 AA violation (the ring-offset-2 pattern is the project's canonical approach), but worth noting for #181 (WCAG 2.2 upgrade path). The system default focus indicator on `<select>` in these environments typically meets contrast requirements on its own.

---

## ARIA Correctness Analysis — InteractionModeSwitcher #220

### Radiogroup ownership model

The `role="radiogroup"` div contains:
- One `<button role="radio" aria-checked="true">` (Parallel) — legitimate owned radio
- Two `<span>` elements with `aria-label="[Mode] — coming soon"` — no ARIA role, not owned by radiogroup
- One `<span class="sr-only">` with the descriptive note — no ARIA role

**Assessment: Correct.** The WAI-ARIA spec (§5.3.17) requires a `radiogroup` to own `radio` elements; it does not restrict non-role children. Only the Parallel button is announced as a radio in AT interaction mode, satisfying the "at least one functional radio" requirement. The disabled spans are correctly excluded from the radiogroup's ownership model by not carrying `role="radio"`.

**Test compatibility:** The existing assertion at `interaction-mode-switcher.test.tsx:77` — `queryAllByRole('radio')` returns exactly 1 element — is satisfied. The sr-only span carries no role, so it is invisible to role-based queries. All 7 existing tests pass without modification. ✓

### `aria-describedby` approach

The `aria-describedby="interaction-mode-coming-soon-note"` on the radiogroup div is a valid WCAG 2.1 AA approach for communicating contextual information about group members that cannot be conveyed through member labels alone. When AT receives focus on the radiogroup (or the Parallel radio inside it), the referenced content — "Manual and Auto-chain modes are coming soon and are not yet available." — is read as supplementary description.

**Assessment: WCAG 2.1 AA compliant.** This pattern is consistent with WAI-ARIA Authoring Practices Guide §3.7 (Radio Group Pattern) which permits `aria-describedby` on the `radiogroup` element to provide additional context.

### Screen reader discoverability of disabled spans

The disabled spans (`aria-label="Manual — coming soon"`, `aria-label="Auto-chain — coming soon"`) are:
- Not focusable (no `tabIndex`, span has no interactive role) ✓
- Not `aria-hidden` — correctly discoverable in AT browse/reading mode ✓
- Labeled with `aria-label` that includes "coming soon" — communicates unavailability ✓
- Linked to `role="tooltip"` via `aria-describedby` — tooltip content ("Coming soon — not yet available") available as supplementary description ✓

In VoiceOver and NVDA browse/virtual cursor mode, users navigating sequentially through content will encounter these spans and hear their `aria-label` text. The pattern is appropriate: the elements exist in the content flow, describe themselves as "coming soon," and do not mislead the user into expecting interaction.

---

## Focus Visibility Analysis — #216 and #217 Fixes

### Sidebar.tsx — group-name `<input>` (line 459)

**Before:** `focus:outline-none focus-visible:ring-1 focus-visible:ring-focus`
**After:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`

**Assessment: Correct.** Three improvements:
1. `focus:outline-none` → `focus-visible:outline-none` — the native outline is now only suppressed on keyboard focus, not on pointer click. This is the canonical pattern. The previous `focus:outline-none` was suppressing the outline for ALL focus, including programmatic and pointer focus, which is incorrect.
2. `ring-1` → `ring-2` — ring width matches the project's canonical 2px standard.
3. `ring-offset-2` added — provides visual separation between the ring and element edge, improving ring visibility on non-contrasting backgrounds.

### ModelSelectorPanel.tsx — `SystemPromptRow` textarea (line 549)

**Before:** `focus:outline-none focus:border-border-strong`
**After:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`

**Assessment: Correct.** The previous pattern used `focus:border-border-strong` as the sole focus indicator — a border color change. Border color changes alone are a well-known WCAG 2.4.7 (Focus Visible) risk because they are frequently missed by users with low vision and by any user in high-contrast mode where element borders may be overridden by system colors. The new ring-based pattern is more robust and consistent with every other interactive element in the project.

### ModelSelectorPanel.tsx — `ModelVersionRow` select (line 667)

**Before:** `focus:outline-none focus:border-border-strong`
**After:** `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`

**Assessment: Correct.** Same analysis as the textarea above. The `<select>` element additionally benefits from `focus-visible:outline-none` (over `focus:outline-none`) because some browser/OS combinations suppress the system focus ring on `<select>` on mouse click; the `focus-visible:*` boundary ensures the system ring is only suppressed for keyboard focus paths where the explicit ring-2 ring takes over.

---

## Axe-Core Test Results

**Before (baseline):** 276 tests passed across 12 test files
**After (with worktree changes applied):** 276 tests passed across 12 test files

No tests added this session — the changes are a design token pattern swap on existing elements already covered by prior axe tests. The existing `interaction-mode-switcher.test.tsx` (7 tests) validates the #220 changes without modification, confirming Aria's implementation satisfies all pre-existing assertions.

---

## Clean Findings

The following patterns are confirmed correct and should be preserved:

- **`focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2`** — canonical project focus ring; all three changed elements now use this consistently
- **`focus-visible:outline-none`** (not `focus:outline-none`) — correct scoping; native outline suppressed only on keyboard focus paths
- **`role="radiogroup"` + `aria-label="Interaction mode"`** — correctly labeled group
- **Disabled spans without `role="radio"`** — correct; spans are excluded from radiogroup owned radios, preventing AT from announcing unavailable options as selectable radios
- **`aria-label="[Mode] — coming soon"` on disabled spans** — communicates unavailability without relying on color or tooltip-only disclosure

---

## Verdict

**PASS — Ready to merge.**

No blockers found. Two minor advisories filed:

- **Advisory A** (sr-only span inside radiogroup) — double-read risk on older AT; recommended fix is moving the span outside the radiogroup, but not required for WCAG 2.1 AA compliance.
- **Advisory B** (select ring-offset on Safari/high-contrast) — system-level behavior outside component control; no action required for WCAG 2.1 AA; tracked under #181.

All three focus-visible pattern fixes (#216, #217) are correct implementations of the canonical project pattern. The `aria-describedby` addition (#220) is WCAG-valid, compatible with the existing test suite, and improves screen reader communication about the radiogroup's partially-disabled state.
