# WCAG 2.1 → 2.2 Upgrade Plan

**Auditor**: Ada  
**Date**: 2026-06-22  
**Issue**: #181  
**Scope**: WCAG 2.2 AA delta — two new criteria most likely to require code changes in this codebase: 2.5.8 Target Size (Minimum) and 2.4.11 Focus Not Obscured (Minimum).  
**Baseline**: WCAG 2.1 AA. All existing tests green (1370 passing, 1 pre-existing ExportButton Escape failure unrelated to accessibility).

---

## What changed from 2.1 to 2.2 (AA-relevant delta)

WCAG 2.2 adds the following AA criteria not present in 2.1:

| Criterion | Name | Requirement |
|---|---|---|
| 2.4.11 | Focus Not Obscured (Minimum) | A component receiving focus must not be entirely hidden by author-created content |
| 2.4.12 | Focus Not Obscured (Enhanced) | (AAA — noted for awareness, not required) |
| 2.5.8 | Target Size (Minimum) | Interactive targets must be at least 24×24 CSS pixels, with exceptions for spacing-based equivalents |

WCAG 2.2 also removes 4.1.1 Parsing (obsolete) and clarifies 3.2.6 (AAA). The only new AA criteria requiring code audit are 2.5.8 and 2.4.11.

---

## Part 1: WCAG 2.5.8 Target Size (Minimum)

### What the criterion requires

Interactive targets must be at least 24×24 CSS pixels. Undersized targets are only allowed if the **spacing** around them (the offset to the nearest adjacent interactive target) is sufficient to make the equivalent interaction area 24×24px — specifically, the target's bounding box plus half the spacing to each adjacent target must add up to at least 24px in both dimensions.

Exceptions: targets inline in a sentence (e.g. a link inside a paragraph), targets that are native UI controls (no exception applies to custom components), and targets where the small size is essential to the information (e.g. a color swatch grid).

### Tailwind size reference

| Class | px |
|---|---|
| `w-3.5 h-3.5` | 14×14 |
| `w-4 h-4` | 16×16 |
| `w-5 h-5` | 20×20 |
| `w-6 h-6` | 24×24 |
| `h-6 px-[10px]` | 24px tall — minimum height passes |
| `h-7 px-3` | 28px tall |
| `h-8` | 32×32 (icon buttons with h-8 w-8) |
| `h-9 w-9` | 36×36 |
| `min-w-[44px] min-h-[44px]` | explicit AAA-level override |
| `w-7 h-7` | 28×28 — passes 2.5.8 |

---

### Component inventory — 2.5.8 risk assessment

#### CRITICAL: Below 24×24px with no spacing justification

**1. ThreadRow — Three-dot menu trigger (`ThreadRow.tsx:201`)**

```
w-6 h-6 rounded flex items-center justify-center
```

Size: 24×24px. Exactly at the minimum. Passes 2.5.8 mathematically, but barely — any surrounding element that encroaches the 24px boundary creates a violation. The button is `absolute right-1.5 top-1/2 -translate-y-1/2`, sitting inside a `h-16` row with `pr-8` on the main row button. The right edge of the main row button occupies the same 32px-wide space (`pr-8` = 32px padding, which clears well past the 24px trigger position from the right edge). Assessment: **passes on spacing grounds** but is the tightest target in the application. Should be bumped to `w-7 h-7` (28px) as a safety margin.

**2. ThreadRow — Checkbox (`ThreadRow.tsx:154`)**

```
w-3.5 h-3.5 rounded accent-[var(--accent-claude)] cursor-pointer
```

Size: 14×14px. This is a native `<input type="checkbox">`. WCAG 2.5.8 applies to native controls — the "essential to information" exception does not apply here. The checkbox sits in an `absolute` container that is `left-2 top-1/2 -translate-y-1/2` inside a `h-16` row. The spacing from the nearest neighbor (the main row button which starts at `pl-8`) is approximately 8px of separation between the checkbox and any adjacent interactive element. 14px + half of 8px spacing = 18px effective target. **FAILS 2.5.8.** The checkbox is also invisible until hover — but target size applies regardless of visual opacity.

**3. BulkActionBar — Select-all checkbox (`BulkActionBar.tsx:76`)**

```
w-3.5 h-3.5 rounded accent-[var(--accent-claude)] cursor-pointer
```

Size: 14×14px. Same issue as ThreadRow checkbox. The checkbox has `gap-2` (8px) to the "X selected" label on its right; on its left there is the container padding of `px-3`. The gap to adjacent interactive elements is 8px. 14px + half of 8px = 18px. **FAILS 2.5.8.**

**4. ModelPill — Palette icon button (`ModelPill.tsx:163`)**

```
w-[18px] h-[18px] flex items-center justify-center rounded
```

Size: 18×18px. The palette button sits `absolute right-2` inside a `h-8` (32px) pill. Vertically the button is centered with `-translate-y-1/2`, so its effective vertical bounding box extends 7px above and below the button (half of (32-18) = 7px), giving a 32px vertical effective area. Horizontally, the button is 18px wide and the pill has `pr-7` (28px right padding) creating 10px of space to the pill edge; the nearest adjacent interactive element on the right is the pill's visual border, not another target. The horizontal effective area = 18 + 10 = 28px. **PASSES on spacing grounds for 2.5.8** — but it is the second-tightest target. Worth monitoring; if the pill is ever resized smaller, this fails.

**5. SystemPromptRow — Clear button (`SystemPromptRow.tsx:147`)**

```
absolute top-2 right-2 z-10
w-5 h-5 flex items-center justify-center
rounded text-text-muted
```

Size: 20×20px. The button sits at `top-2 right-2` (8px from top and right edges of the textarea wrapper). The nearest adjacent interactive element is the textarea itself, which occupies the full area below and to the left. The spacing to the nearest interactive neighbor (the textarea boundary) on the top is 8px; on the right is 8px. Effective target: 20 + 8 (right padding) = 28px horizontal; 20 + 8 (top padding) = 28px vertical. **PASSES on spacing grounds for 2.5.8.** But like the palette icon, it passes by relying entirely on the surrounding whitespace rather than its own size.

**6. InputBar — Directed-reply clear button (`InputBar.tsx:277`)**

```
ml-0.5 flex items-center justify-center
w-4 h-4 rounded-full
```

Size: 16×16px. This button sits inside the directed-reply pill alongside the model name text. The pill has `py-1 px-2.5 gap-1.5`. The spacing to the nearest adjacent interactive element (the pill boundary / the textarea below) is approximately 4px (`py-1` = 4px above and below the button content). Effective: 16 + 4 = 20px vertically, 16 + gap contribution ≈ 19px horizontally. **FAILS 2.5.8.** This is the highest-risk undersized target in the codebase.

**7. AccentColorPicker — Color swatches (`AccentColorPicker.tsx:395`)**

```
w-7 h-7 rounded-sm
```

Size: 28×28px. The grid uses `gap-[6px]` (6px between swatches). Spacing to adjacent swatches: 6px, half = 3px. Effective area: 28 + 3 = 31px. **PASSES 2.5.8.** The swatch grid is also arguably an "essential" exception since the small size communicates density and color comparison. Noted for awareness.

**8. AccentColorPicker — Custom swatch button (`AccentColorPicker.tsx:451`)**

```
w-9 h-9 rounded-sm
```

Size: 36×36px. **Passes comfortably.**

#### SERIOUS: Passes but at minimum with no margin

**9. ModelSelectorPanel — Trigger chip and "Add providers" chip**

```
h-6 px-[10px]
```

Height: 24px — exactly at the 2.5.8 minimum. Width expands with content. The chip sits in a `mb-2` gap below the input row. Adjacent elements above it (the input bar) create a sufficient 8px gap. **Passes 2.5.8 on spacing** but should be bumped to `h-7` (28px) for safety and to match the AddModelButton trigger (`h-8`).

**10. BulkActionBar — "Clear", "Archive selected", "Delete selected" action buttons**

```
py-1 rounded text-[11px]
```

Height determined by `py-1` (4px top + bottom padding) plus font height. At 11px font with ~1.2 line-height = ~13.2px line box. Total: approximately 13 + 8 = 21px tall. Width is `flex-1` (expands to fill). **The height may fail 2.5.8** — 21px is below the 24px minimum, and the nearest adjacent targets above (the select-all row) and below (thread rows) provide minimal spacing. Needs verification with dev server. Likely borderline — could go either way depending on exact font rendering.

**11. InteractionModeSwitcher — Mode buttons**

```
h-7 px-3 rounded-full
```

Height: 28px. Width expands with content. **Passes 2.5.8.**

**12. ModelVersionRow — Reset button**

```
flex-shrink-0 h-6 px-[6px]
```

Height: 24px. Width: depends on "Reset" text width, approximately 40px with `px-[6px]` (12px total padding) plus text. The row has `h-9` (36px) height with `gap-2` (8px) between elements. Vertical spacing: (36 - 24) / 2 = 6px above and below. Effective vertical area: 24 + 6 = 30px. **Passes on spacing.** Width is sufficient.

**13. Sidebar header icon buttons (ghost toggle, new conversation, provider gear, close)**

```
w-8 h-8 rounded-md flex items-center justify-center
```

Size: 32×32px. **Passes 2.5.8 comfortably.**

**14. Settings toggle row in sidebar**

```
w-full flex items-center gap-2 h-10 px-4
```

Height: 40px, full-width. **Passes comfortably.**

**15. Theme buttons in settings panel**

```
flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px]
```

Height: `py-1.5` (6px top + bottom) + ~14.4px font = approximately 26px. Width: expands with label text. In the `grid-cols-2` grid with `gap-1.5` (6px gap). Adjacent theme buttons have 6px separation. Effective: 26 + 3 (half gap) = 29px vertical. **Passes on spacing for 2.5.8.**

**16. Scroll-to-bottom FAB in MessageThread**

```
w-8 h-8 rounded-full
```

Size: 32×32px. Floats independently via `sticky bottom-4`. No adjacent interactive targets nearby. **Passes 2.5.8.**

**17. MessageBubble — Copy and Edit buttons**

```
w-6 h-6 rounded flex items-center justify-center
```

Size: 24×24px. Both buttons are `absolute top-2` (8px from top of bubble) and horizontally offset (`right-2` and `right-10`). The bubble has `py-3` (12px top padding), so there's 8px of space above the buttons within the bubble. The nearest adjacent target on the right is the bubble edge (no interactive neighbor). The copy button (`right-2`) has 8px to the right edge (no adjacent target). The edit button (`right-10`) has 8px to the copy button. Effective: 24 + 8 (right gap) = 32px horizontal for copy; 24 + 4 (half the 8px gap to edit) = 28px horizontal for edit. Vertical: 24 + 8 = 32px. **Passes on spacing for both.** But at 24×24 they are at the exact minimum.

**18. ModelVisibilityBar — Per-model toggle buttons**

```
flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium
```

Height: `py-1` (4px top + bottom) + ~13.2px (11px font, ~1.2 line-height) = approximately 21px. Width: expands with label content. The bar uses `gap-1.5` (6px between buttons) and sits in a `py-2` row. Effective vertical: 21px + (8px top padding from bar) / adjacency considerations. **This is likely borderline — may fail 2.5.8 on height alone.** Needs dev server measurement.

**19. GroupHeader in Sidebar**

```
w-full flex items-center gap-1.5 h-8 px-4
```

Height: 32px, full-width. **Passes 2.5.8.**

**20. ArchiveToggle buttons in Sidebar**

```
flex-1 py-1 text-center
```

Height: `py-1` (4px top + bottom) + ~11px text = approximately 19px. However, the toggle is `flex` inside a wrapper with `border border-border`, and the buttons are adjacent to each other without additional spacing. **HEIGHT LIKELY FAILS 2.5.8.** The buttons only have 19px of computed height with no adjacent spacing buffer from neighbors (they share a border). The vertical spacing to the next element (SearchBar) is the margin `my-1.5` (6px), giving half of 6px = 3px. Effective: 19 + 3 = 22px. **FAILS 2.5.8.**

**21. Sidebar settings panel — "Reset all model colors" button**

```
text-[13px] text-text-secondary
hover:text-text-primary hover:underline
```

No explicit height or padding. This is a bare `<button>` with only text content. Computed height will be approximately line-height of text (13px × 1.5 = ~20px). Width is content-width. No adjacent interactive targets in close proximity (it's alone in a `flex justify-end` row). **FAILS 2.5.8 on height** — text-only button with no padding will be under 24px tall.

**22. ModelSelectorPanel — "Provider settings" link-button at panel bottom**

```
inline-flex items-center gap-[5px]
text-[11px] text-text-muted
```

No height or padding specified. Computed height: ~11px × 1.5 = ~17px line box. **FAILS 2.5.8.** This is a text-only button with no padding. Adjacent interactive elements above have gap via `border-t border-border-subtle` and `mt-4 pt-3`, providing roughly 12px of separation. Effective: 17 + 6 (half of 12px gap) = 23px. Still under 24px.

---

### 2.5.8 Summary — at-risk components ranked by priority

| Priority | Component | Location | Size | Status |
|---|---|---|---|---|
| **Blocker** | Directed-reply clear button | `InputBar.tsx:277` | 16×16px | FAILS 2.5.8 |
| **Blocker** | Checkbox (thread row) | `ThreadRow.tsx:154` | 14×14px | FAILS 2.5.8 |
| **Blocker** | Checkbox (bulk action bar) | `BulkActionBar.tsx:76` | 14×14px | FAILS 2.5.8 |
| **Blocker** | ArchiveToggle buttons | `SidebarChrome.tsx:23` | ~19px tall | Likely FAILS 2.5.8 |
| **Serious** | "Reset all model colors" button | `Sidebar.tsx:798` | text-only, ~20px | FAILS 2.5.8 |
| **Serious** | "Provider settings" link-button | `ModelSelectorPanel.tsx:352` | text-only, ~17px | FAILS 2.5.8 |
| **Serious** | ModelVisibilityBar toggle buttons | `MessageThread.tsx:89` | ~21px tall | Likely FAILS 2.5.8 |
| **Serious** | BulkActionBar action buttons | `BulkActionBar.tsx:101,113` | ~21px tall | Borderline |
| **Advisory** | Three-dot menu trigger | `ThreadRow.tsx:201` | 24×24px | At minimum — bump to w-7 h-7 |
| **Advisory** | MessageBubble copy/edit buttons | `MessageBubble.tsx:382,406` | 24×24px | At minimum |
| **Advisory** | ModelSelectorPanel trigger chip | `ModelSelectorPanel.tsx:368` | h-6 (24px) | At minimum — bump to h-7 |
| **Advisory** | ModelVersionRow Reset button | `ModelVersionRow.tsx:93` | h-6 (24px) | At minimum on height |

---

### Recommended fixes for 2.5.8

#### Blockers (must fix before claiming WCAG 2.2 AA conformance)

**Directed-reply clear button** — Increase from `w-4 h-4` to `w-6 h-6` (24px) by removing `ml-0.5` and using the full pill line height as the effective area.

**Thread row and bulk action bar checkboxes** — Native `<input type="checkbox">` elements. The cleanest fix is to add a wrapper with `min-w-[24px] min-h-[24px]` and `flex items-center justify-center` around each checkbox, making the click area meet the 24px minimum. Alternatively, use CSS `appearance: none` and draw a custom checkbox at 24×24px — but that increases maintenance burden. The wrapper approach is simpler. Note: requires Aria to modify `ThreadRow.tsx` and `BulkActionBar.tsx`.

**ArchiveToggle buttons** — Add explicit `h-8` on the buttons (32px, clear pass). Alternatively change `py-1` to `py-2` which increases height from ~19px to ~23px — still under 24px but with `my-1.5` spacing makes 26px effective. `h-8` is cleaner and unambiguous.

#### Serious (should fix before claiming 2.2 conformance)

**"Reset all model colors" button** — Add `py-1 px-2` padding. This lifts the button from ~20px to ~28px computed height.

**"Provider settings" link-button in ModelSelectorPanel** — Add `py-1.5` padding. Current size is insufficient for a reliably tappable target.

**ModelVisibilityBar toggle buttons** — Increase `py-1` to `py-1.5` or set explicit `h-7` on each button. The bar already has `py-2` wrapper padding so vertical spacing should absorb the small delta, but the button itself should meet the minimum.

**BulkActionBar action buttons** — Change `py-1` to `py-1.5` for both Archive and Delete buttons. With `pb-1.5` on the row wrapper this gives enough vertical effective area.

#### Advisory (do as part of broader polish)

- **Three-dot menu trigger**: change `w-6 h-6` to `w-7 h-7` (28px). Eliminates the "at-minimum" risk.
- **MessageBubble copy/edit buttons**: change `w-6 h-6` to `w-7 h-7` (28px). Same rationale.
- **ModelSelectorPanel trigger chip**: change `h-6` to `h-7` (28px). Already clear width-wise.
- **ModelVersionRow Reset button**: change `h-6` to `h-7` (28px).

---

## Part 2: WCAG 2.4.11 Focus Not Obscured (Minimum)

### What the criterion requires

When any UI component receives keyboard focus, the component must not be entirely hidden by author-created content (sticky headers, floating panels, overlays, fixed-position elements). The component may be partially obscured — the criterion is about complete occlusion only. At AA level, partial obscurement is permitted (2.4.12, Enhanced, prohibits even partial obscurement — that is AAA).

### Layout patterns in this application

#### Fixed-position elements that could obscure focused components

**1. ProviderSettingsPanel (`ProviderSettingsPanel.tsx` + `AppLayout.tsx:232`)**

The ProviderSettingsPanel is a fixed-position side panel that slides in from the right with `z-index: 40`. When open, it overlays the main content area. The panel has a backdrop (`AppLayout.tsx:219`) at `z-30`. The panel itself covers the right portion of the main area.

Risk: If a user tabs to a focusable element in the main content area (InputBar, ModelSelectorPanel, MessageThread actions) while ProviderSettingsPanel is open, those elements are rendered behind the panel and its backdrop. The panel uses `aria-modal` behavior (implied by the backdrop interaction), but it does not have a verified focus trap. If focus escapes the panel to the main content area, elements at the right edge of the viewport (export button, model selector, input bar right side) could be entirely obscured by the panel.

Assessment: The panel does have a close button and the backdrop intercepts clicks, but there is no verified focus trap preventing Tab from reaching hidden elements. **MODERATE risk for 2.4.11.**

**2. ThreadActionMenu (`ThreadActionMenu.tsx`)**

The menu renders `absolute right-2 top-1` inside a `relative` thread row container with `z-40`. A full-viewport backdrop (`fixed inset-0 z-30`) sits behind it. The menu itself uses `role="dialog"` in sub-states with `aria-modal="true"`, and keyboard handling is implemented (Tab, Escape). However the full-viewport backdrop at z-30 covers all underlying interactive elements.

When the menu is open, any interactive element behind the backdrop is visually obscured. The menu's keyboard trap is managed in sub-states but in the top-level `role="menu"` state, Tab closes the menu via `closeAndReturnFocus()`. Focus should never reach elements behind the backdrop during normal keyboard operation.

Assessment: **Low risk** — menu closes on Tab before focus can reach an obscured element. Not a 2.4.11 violation under normal operation.

**3. AddModelButton portal dropdown (`AddModelButton.tsx`)**

Rendered via `createPortal` into `document.body` with `position: fixed` and `z-index: 50`. When the dropdown is open, Tab closes it via `closeDropdown()` (not `closeAndReturn()`). Focus is not programmatically returned on Tab — it naturally moves to the next DOM element in the tab order.

Risk: After Tab, the dropdown closes and focus may land on the next focusable element after the AddModelButton trigger. That element (the InteractionModeSwitcher or InputBar) is in the main content area and is not obscured by the dropdown (which is positioned at the top of the model selector area, not at the bottom). Assessment: **Low risk** for 2.4.11, but the Tab behavior should be verified at the bottom of the page — if the viewport is scrolled and the dropdown appears at the top of the visible area, focused elements at the bottom row of the MSP are not obscured by the dropdown above them.

**4. AccentColorPicker (`AccentColorPicker.tsx`)**

Renders `position: fixed` with `z-index: 60`. Uses a focus trap (`handleDialogKeyDown` — cycles Tab/Shift+Tab within the dialog). `aria-modal="true"`. Focus is trapped inside the picker while it is open.

Assessment: **No risk** for 2.4.11 — focus trap prevents focus from reaching obscured elements.

**5. Mobile sidebar drawer (`Sidebar.tsx`, `AppLayout.tsx:187`)**

The sidebar is `fixed inset-y-0 left-0 z-50` on mobile. It slides in over the main content area. The backdrop is at `z-40`. When the sidebar is open on mobile, the main content area is covered. The sidebar receives focus management via the close button but does not have a documented focus trap.

Risk: If the user tabs through the sidebar and continues tabbing, they may focus elements in the main content area (InputBar, MessageThread) which are entirely obscured by the sidebar and its backdrop. **MODERATE risk for 2.4.11 on mobile.**

**6. MessageThread scroll container and ExportButton**

The MessageThread has a `sticky bottom-4` scroll-to-bottom FAB. This is position:sticky inside the scroll container and does not obscure elements above the current scroll position. The ExportButton positions its menu `absolute right-0 top-full` — below the trigger, opening downward into the message thread. If the thread is fully scrolled up, the menu could overlap the top messages, but those are not interactive elements.

Assessment: **No risk** for 2.4.11.

**7. InputBar + bottom bar positioning**

The InputBar is `flex-shrink-0` in the main flex column, rendering at the bottom of the viewport. Elements above it (ModelSelectorPanel, MessageThread) scroll independently. The InputBar is not `fixed` or `sticky` — it is a static flex child.

However: the ModelSelectorPanel panel (when open) slides up as a `model-selector-panel is-open` div above the trigger chip. When the panel is tall (many models) it extends upward into the message thread area. If the panel is open and the user is navigating the message thread via Tab, bubbles in the lower portion of the thread could be partly or entirely covered by the panel.

The panel has `aria-hidden={!isOpen && !isClosing}` but no focus trap. If focus is in the message thread and the model selector panel opens, the thread content behind the panel is still in the tab order.

Assessment: **MODERATE risk for 2.4.11** — the model selector panel can overlap thread content without a focus trap.

---

### 2.4.11 Summary — at-risk patterns ranked by priority

| Priority | Pattern | Components | Risk |
|---|---|---|---|
| **Serious** | Mobile sidebar drawer has no focus trap | `Sidebar.tsx`, `AppLayout.tsx` | MODERATE — focused elements in main content are entirely obscured when drawer is open |
| **Serious** | ModelSelectorPanel slides over thread content without focus trap | `ModelSelectorPanel.tsx` | MODERATE — Tab can reach thread elements while panel covers them |
| **Moderate** | ProviderSettingsPanel has no verified focus trap | `ProviderSettingsPanel.tsx` | MODERATE — Tab can reach main content elements behind the panel |
| **Advisory** | AddModelButton portal Tab behavior | `AddModelButton.tsx` | Low — Tab closes dropdown before focus can reach obscured elements |

---

### Recommended fixes for 2.4.11

**Mobile sidebar drawer focus trap** — When `isMobileOpen` is true, add `inert` to the main content area (`<main id="main-content">`). The `inert` attribute removes all interactive elements from the tab order and hides them from assistive technologies. This is the canonical modern approach and is already used elsewhere in the codebase (per HANDOFF.md: `inert` attribute pattern: `!isOpen ? '' : undefined`). Aria to implement: `<main ... inert={isMobileOpen ? '' : undefined}>` on the `<main>` element in `AppLayout.tsx`.

**ModelSelectorPanel focus trap** — When the panel is open (`isOpen` is true), implement a focus trap within the panel. The panel already has `aria-hidden={!isOpen && !isClosing}` on its container, but focus can still escape. The correct approach: add a Tab-cycle handler within the panel's `<div id="model-selector-panel">` container to keep focus inside the panel when it is open. Alternatively, close the panel when Tab exits it (simpler, but breaks "tab through the model list while panel stays open" workflows). The focus-trap approach is preferred.

**ProviderSettingsPanel focus trap** — Verify whether a focus trap is already implemented by reviewing `ProviderSettingsPanel.tsx` beyond the first 80 lines. If not implemented, add one. The panel uses a slide-in pattern from the right with a backdrop — it must be treated as a modal dialog and trap focus accordingly. File a separate issue once verified.

---

## Part 3: Interaction between 2.5.8 and existing automated tests

### What axe-core currently catches for these criteria

**2.5.8 (Target Size)**: axe-core does not currently have a stable rule for 2.5.8. The `target-size` rule in axe-core exists but is experimental (disabled by default as of axe-core 4.8). It would not have been triggered in any existing tests. All target-size findings in this plan are from manual code analysis, not automated detection.

**2.4.11 (Focus Not Obscured)**: axe-core has no rule for 2.4.11. This criterion requires visual verification in a live browser — it cannot be detected by analyzing the DOM structure alone. Manual testing is required.

### Possible automated test extensions

**For 2.5.8**: A Vitest test could programmatically query button/input/select/a elements and check their rendered dimensions via `getBoundingClientRect()`. This requires jsdom to return accurate layout dimensions, which it does not — jsdom returns zero for layout dimensions. This approach does not work in the current test environment.

Alternative for automated 2.5.8 coverage:
- A Playwright or Cypress test that launches the dev server and measures actual rendered dimensions.
- Or: a code-level lint rule (custom ESLint rule) that flags Tailwind size classes below the threshold on interactive elements. This is a static analysis approach and would not catch spacing-based pass cases.

Neither of these fits the current Vitest-based test stack without additional infrastructure. For now, 2.5.8 coverage must be manual. If the project adds Playwright (browser-based testing), a `target-size.test.ts` suite checking `getBoundingClientRect()` on every `button`, `input`, `select`, and `a` element would be the right implementation.

**For 2.4.11**: Not automatable without a browser runtime (requires visual layout). Same constraint as 2.5.8. A Playwright test that opens the mobile sidebar and then tabs through the main content area, checking `document.activeElement` positions against the sidebar bounding rect, would detect violations. This is feasible but deferred until Playwright is added.

**Extending existing contrast tests for 2.2**: The contrast test file (`/src/tests/a11y/themes/contrast.test.ts`) already tests WCAG 2.1 AA focus ring contrast at 3:1. WCAG 2.2 does not change the focus ring contrast requirement. No changes to `contrast.test.ts` are needed for the 2.2 upgrade.

---

## Part 4: Conformance path to WCAG 2.2 AA

When the identified blockers and serious findings are fixed, the codebase can claim WCAG 2.2 AA conformance for the new 2.5.8 and 2.4.11 criteria. The remaining advisory items are quality improvements that reduce risk but do not block the claim.

Existing WCAG 2.1 AA compliance is not affected by this upgrade path — the changes required are additive.

---

## Ticket list (to be opened)

| Summary | Criterion | Severity | Agent |
|---|---|---|---|
| Fix directed-reply clear button target size (16→24px effective) | 2.5.8 | Blocker | Aria |
| Fix thread row checkbox target size (14px → 24px effective wrapper) | 2.5.8 | Blocker | Aria |
| Fix bulk action bar checkbox target size (14px → 24px effective wrapper) | 2.5.8 | Blocker | Aria |
| Fix ArchiveToggle button height (py-1 → h-8 explicit) | 2.5.8 | Blocker | Aria |
| Fix "Reset all model colors" button padding (add py-1 px-2) | 2.5.8 | Serious | Aria |
| Fix "Provider settings" link-button padding (add py-1.5) | 2.5.8 | Serious | Aria |
| Fix ModelVisibilityBar toggle button height (py-1 → py-1.5 or h-7) | 2.5.8 | Serious | Aria |
| Fix BulkActionBar action button height (py-1 → py-1.5) | 2.5.8 | Serious | Aria |
| Add inert to main content when mobile sidebar is open | 2.4.11 | Serious | Aria |
| Add focus trap to ModelSelectorPanel when open | 2.4.11 | Serious | Aria |
| Verify and add focus trap to ProviderSettingsPanel | 2.4.11 | Moderate | Aria |
| Bump three-dot, copy, edit buttons from w-6 to w-7 | 2.5.8 | Advisory | Aria |
| Bump ModelSelectorPanel trigger chip from h-6 to h-7 | 2.5.8 | Advisory | Aria |

---

## Appendix: components confirmed clear of 2.5.8 and 2.4.11

The following components have no target size or focus obscurement issues:

- **InputBar**: Send/stop buttons (`min-w-[44px] min-h-[44px]`) — over 2.5.5 AAA threshold
- **InputBar**: Cancel edit button (`py-0.5 px-2`) — small but text-only with no adjacent target encroachment; borderline but passes on spacing
- **InputBar**: Ghost mode indicator (`div tabIndex=0`) — not a button, no target size requirement
- **AppLayout mobile header buttons**: All `min-w-[44px] min-h-[44px]` — clear pass
- **Sidebar header buttons** (ghost toggle, new conv, gear, close): All `w-8 h-8` — clear pass
- **AddModelButton trigger**: `h-8` (32px), text content — clear pass
- **ModelPill toggle button**: `h-8` (32px) — clear pass
- **AccentColorPicker**: Custom swatch `w-9 h-9`, preset swatches `w-7 h-7` with `gap-[6px]` — pass
- **ExportButton**: `w-8 h-8` — pass
- **Scroll-to-bottom FAB**: `w-8 h-8` — pass
- **Sidebar settings toggle row**: `h-10` — pass
- **GroupHeader**: `h-8` full-width — pass
- **InteractionModeSwitcher mode buttons**: `h-7` — pass
- **ThreadActionMenu menu items**: Full-width with `py-1.5` — adequate
- **SystemPromptRow expand toggle**: `h-9` — pass
- **ModelVersionRow select**: `h-7` — pass

Focus obscurement (2.4.11):
- **AccentColorPicker**: Has focus trap — no risk
- **ThreadActionMenu**: Tab closes menu before focus escapes — no risk
- **ExportButton popover**: Tab closes via `closeAndReturn()` — no risk
- **AddModelButton dropdown**: Tab closes `closeDropdown()`, focus moves naturally, no obscurement of next element
