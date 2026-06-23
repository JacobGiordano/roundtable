# Keyboard Focus-Trap Audit — Live Browser Testing
**Issue**: #180  
**Date**: 2026-06-22  
**Auditor**: Ada  
**Standard**: WCAG 2.1 Level AA  
**Browser**: Chromium 129 (via Playwright 1.60.0 — Headless)  
**Firefox**: Not tested — `playwright.download.prss.microsoft.com` is not on the container firewall allowlist  

---

## Audit scope

This audit exists because jsdom does not simulate real browser Tab traversal. The existing Vitest keyboard tests in `/src/tests/a11y/keyboard/` dispatch synthetic `KeyboardEvent` objects and manually call `.focus()` to simulate Tab. That approach catches structural bugs (wrong focusable selector, missing listener) but cannot catch:

- Cases where the browser's native focus algorithm escapes the trap before the JavaScript handler fires
- Tab order conflicts between two simultaneously active focus traps
- `tabIndex` attribute edge cases that affect native focus order differently than the selector expects

These Playwright tests drive real Chromium with `page.keyboard.press('Tab')` to verify the actual browser behavior.

**Components audited:**
1. AccentColorPicker — dialog popover for model accent color customization
2. ProviderSettingsPanel — slide-in drawer for provider management
3. ThreadActionMenu — conversation row actions menu + sub-states (rename, group-input)
4. ModelSelectorPanel — supplemental browser verification of previously jsdom-tested trap

**WCAG criteria:**
- 2.1.1 Keyboard (A)
- 2.1.2 No Keyboard Trap (A)
- 2.4.3 Focus Order (AA)

---

## Summary of results

| Component | Tab containment | Escape closes | Focus on open | Focus on close | Overall |
|-----------|----------------|---------------|---------------|----------------|---------|
| AccentColorPicker | **FAIL** | PASS | PASS | PASS | **FAIL** |
| ProviderSettingsPanel | PASS | PASS | PASS | PASS | PASS |
| ThreadActionMenu (top-level) | PASS* | PASS | n/a | PASS | PASS |
| ThreadActionMenu (rename sub-state) | PASS | PASS | n/a | PASS | PASS |
| ThreadActionMenu (group-input sub-state) | PASS | PASS | n/a | PASS | PASS |
| ModelSelectorPanel | PASS | PASS | n/a | PASS | PASS |

\* The top-level menu uses native keyboard navigation (ArrowDown/Up for menu items). Tab within the main menu state was not tested for containment because menus conventionally use arrow keys, not Tab, for item navigation. The sub-state Tab containment tests (which DO test Tab) both pass.

---

## Issues found

### CRITICAL — Issue #262
**AccentColorPicker focus trap broken in real Chromium (WCAG 2.1.2 No Keyboard Trap)**

**WCAG criterion**: 2.1.2 No Keyboard Trap (Level A)  
**Severity**: Critical — keyboard users cannot reliably navigate within the color picker  
**Testing method**: Playwright, real Chromium Tab events  

**Observed behavior**: When the AccentColorPicker dialog is open (triggered by clicking the palette icon on a ModelPill), pressing Tab from the "Amber" swatch (the initially-focused element) immediately moves focus to "Claude — active, click to deactivate" — a button OUTSIDE the AccentColorPicker dialog, inside the ModelSelectorPanel beneath the picker.

**jsdom status**: The existing axe-core tests for AccentColorPicker PASS. The existing jsdom keyboard tests do not cover Tab containment for the AccentColorPicker. axe-core does not test Tab behavior. This is exactly the gap that browser-level testing exists to catch.

**Root cause analysis**: The AccentColorPicker implements its focus trap as an `onKeyDown` handler on the dialog `<div>`. This handler only wraps at boundaries (first element → last, last element → first); for all intermediate Tab presses, it falls through and lets the browser move focus naturally. The ModelSelectorPanel has a simultaneously-active document-level `addEventListener('keydown', handleFocusTrap)` trap. When Tab fires on an AccentColorPicker swatch button:

1. The `keydown` event bubbles through the AccentColorPicker `div` — the `onKeyDown` handler fires. The swatch is not at the boundary, so the handler does nothing and does NOT call `e.preventDefault()`.
2. The event reaches the MSP's `document` listener. The MSP queries all focusable elements within `#model-selector-panel`. Because the AccentColorPicker is rendered as a direct DOM child of the MSP (not in a portal), all AccentColorPicker buttons ARE inside `#model-selector-panel`. The MSP listener evaluates whether the active element is at the MSP's boundary and may redirect focus.
3. The result: focus lands on "Claude — active" (the MSP's Claude toggle chip), bypassing the AccentColorPicker dialog boundary entirely.

The comment at `ModelSelectorPanel.tsx:122` says: "The AccentColorPicker has its own independent focus trap... we exclude elements inside it here via the aria-hidden filter." But the AccentColorPicker does NOT set `aria-hidden` on itself — it uses `aria-modal="true"` — so the exclusion filter (`!el.closest('[aria-hidden="true"]')`) does not exclude AccentColorPicker elements from the MSP's focusable list.

**Fix direction (for Aria)**:
Option A (preferred): Change the AccentColorPicker's focus trap from an `onKeyDown` on the dialog div to a `document.addEventListener('keydown', ...)` that calls `e.stopPropagation()` before `e.preventDefault()` on ALL Tab events within the dialog (not just at boundaries). This prevents the MSP's trap from ever seeing Tab while the AccentColorPicker is open.

Option B: In the MSP's `handleFocusTrap`, detect when `openPickerModelId !== null` and skip Tab handling entirely during that window. This requires lifting `openPickerModelId` into the trap closure.

Option C: Change the AccentColorPicker to render via `createPortal(...)` into `document.body` so its buttons are NOT DOM children of `#model-selector-panel`. Then the MSP's `!panel.contains(active)` check correctly detects that focus is outside the panel and wraps to first — but AccentColorPicker's own trap would also need to be document-level.

**Affected file**: `/src/ui/AccentColorPicker.tsx` (focus trap at line 326–344); `/src/ui/ModelSelectorPanel.tsx` (exclusion filter at line 143–147)

**Test file**: `src/tests/a11y/keyboard/focus-trap-browser.spec.ts` — tests for this behavior are marked `test.fail()` at lines 136 and 155, documenting the gap. When #262 is fixed, remove `test.fail()` from those two tests.

---

## Clean findings (PASS)

### ProviderSettingsPanel — PASS

All keyboard contracts verified in real Chromium:
- Tab containment: 16 focusable elements, Tab cycles through all without escaping (verified with count + 2 extra presses to confirm wrap)
- Shift+Tab from first element wraps to last
- Escape closes the panel and returns focus to the gear trigger button
- Close button (X) closes the panel and returns focus to the gear trigger button
- Focus lands on "Close provider settings" button on open (via `requestAnimationFrame`)

The PSP implementation (`document.addEventListener('keydown', handleFocusTrap)` + `inert` when closed) is correct and holds under real browser conditions.

### ThreadActionMenu — PASS

All keyboard contracts verified in real Chromium:
- Top-level menu: Escape closes, focus returns to trigger, menu items accessible
- Rename sub-state: Tab stays within `[data-substate]` for 5 consecutive presses
- Group-input sub-state: Tab stays within `[data-substate]` for 5 consecutive presses
- Rename sub-state: Escape closes full menu and returns focus to trigger button

### ModelSelectorPanel — PASS

Browser-level verification supplements existing jsdom tests:
- Tab stays within `#model-selector-panel` for full cycle + 2 extra wrap-around presses
- Escape closes the panel and `aria-expanded` returns to `false` on the trigger chip
- Focus returns to the trigger chip after Escape

---

## Tickets opened

- **#262** — `[Ada] AccentColorPicker focus trap broken in Chromium — WCAG 2.1.2 (Critical)`

---

## Test files added

| File | Tests | Passing |
|------|-------|---------|
| `src/tests/a11y/keyboard/focus-trap-browser.spec.ts` | 21 | 21 (2 marked `test.fail()` for known bug #262) |
| `playwright.a11y.config.ts` (root) | config only | n/a |

Run with: `npx playwright test --config playwright.a11y.config.ts`

---

## Firefox note

Firefox was not tested. The container firewall (`init-firewall.sh`) does not include `playwright.download.prss.microsoft.com`, which Playwright requires to install Firefox. Extending the audit to Firefox would require either:
- Adding that domain to the allowlist and restarting the container (requires user authorization)
- Running the audit outside the container on a machine with Firefox installed

The AccentColorPicker bug is browser-engine independent (it is a JavaScript execution order issue, not a browser rendering quirk) and would reproduce in Firefox as well. All other passing tests are likely to pass in Firefox too, given the implementation uses standard DOM APIs.

---

## Lint / build status

- `npm run lint`: not applicable to Playwright `.spec.ts` files (they are not compiled by Vite and not in the Vitest test path)
- `npm run build`: not run — no application code changed; all changes are in `/src/tests/a11y/` and the root `playwright.a11y.config.ts`
- `npm run test:run` (Vitest suite): not re-run — Playwright spec files are excluded from Vitest's test pattern; no Vitest tests were modified this session
