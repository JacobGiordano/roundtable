# Roundtable — Phase 4 Follow-up Accessibility Audit

**Auditor**: Ada  
**Date**: 2026-06-12  
**Standard**: WCAG 2.1 Level AA  
**Phase**: 4 — Feature-complete  
**Method**: Static source analysis of `/src/ui/` and `/src/auth/` components + axe-core automated scans via `@testing-library/react` + `vitest-axe` + manual keyboard logic review  
**Branch**: `ada-phase4-followup`

---

## Scope

Components audited this session (all new or significantly reworked since the phase4-baseline):

1. **Settings Panel** — sidebar settings disclosure widget (`Sidebar.tsx`) housing `ApiKeyPanel`, `TokenCountControl`, and theme switcher (issues #74, #76)
2. **Model Version Picker** — per-model `<select>` control inside `ModelSelectorPanel` (issue #61)
3. **AccentColorPicker post-#72 fixes** — three accessibility improvements from issue #72
4. **Resizable Sidebar Drag Handle** — keyboard-operable splitter control (issue #62)
5. **TokenCountControl** — "Always / On tap / Never" segmented control in settings (issue #36)

---

## Issue Index

| # | Severity | Component | WCAG | GitHub | Status |
|---|----------|-----------|------|--------|--------|
| F1 | Serious | `AccentColorPicker` — nested interactive | 4.1.1 | #82 | Open |
| F2 | Moderate | `TokenCountControl` — role="group" not "radiogroup" | 4.1.2 | #78 | Open |
| F3 | Serious | `AccentColorPicker` — no focus trap | 2.1.2, 2.4.3 | #79 | Open |
| F4 | Minor | `AppLayout` — mobile gear: aria-expanded but no aria-controls | 4.1.2 | #80 | Open |

---

## Critical Findings

None. No keyboard traps, no unlabeled primary interactive controls.

---

## Serious Findings

### F1 — AccentColorPicker: nested interactive element (button contains input)
**File**: `src/ui/AccentColorPicker.tsx:427–458`  
**WCAG**: 4.1.1 — Parsing  
**axe rule**: `nested-interactive`  
**GitHub**: #82  
**Observed markup**:
```html
<button aria-label="Open color picker" class="w-9 h-9 ...">
  <!-- INVALID: <input> is interactive content, may not be inside <button> -->
  <input type="color" aria-hidden="true" tabindex="-1" ... />
</button>
```
The HTML specification prohibits interactive content inside `<button>` elements. An `<input type="color">` is interactive content, even when `tabIndex={-1}` and `aria-hidden="true"` are applied. The visual behavior is correct — clicking the button calls `colorInputRef.current?.click()` programmatically — but the DOM is invalid and AT behavior across implementations is undefined.

**Axe evidence**: `[serious] nested-interactive: Interactive controls must not be nested → .w-9`

**Fix (Aria)**: Move the `<input type="color">` outside the `<button>` as a sibling. The `colorInputRef.current?.click()` call in the button's `onClick` handler still works — the input does not need to be a child of the button to be triggered programmatically. See GitHub issue #82 for the exact code change.

### F3 — AccentColorPicker: no focus trap inside dialog
**File**: `src/ui/AccentColorPicker.tsx`  
**WCAG**: 2.1.2 — No Keyboard Trap (inverse: the dialog has no Tab containment); 2.4.3 — Focus Order  
**GitHub**: #79  
**Observed**: The component renders with `role="dialog"` and `aria-modal="true"` and correctly moves focus into the dialog on open (per #72 fix). However, no Tab containment (focus trap) is implemented. A keyboard user can Tab past the last focusable element inside the picker and reach page content behind the popover. `aria-modal="true"` signals to AT that background content is inert, but it does not enforce this in the DOM — a JavaScript focus trap is required by the WAI-ARIA dialog pattern.

**Focusable elements** (14 total): 12 preset swatch buttons + "Open color picker" button + hex text input + "Reset to theme default" button (conditional).

**Fix (Aria)**: Add a `Tab`/`Shift+Tab` keydown handler on the dialog container that wraps focus at the boundaries. See GitHub issue #79 for the implementation pattern.

---

## Moderate Findings

### F2 — TokenCountControl: uses role="group" instead of role="radiogroup"
**File**: `src/auth/TokenCountControl.tsx:54`  
**WCAG**: 4.1.2 — Name, Role, Value  
**GitHub**: #78  
**Observed markup**:
```html
<div role="group" aria-label="Token count visibility">
  <button role="radio" aria-checked="true">Always</button>
  <button role="radio" aria-checked="false">On tap</button>
  <button role="radio" aria-checked="false">Never</button>
</div>
```
Per WAI-ARIA 1.2, `role="radio"` elements must be owned by `role="radiogroup"`. Using `role="group"` means AT may not announce this as a radio group, may not apply arrow-key navigation expectations, and may not correctly communicate that options are mutually exclusive.

**Fix (Gate)**: Change `role="group"` to `role="radiogroup"` on the container div (`TokenCountControl.tsx:54`). The `aria-label` and all child `role="radio"` + `aria-checked` attributes are correct and must be preserved.

**Note**: Arrow-key navigation between radio options is not implemented (buttons respond only to Tab/Enter). The `role="radiogroup"` pattern expects arrow keys to move selection. This is a secondary concern that does not rise to a WCAG failure given the buttons are individually Tab-focusable; it is noted for a follow-up improvement.

---

## Minor Findings

### F4 — AppLayout: mobile settings gear button has aria-expanded but no aria-controls
**File**: `src/ui/AppLayout.tsx:213`  
**WCAG**: 4.1.2 — Name, Role, Value  
**GitHub**: #80  
**Observed markup**:
```html
<!-- Mobile header -->
<button aria-label="Settings" aria-expanded="{isSettingsOpen}">
  <!-- gear icon -->
</button>
```
The mobile gear button has `aria-expanded` to communicate the settings panel open/closed state, but lacks `aria-controls="sidebar-settings-panel"`. The sidebar settings toggle (`Sidebar.tsx:1307`) correctly uses both `aria-expanded` and `aria-controls`. The mobile trigger should match this pattern.

**Fix (Aria)**: Add `aria-controls="sidebar-settings-panel"` to the mobile gear button in `AppLayout.tsx:213`.

---

## Clean Findings — Confirmed Accessible

These components are correctly implemented and should not be regressed:

### Settings Panel (disclosure widget)
**PASS** — Settings toggle button (`Sidebar.tsx:1305`) uses `aria-expanded` + `aria-controls="sidebar-settings-panel"`. Panel has matching `id="sidebar-settings-panel"`. This is correct disclosure widget pattern.

**PASS** — DOM order: settings panel body is rendered immediately after the toggle button in the DOM. Tab from the toggle naturally enters the panel body without focus management code. This is the correct disclosure widget behavior — no focus management required.

**PASS** — Theme switcher (`Sidebar.tsx:1377`) uses `role="radiogroup"` with `aria-label="Theme"`, and each theme button has `role="radio"` + `aria-checked`. This is the correct radiogroup pattern. (Note: `TokenCountControl` uses `role="group"` instead of `role="radiogroup"` — a separate finding, F2 above.)

**PASS** — "Reset all model colors" button has visible text label and a focus ring. Shown only when overrides exist (correctly conditional).

**PASS** — `ApiKeyPanel`: `<section aria-labelledby="api-keys-heading">` with `<h2>` correctly labels the section. Input has both `<label htmlFor>` association and `aria-label`. Reveal/hide toggle is `tabIndex={-1}` (correctly excluded from Tab order). "Clear" button has `aria-label="Clear {Provider} API key"` (not just "Clear").

**PASS** — The `label` element in `ApiKeyPanel` uses `htmlFor={editing ? inputId : undefined}` — when `editing` is `false` the label correctly has no `for` attribute (since the input is not rendered), avoiding a dangling reference.

### Model Version Picker
**PASS** — Native `<select>` element: fully keyboard-operable without ARIA. The label association is correct: `<label htmlFor={selectId}>` + `<select id={selectId}>`. The select also has `aria-label` as a supplementary name. Selected state is communicated by the native `<select>` value — no `aria-selected` needed.

**PASS** — Reset button has `aria-label="Reset {model.name} to default version"` — specific, not just "Reset". `title="Reset to provider default"` is a redundant visual hint that does not conflict.

**PASS** — When no custom version is selected, a `<span aria-hidden="true">` placeholder preserves layout without adding phantom elements to the accessibility tree.

**PASS** — `ModelVersionRow` is only rendered when `availableVersions.length > 1` — models with only one version do not get a confusing no-op picker.

### AccentColorPicker (#72 fix verification)
**PASS** — Fix 1 (pre-populate with live color): `getModelDefaultAccentHex()` reads the CSS custom property from `:root` for the model's actual live accent color. `selectedHex` initializes from `currentColor ?? getModelDefaultAccentHex(modelId)`. The picker opens pre-populated with the model's actual visible color, not always Amber.

**PASS** — Fix 2 (focus matching swatch on open): `useLayoutEffect` fires synchronously after DOM paint and calls `initialFocusRef.current?.focus()` (preset color) or `customSwatchRef.current?.focus()` (custom color). Focus moves into the dialog on open per WCAG 2.4.3.

**PASS** — Fix 3 (custom swatch ring): `isCustomColor` (`initialFocusIndex === -1`) drives `outline: '2px solid var(--text-primary)'` on the custom swatch button, and `customSwatchRef` receives initial focus. The selection ring is a non-color visual indicator.

**PASS** — `role="dialog"` + `aria-modal="true"` + `aria-label` on the dialog container.

**PASS** — Swatch buttons: `aria-label={swatch.name}` (color name, not hex value) + `aria-pressed={isActive}`. Color is not the only indicator of selection — `aria-pressed` and the visible outline ring convey selection state non-visually.

**PASS** — Active swatch: visible `outline: 2px solid var(--text-primary)` with 2px offset — meets the 2px focus/selection indicator requirement.

**PASS** — Hidden native color input: `aria-hidden="true"` + `tabIndex={-1}` — correctly excluded from the accessibility tree and Tab order. (Note: nesting it inside `<button>` is finding F1, which must be resolved.)

**PASS** — Hex text input: `aria-label="Custom hex color value"` — labeled.

**PASS** — Escape to close is implemented via `document.addEventListener('keydown', ...)`.

**PASS** — Focus return to trigger on close: `pickerTriggerRef.current?.focus()` in `ModelSelectorPanel.handleCloseColorPicker` returns focus to the palette button.

### Resizable Sidebar Drag Handle
**PASS** — `role="separator"` (WAI-ARIA window splitter pattern).

**PASS** — `aria-orientation="vertical"`.

**PASS** — `aria-label="Resize sidebar"`.

**PASS** — `aria-valuenow={sidebarWidth}` — communicates current width to AT.

**PASS** — `aria-valuemin={SIDEBAR_WIDTH_MIN}` (278) and `aria-valuemax={SIDEBAR_WIDTH_MAX}`.

**PASS** — `tabIndex={0}` — in the natural tab order, keyboard-operable.

**PASS** — `handleDragKeyDown`: `ArrowRight` increases width by 8px; `ArrowLeft` decreases, both clamped to min/max.

**PASS** — Hidden on mobile (`hidden md:block`) — correct, mobile sidebar has fixed width and no resize affordance.

**PASS** — `isDragging`: during drag, `bg-border-strong` is set on the handle for visual feedback. On hover and keyboard focus (`hover:bg-border-strong focus-visible:bg-border-strong`), the same visual feedback appears.

**PASS** — `transition-none` guard when `prefers-reduced-motion: reduce` or while actively dragging — correct.

**PASS** — `cursor-col-resize` — communicates the drag affordance visually.

### ThreadActionMenu (previously finding A5 — verified as fixed)
**PASS** — Focus moves to first `[role="menuitem"]` when the menu opens (useEffect at `Sidebar.tsx:189–194`).

**PASS** — `Tab` in the menu calls `closeAndReturnFocus()` — Tab exits the menu and returns focus to trigger (correct menu Tab behavior per WAI-ARIA menu pattern).

**PASS** — `Escape` closes and returns focus to trigger.

**PASS** — `ArrowDown`/`ArrowUp`/`Home`/`End` navigate between menu items.

**PASS** — `closeAndReturnFocus()` uses `requestAnimationFrame` to wait for the menu to unmount before restoring focus to `triggerRef.current`.

### ThreadRow three-dot trigger (previously finding A6 — verified as fixed)
**PASS** — `focus-visible:opacity-100` is present on the three-dot button (`Sidebar.tsx:568`). The button becomes visible on keyboard focus.

---

## Manual Keyboard Review Notes

Reviewed via source analysis (live browser review pending after fixes are applied):

**Settings panel Tab flow**: Toggle → ApiKeyPanel (Anthropic input) → OpenAI input → TokenCountControl (Always/On tap/Never) → Theme switcher (7 radio buttons) → Reset colors button (conditional). This is a logical Tab order.

**Version picker keyboard**: Native `<select>` — fully operable by keyboard without ARIA intervention. Arrow keys cycle through options; Enter/Space confirm. No custom keyboard handling needed or present.

**AccentColorPicker Tab flow**: Preset swatch 1–12 → "Open color picker" button → hex text input → "Reset to theme default" (conditional). Focus wraps are not implemented (finding F3). Escape closes the dialog from any position (correct).

**Drag handle keyboard**: ArrowRight/ArrowLeft move width by 8px per keystroke. Repeat key (held key) provides continuous resize. No Home/End shortcuts for min/max width (not required but would be a nice enhancement per APG splitter pattern).

---

## Axe-Core Scan Results

All axe scans performed in jsdom via `vitest-axe`.

| Component | axe result | Notes |
|-----------|-----------|-------|
| `ApiKeyPanel` (no required keys) | PASS | |
| `ApiKeyPanel` (with required keys) | PASS | |
| `TokenCountControl` | PASS | role="group" vs "radiogroup" not flagged by axe — caught by manual audit |
| `AccentColorPicker` (all states) | FAIL: nested-interactive | Finding F1 (#82) — it.fails() wrapper applied |
| `ModelSelectorPanel` (with version rows) | PASS | |
| `Sidebar` (empty state) | PASS | |

**Note**: axe does not flag `role="group"` with `role="radio"` children (finding F2). The WAI-ARIA ownership rule violation requires manual audit knowledge to detect. It is documented and ticketed (#78) but will not appear in automated scans until role is corrected (where axe may then confirm the correct pattern).

---

## Test Coverage Added This Session

| File | Type | Tests |
|------|------|-------|
| `src/tests/a11y/components/settings-panel.test.tsx` | Axe + DOM structure | 12 tests |
| `src/tests/a11y/components/accent-color-picker.test.tsx` | Axe + DOM structure | 19 tests (3 marked it.fails pending #82) |
| `src/tests/a11y/components/model-version-picker.test.tsx` | Axe + DOM structure | 7 tests |
| `src/tests/a11y/components/sidebar-drag-handle.test.tsx` | Axe + ARIA attributes | 11 tests |
| `src/tests/a11y/keyboard/keyboard-patterns.test.ts` | Logic contracts | +9 tests (added to existing file) |

**Baseline**: 441 passing tests  
**After this session**: 500 passing, 7 skipped  
**New tests added**: 59

All 59 new tests pass (plus 3 marked `it.fails()` for open issues #82 and #78 which correctly fail until fixed).

---

## Issues Opened This Session

| # | Title | For | Severity |
|---|-------|-----|----------|
| #78 | TokenCountControl: role="group" not "radiogroup" | Gate | Moderate |
| #79 | AccentColorPicker: no focus trap inside dialog | Aria | Serious |
| #80 | Mobile settings gear: aria-expanded but no aria-controls | Aria | Minor |
| #81 | Settings panel focus management (closed — resolved during investigation) | — | Closed |
| #82 | AccentColorPicker: nested interactive (button contains input) | Aria | Serious |

---

## Baseline Findings Verification

The following findings from the phase4-baseline were verified as fixed and should not regress:

| Baseline ID | Status | Notes |
|-------------|--------|-------|
| A2 | FIXED | `id="model-selector-panel"` added to panel container; `aria-controls` resolves |
| A5 | FIXED | ThreadActionMenu: focus management, arrow-key nav, Tab-closes implemented |
| A6 | FIXED | Three-dot trigger: `focus-visible:opacity-100` added |
| A8 | FIXED | AccentColorPicker: `useLayoutEffect` moves focus on open (#72) |
| C2 | FIXED | SessionTokenSection: `aria-controls="session-token-panel"` + `hidden` attribute pattern |
| C3 | FIXED | AddModelButton: changed to `role="menu"` + `role="menuitem"` |

---

## Next Audit Session

1. Re-audit AccentColorPicker after #79 (focus trap) and #82 (nested interactive) are fixed by Aria
2. Re-audit TokenCountControl after #78 is fixed by Gate — confirm `role="radiogroup"` + verify axe passes
3. Add `aria-controls="sidebar-settings-panel"` after #80 is fixed — verify axe passes
4. Live keyboard navigation pass in browser (dev server): complete Tab flow through settings panel with a screen reader
5. Contrast re-audit — pending Luma's fixes to theme tokens from baseline findings B1–B13
