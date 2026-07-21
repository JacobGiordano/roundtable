# WCAG 2.5.8 Touch Target Size — Full Component Audit

**Issue**: #534
**Auditor**: Ada
**Date**: 2026-07-21
**Standard**: WCAG 2.2 — 2.5.8 Target Size (Minimum), Level AA
**Method**: Static analysis of Tailwind size classes across all `/src/ui` components

---

## Sizing Reference

| Tailwind class | px equivalent |
|---|---|
| w-4 / h-4 | 16px |
| w-5 / h-5 | 20px |
| w-6 / h-6 | 24px (minimum compliant) |
| w-7 / h-7 | 28px |
| w-8 / h-8 | 32px |
| w-9 / h-9 | 36px |
| p-0.5 (each side) | 2px |
| p-1 (each side) | 4px |
| py-1 (each side) | 4px |
| px-2 (each side) | 8px |

**Rule**: An element is a blocker when its rendered size is below 24×24px AND the clear offset to any adjacent interactive element is below 24px on any side. Elements with `tabIndex={-1}` or `aria-hidden="true"` are exempt.

---

## BLOCKERS

### BLOCKER-1: ModelPill palette icon button
**File**: `/src/ui/components/model-selector/ModelPill.tsx:178-195`
**Element**: Palette icon button (customize accent color)
**Rendered size**: `w-[18px] h-[18px]` = 18×18px
**Offset analysis**: Positioned `absolute top-1/2` inside the pill with `right-2` (8px from the pill's right edge) when dismiss is not shown, or `right-[22px]` when dismiss is shown. The pill itself is an interactive button and is the immediate containing element — the palette button overlaps the pill's interactive surface with no 24px separation. When dismiss IS shown, the dismiss × button (`w-6` = 24px) sits `ml-1` = 4px to the right; 4px < 24px required offset. In both configurations the element is 18×18px with no qualifying spacing offset.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to minimum `w-6 h-6` (24×24px). The pill already has `pr-7` (28px right padding) when the palette icon is shown, providing enough room for a 24px button at `right-2`.

---

### BLOCKER-2: SearchBar clear button
**File**: `/src/ui/components/sidebar/SearchBar.tsx:93-105`
**Element**: Clear search (×) button
**Rendered size**: `w-4 h-4` = 16×16px
**Offset analysis**: Sits at `mr-1.5` from the container's right edge, with the search `<input>` as its immediate left neighbor. The gap class on the container is `gap-1.5` = 6px between the input and the clear button. 6px < 24px required offset from the search input. The container is `h-8` = 32px, so vertical offset from the container boundary is fine, but the horizontal proximity to the active input element is the failure.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to minimum `w-6 h-6` (24×24px). The container `h-8` = 32px provides sufficient vertical space. Adjust `mr-1` to keep alignment.

---

### BLOCKER-3: SystemPromptRow clear button
**File**: `/src/ui/components/model-selector/SystemPromptRow.tsx:147-163`
**Element**: Clear system prompt (×) button
**Rendered size**: `w-5 h-5` = 20×20px
**Offset analysis**: Positioned `absolute top-2 right-2` inside the textarea's container div. The textarea is an interactive element that occupies the full container. The clear button sits directly above the textarea's interactive surface with `right-2` = 8px offset from the container's right edge; the textarea extends all the way to the container's right edge (its padding-right is `pr-10` = 40px when a prompt is set, pushing text away but the interactive textarea surface still extends full width). Effective offset between the button and the textarea below it: `top-2` = 8px vertically — below 24px.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to `w-6 h-6` (24×24px). The `pr-10` already reserves 40px of right-side space in the textarea when a prompt is set — sufficient for a 24px button at `right-2`.

---

### BLOCKER-4: ProxyNudge dismiss button
**File**: `/src/ui/ProviderSettingsPanel.tsx:400-413`
**Element**: "Dismiss proxy nudge" (×) button on the ProxyNudge component
**Rendered size**: `w-5 h-5` = 20×20px
**Offset analysis**: The button is a flex sibling to the nudge card text content in a `flex items-start` row. The "Set up your proxy →" text button is in the adjacent text column. Because they share a flex row, vertical distance between the dismiss × and the text button is near zero. The dismiss button and the text link exist at the same vertical position in the layout, with only the flex gap between the two columns — no 24px clear offset.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to `w-6 h-6` (24×24px).

---

### BLOCKER-5: InputBar attachment chip remove button
**File**: `/src/ui/InputBar.tsx:1026-1055`
**Element**: Remove attachment (×) button inside each attachment chip
**Rendered size**: `w-5 h-5` = 20×20px
**Offset analysis**: The chip is `h-10` = 40px tall. When multiple chips are present, adjacent chips are separated by `gap-2` = 8px. The remove button of one chip and the start of the next chip are thus 8px apart — below 24px required offset. Even in the single-chip case the 20×20px element is below the 24px minimum.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to `w-6 h-6` (24×24px). The chip `h-10` = 40px has ample vertical room.

---

### BLOCKER-6: ProviderSettingsPanel show/hide API key button (new provider form)
**File**: `/src/ui/ProviderSettingsPanel.tsx:1624-1637`
**Element**: Eye / EyeOff icon button (API key visibility toggle)
**Rendered size**: No explicit `w-*`/`h-*`; contains `<EyeIcon size={14}>` (14×14px SVG). The button has no padding classes so it collapses to the SVG bounding box: ~14×14px.
**Offset analysis**: Positioned `absolute right-3 top-1/2 -translate-y-1/2` inside the API key `<input>`. The input is the underlying interactive element and the button overlaps it with no qualifying offset.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Add `w-8 h-8 flex items-center justify-center` (32×32px) to the button. The input already has `style={{ paddingRight: '36px' }}` which provides enough right-side space for a 32px button.

---

### BLOCKER-7: ProviderSettingsPanel show/hide API key button (ProviderRow edit form)
**File**: `/src/ui/ProviderSettingsPanel.tsx` (ProviderRow edit state)
**Element**: Eye / EyeOff icon button in the existing-provider edit form
**Rendered size**: Same pattern as BLOCKER-6 — no explicit size, ~14×14px
**Offset analysis**: Same overlap-with-input pattern as BLOCKER-6.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Same as BLOCKER-6.

---

### BLOCKER-8: MessageBubble copy button (primary, nameplate)
**File**: `/src/ui/MessageBubble.tsx:871-886` (inside `NameplateCopyButton`)
**Element**: Primary "Copy message as markdown" button
**Rendered size**: `p-0.5` padding (2px each side) + CopyIcon at 14×14px = 18×18px
**Offset analysis**: The button is a flex sibling of the chevron dropdown trigger (BLOCKER-9). No `gap` class is applied between them, meaning they are adjacent with effectively 0px horizontal offset. Both elements are below 24px.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: The copy and chevron buttons should be enlarged together to `min-h-[24px]`. For the copy button specifically, a `w-6 h-6 flex items-center justify-center` wrapper or equivalent padding meets the requirement. The nameplate `h-[28px]` fits a 24px button with 2px top/bottom.

---

### BLOCKER-9: MessageBubble chevron dropdown button (nameplate)
**File**: `/src/ui/MessageBubble.tsx:892-912` (inside `NameplateCopyButton`)
**Element**: "More copy options" chevron trigger
**Rendered size**: `px-0.5 py-0.5` (2px each side) + 8×5px SVG = 12×9px
**Offset analysis**: 0px gap from the primary copy button (BLOCKER-8). Both below 24px.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Address together with BLOCKER-8. Add `min-h-[24px] min-w-[20px] flex items-center justify-center` or similar.

---

### BLOCKER-10: MessageBubble edit button (user bubble nameplate)
**File**: `/src/ui/MessageBubble.tsx:1488-1501`
**Element**: Edit message button in the user bubble nameplate
**Rendered size**: `p-0.5` (2px each side) + EditIcon at 14×14px = 18×18px
**Offset analysis**: Flex sibling of `<NameplateCopyButton>` with `gap-2` = 8px between them. 8px < 24px required offset. The edit button is 18×18px and the adjacent copy button is 18×18px — neither meets the minimum.
**WCAG 2.2 — 2.5.8**: BLOCKER
**Fix**: Enlarge to minimum `w-6 h-6` (24×24px) with `flex items-center justify-center`. The nameplate `h-[28px]` accommodates a 24px button.

---

## ADVISORIES

### ADVISORY-1: MarkdownContent copy-code button
**File**: `/src/ui/components/MarkdownContent.tsx:216-238`
**Element**: "Copy" / "Copied!" button on fenced code blocks
**Rendered size**: `px-2 py-1` + "Copy" text at 11px (line-height:1) ≈ 40px wide × 19px tall
**Offset analysis**: Positioned `absolute top-2 right-2` inside each code block. In multi-code-block responses, adjacent code block copy buttons may be separated by only `mb-3` = 12px — below 24px vertical offset. In single-code-block contexts the element is isolated.
**WCAG 2.2 — 2.5.8**: ADVISORY — 19px height below minimum; multi-block offset concern
**Fix**: Add `min-h-[24px]` to the copy-code button.

---

### ADVISORY-2: ModelSelectorPanel "Provider settings" link button
**File**: `/src/ui/ModelSelectorPanel.tsx:520-538`
**Element**: "Provider settings" text button at the bottom of the model selector panel
**Rendered size**: `py-1.5` (6px each side) + 11px text (line-height:1) ≈ 23px tall
**Offset analysis**: The `pt-3` separator above provides 12px of space from the border — not an interactive element. No adjacent interactive element below (bottom of panel). The offset exception does not apply (no interactive neighbor), but the element itself is approximately 1px shy of the 24px minimum.
**WCAG 2.2 — 2.5.8**: ADVISORY — approximately 23px tall
**Fix**: Change `py-1.5` to `py-[5px]` or add `min-h-[24px]` to guarantee the 24px minimum.

---

### ADVISORY-3: MessageBubble "Retry" button
**File**: `/src/ui/MessageBubble.tsx:1327-1335`
**Element**: "Retry" text button in the error detail section
**Rendered size**: `mt-1.5 text-[12px]` only, no explicit height ≈ 12px tall
**Offset analysis**: Sole interactive element in the error zone; no adjacent interactive neighbors within 24px. Offset exception applies (no qualifying interactive neighbor).
**WCAG 2.2 — 2.5.8**: ADVISORY — below 24px height; offset exception saves it in isolation but the small hit area is a touch usability concern
**Fix**: Add `min-h-[24px] inline-flex items-center` or equivalent padding.

---

### ADVISORY-4: MessageBubble "Reply to [Model]" button
**File**: `/src/ui/MessageBubble.tsx:1355-1369`
**Element**: Directed-reply affordance in the assistant bubble bottom row
**Rendered size**: `text-[11px]` only, no explicit height ≈ 11px tall
**Offset analysis**: The token count text element (non-interactive `<div>`) is on the right; no adjacent interactive elements. Offset exception applies.
**WCAG 2.2 — 2.5.8**: ADVISORY — below 24px height; offset exception saves it but touch usability is poor
**Fix**: Add `min-h-[24px] inline-flex items-center` or `py-1` to the button.

---

### ADVISORY-5: InputBar "Cancel edit" button
**File**: `/src/ui/InputBar.tsx:901-919`
**Element**: "Cancel" button in the edit mode banner
**Rendered size**: `px-2 py-0.5` (1px top/bottom) + 12px text ≈ 14px tall
**Offset analysis**: Adjacent to the "Editing message" text label (non-interactive). No interactive neighbor within 24px. Offset exception applies.
**WCAG 2.2 — 2.5.8**: ADVISORY — approximately 14px tall; offset exception applies
**Fix**: Change `py-0.5` to `py-1` (minimum) or add `min-h-[24px]`.

---

### ADVISORY-6: ImageCopyButton (below generated images)
**File**: `/src/ui/MessageBubble.tsx:201-219` (ImageCopyButton component)
**Element**: "Copy" button rendered below each generated image
**Rendered size**: `px-1.5 py-0.5` (1px top/bottom) + 11px text ≈ 13px tall; ~40px wide
**Offset analysis**: Flex sibling of the Download button with `gap-1` = 4px between them. Both are below 24px height and the gap between them is 4px < 24px. This makes both the Copy and Download buttons below-threshold elements with insufficient offset between them.
**WCAG 2.2 — 2.5.8**: ADVISORY — below 24px height with insufficient horizontal offset from the Download button sibling
**Fix**: Add `min-h-[24px] flex items-center` to both the Download and ImageCopyButton elements, and maintain at least `gap-2` = 8px between them (or better, `gap-3` = 12px if the buttons are enlarged to 24px each, since the required offset between 24px elements drops to 0).

---

### ADVISORY-7: BulkActionBar "Clear" button
**File**: `/src/ui/components/sidebar/BulkActionBar.tsx:88-98`
**Element**: "Clear" text button (deselect all)
**Rendered size**: `text-[11px]` only, no explicit height ≈ 11px tall
**Offset analysis**: Separated from the checkbox wrapper (`min-w-[24px]`) by `gap-2` = 8px. The checkbox wrapper is a 24px interactive element (wraps `<input type="checkbox">`). 8px offset < 24px required. The "Clear" button is 11px tall and 8px from an interactive neighbor.
**WCAG 2.2 — 2.5.8**: ADVISORY (borderline blocker — gap to checkbox wrapper is 8px, below 24px threshold)
**Fix**: Add `min-h-[24px] inline-flex items-center` or `py-1` to the Clear button. Also consider increasing the flex `gap-2` to `gap-3` or more to widen the offset.

---

## CONFIRMED PASS — NO ACTION NEEDED

| Component | Element | Size | Notes |
|---|---|---|---|
| InputBar | Send button | 44×44px | Exceeds minimum |
| InputBar | Stop button | 44×44px | Exceeds minimum |
| InputBar | Attach button | 44×44px | Exceeds minimum |
| InputBar | Directed-reply clear × | 24×24px | Exact minimum, PASS |
| ExportButton | Export trigger | 32×32px | Exceeds minimum |
| ThreadRow | Ellipsis (⋮) menu button | 28×28px | Exceeds minimum |
| Sidebar | Ghost mode toggle | 32×32px | Exceeds minimum |
| Sidebar | Collapse sidebar (desktop) | 32×32px | Exceeds minimum |
| Sidebar | New conversation (desktop) | 32×32px | Exceeds minimum |
| Sidebar | Provider settings gear | 32×32px | Exceeds minimum |
| Sidebar | Close button (mobile) | 32×32px | Exceeds minimum |
| AppLayout | Hamburger (mobile) | 44×44px | Exceeds minimum |
| AppLayout | Settings gear (mobile) | 44×44px | Exceeds minimum |
| AppLayout | New conversation (mobile) | 44×44px | Exceeds minimum |
| AppLayout | Expand sidebar (desktop) | 32×32px | Exceeds minimum |
| Lightbox | All four control buttons | 36×36px | Exceeds minimum |
| AccentColorPicker | Custom swatch button | 36×36px | Exceeds minimum |
| AccentColorPicker | Preset swatch buttons (12) | 28×28px | Exceeds minimum |
| ModelPill | Pill toggle (role="switch") | h-8 = 32px + flex width | Exceeds minimum |
| ModelPill | Dismiss × button | 24×24px (tabIndex={-1}, aria-hidden) | EXEMPT |
| AddModelButton | "Add model" button | h-8 = 32px + flex width | Exceeds minimum |
| SystemPromptRow | Header toggle button | h-9 = 36px + full width | Exceeds minimum |
| BulkActionBar | Archive / Delete selected | py-1.5 + flex-1 full-width | Wide enough |
| BulkActionBar | Cancel / Delete confirm | py-1.5 + flex-1 | Wide enough |
| ThreadRow | Checkbox | 14×14px (wrapped in min-24px div) | Wrapper provides 24px |
| BulkActionBar | Select-all checkbox | 14×14px (wrapped in min-24px div) | Wrapper provides 24px |
| ArchiveToggle | Active / Archived buttons | h-8 = 32px, flex-1 width | Exceeds minimum |
| GroupHeader | Collapse/expand button | h-8 = 32px, full width | Exceeds minimum |
| ThreadActionMenu | All menu items | py-1.5 + full width | Exceeds minimum |
| ProviderSettingsPanel | All capability checkboxes | 16px (label provides full-width click area) | Label is the effective target |
| MessageBubble | Attachment thumbnail triggers | min 64×64px | Exceeds minimum |
| MessageBubble | Generated image triggers | min 140×140px or full image size | Exceeds minimum |

---

## AUDIT METHOD

This audit was conducted via static analysis of Tailwind class strings in all interactive components under `/src/ui/`. Every `<button>`, `<input>`, and `<a>` element was inspected for:

1. Explicit size classes (`w-*`, `h-*`, `min-w-*`, `min-h-*`)
2. Padding-derived sizing (`p-*`, `px-*`, `py-*`) combined with icon or text content size
3. Proximity of adjacent interactive elements (for offset analysis)
4. `tabIndex={-1}` or `aria-hidden` status (for exemption)

Dev-server verification is recommended for elements where size is content-driven (text-only buttons without explicit height). All blocker classifications are based on Tailwind class evidence and are expected to hold in the rendered DOM.
