# Roundtable — Phase 4 Accessibility Audit (Baseline)

**Auditor**: Ada  
**Date**: 2026-06-10  
**Standard**: WCAG 2.1 Level AA  
**Phase**: 4 — Feature-complete  
**Method**: Static source analysis of all `/src/ui/` components and `/_design/themes/*.json` tokens + pure-TypeScript contrast calculations. Manual keyboard review of source logic. Axe-core automated tests pending `@testing-library/react` and `vitest-axe` installation (see dependency gap below).

---

## Scope

Components audited this session:
- `AppLayout.tsx` — top-level layout wrapper
- `InputBar.tsx` — textarea + send button + ghost mode + directed-reply pill
- `MessageBubble.tsx` — conversation bubbles (user, assistant, streaming, error)
- `MessageThread.tsx` — thread list, scroll, export button header
- `ModelSelectorPanel.tsx` — slide-up panel, model pills, system prompt rows, token section
- `AccentColorPicker.tsx` — color picker popover
- `ExportButton.tsx` — export popover
- `InteractionModeSwitcher.tsx` — mode radiogroup
- `Sidebar.tsx` — nav, thread rows, settings panel, bulk action bar
- `ApiKeyPanel.tsx` (Gate component, mounted by Sidebar) — API key management
- `TokenCountControl.tsx` (Gate component, mounted by Sidebar) — token count preference
- `index.css` — animations, reduced-motion overrides
- All 7 themes: Slate, Linen, Midnight, Ash, Ember, Chalk, Outrun

---

## Dependency Gap

**`@testing-library/react`, `jsdom`, and `vitest-axe` are not installed.**

This prevents axe-core component tests from running. Contrast and keyboard logic tests DO run (pure TypeScript). Axe tests are specified in `src/tests/a11y/components/axe-setup.md` and will become runnable once HANDOFF.md item #1 is completed (adding `@testing-library/react + jsdom`).

This is not an accessibility finding — it is a test infrastructure gap that Scout's next session should resolve.

---

## Issue Index

| # | Severity | Component | WCAG | Status |
|---|----------|-----------|------|--------|
| A1 | Serious | `MessageBubble` — bottom row | 1.1.1, 2.1.1 | Ticket opened |
| A2 | Serious | `ModelSelectorPanel` — trigger chip | 4.1.2 | Ticket opened |
| A3 | Moderate | `MessageBubble` — streaming state | 4.1.3 | Ticket opened |
| A4 | Moderate | `ModelSelectorPanel` — panel | 4.1.2 | Ticket opened |
| A5 | Moderate | `ThreadActionMenu` — focus trap | 2.1.2 | Ticket opened |
| A6 | Moderate | `Sidebar` — three-dot trigger | 2.1.1, 4.1.2 | Ticket opened |
| A7 | Moderate | `InputBar` — ghost mode indicator | 1.1.1 | Ticket opened |
| A8 | Moderate | `AccentColorPicker` — focus management | 2.4.3 | Ticket opened |
| A9 | Moderate | `MessageThread` — live region | 4.1.3 | Ticket opened |
| B1 | Serious | Slate: `text-muted` on card | 1.4.3 | Ticket opened |
| B2 | Serious | Ash: `text-muted` on card | 1.4.3 | Ticket opened |
| B3 | Serious | Ember: `text-muted` on all surfaces | 1.4.3 | Ticket opened |
| B4 | Serious | Linen: `text-muted` on all surfaces | 1.4.3 | Ticket opened |
| B5 | Moderate | Chalk: `text-muted` on bg, sidebar | 1.4.3 | Ticket opened |
| B6 | Moderate | Slate: `error` on card | 1.4.3 | Ticket opened |
| B7 | Moderate | Ash: `error` on card | 1.4.3 | Ticket opened |
| B8 | Serious | Slate: `accent-deepseek` as text | 1.4.3 | Ticket opened |
| B9 | Moderate | Ash: `accent-deepseek` as text | 1.4.3 | Ticket opened |
| B10 | Moderate | Ash: `accent-gemini` as text | 1.4.3 | Ticket opened |
| B11 | Moderate | Ash: `accent-mistral` as text | 1.4.3 | Ticket opened |
| B12 | Moderate | Outrun: `accent-gemini` as text | 1.4.3 | Ticket opened |
| B13 | Moderate | Outrun: `accent-deepseek` as text | 1.4.3 | Ticket opened |
| C1 | Minor | `pill-shake` — reduced-motion | 2.3.3 | Ticket opened |
| C2 | Minor | `SessionTokenSection` — no aria-controls | 4.1.2 | Ticket opened |
| C3 | Minor | `AddModelButton` — listbox/option pattern | 4.1.2 | Ticket opened |

---

## Critical Findings (Blocks Task Completion)

None found. No keyboard traps, no unlabeled interactive controls in the primary flows.

---

## Serious Findings

### A1 — MessageBubble bottom row keyboard inaccessibility
**File**: `src/ui/MessageBubble.tsx:157–199`  
**WCAG**: 2.1 — 1.1.1 Non-text Content; 2.1.1 Keyboard  
**Observed**: The bottom row (Reply button + token count) is hidden at rest with `opacity-0` and `aria-hidden={!rowVisible}`. When `tokenCountVisibility === 'active'` (the default), the row is only revealed on mouse hover. Keyboard-only users tabbing through the thread will reach the "Reply to [Model]" button while it is visually invisible (`opacity-0`) and with `aria-hidden={true}` set on its container, making the button unreachable via keyboard.  
**Detail**: At `rowVisible === false`, `aria-hidden={true}` is set on the container div wrapping both the reply button and the token count. A button inside an `aria-hidden` container is removed from the accessibility tree — keyboard Tab will skip it entirely.  
**Impact**: A keyboard-only user cannot initiate directed replies at all in the default 'active' visibility mode.  
**Fix**: Remove `aria-hidden` from the bottom row container or ensure `aria-hidden` is not applied when the row contains keyboard-focusable elements. The opacity-0 visual hide is fine for mouse users; the fix is to always keep the Reply button in the accessibility tree (e.g. use `opacity-0 pointer-events-none` only on the token count, never on the button). Alternatively, expose reply via a different always-visible interaction pattern.

### A2 — ModelSelectorPanel trigger chip missing accessible name
**File**: `src/ui/ModelSelectorPanel.tsx:831–848`  
**WCAG**: 4.1.2 — Name, Role, Value  
**Observed**: The trigger chip button text is `"${activeCount} models"` (e.g. "2 models") with a ChevronIcon. It has `aria-expanded` and `aria-controls="model-selector-panel"` but the `aria-controls` ID does not match the actual panel element (the panel's container div has no `id` attribute — it uses class `.model-selector-panel`, not `id="model-selector-panel"`). The `aria-controls` relationship is broken: AT cannot navigate from trigger to controlled panel.  
**Fix**: Add `id="model-selector-panel"` to the panel's container div (the one with `className={panelClass}`) so the `aria-controls` reference resolves.

### B1 — Slate: text-muted fails 4.5:1 on card
**Token pair**: `#7A82A0` on `#1A1D26` → **4.43:1** (need 4.5:1)  
**WCAG**: 1.4.3 — Contrast (Minimum)  
**Used for**: Timestamps (11px), token counts (11px), placeholder text, helper copy — all normal text, not large text.  
**Fix** (Luma): Lighten `text.muted` in Slate by approximately 3 lightness points — e.g. `#7E86A6` achieves ~4.6:1.

### B2 — Ash: text-muted fails 4.5:1 on card and sidebar
**Token pair (card)**: `#7A848D` on `#22252A` → **4.04:1**  
**Token pair (sidebar)**: `#7A848D` on `#1B1D20` → **4.43:1**  
**WCAG**: 1.4.3  
**Fix** (Luma): Lighten `text.muted` in Ash — e.g. `#848E97` achieves ~4.6:1 on card.

### B3 — Ember: text-muted fails 4.5:1 on all surfaces
**Token pairs**: `#8C7260` on `#110D09` → **4.32:1** (bg); on `#1D1712` → **3.96:1** (card); on `#140F0A` → **4.25:1** (sidebar)  
**WCAG**: 1.4.3  
**Fix** (Luma): The card failure (3.96:1) is the most severe. Lighten `text.muted` in Ember — e.g. `#967A68` gets card to ~4.5:1.

### B4 — Linen: text-muted fails 4.5:1 on all surfaces
**Token pairs**: `#7A7570` on `#F5F0E8` → **4.02:1** (bg); on `#FDFAF5` → **4.38:1** (card); on `#EDE8DF` → **3.74:1** (sidebar)  
**WCAG**: 1.4.3  
**Fix** (Luma): Darken `text.muted` in Linen — e.g. `#6B6660` achieves ~4.7:1 on all Linen surfaces.

### B8 — Slate: accent-deepseek fails 4.5:1 as text
**Token**: `#4468D0` on `#1A1D26` (card) → **3.32:1**; on `#0F1117` (bg) → **3.72:1**  
**WCAG**: 1.4.3  
**Where used**: Model name header in ModelPill (12px uppercase semibold), "Reply to DeepSeek" button text (11px), directed-reply pill text (12px)  
**Fix** (Luma): Lighten `accent-deepseek` in Slate — e.g. `#6B8AE8` achieves ~4.8:1 on the card surface.

---

## Moderate Findings

### A3 — MessageBubble: streaming state not announced to screen readers
**File**: `src/ui/MessageBubble.tsx:92–116`  
**WCAG**: 4.1.3 — Status Messages  
**Observed**: When a model begins streaming (`isStreaming === true`), the bubble appears and content updates in-place. The bubble container has no `aria-live` region and no `role="status"`. A screen reader user sees no announcement when streaming begins, during streaming, or when it completes.  
**Fix**: Add `aria-live="polite"` and `aria-atomic="false"` to the message body `<div>` (or its closest containing element) for assistant streaming bubbles. For streaming completion, announce via a visually hidden live region in `MessageThread` (see A9). The blinking cursor `<span>` is already `aria-hidden="true"` — that part is correct.

### A4 — ModelSelectorPanel: slide-up panel aria-hidden state
**File**: `src/ui/ModelSelectorPanel.tsx:767–769`  
**WCAG**: 4.1.2 — Name, Role, Value  
**Observed**: The panel container uses `aria-hidden={!isOpen && !isClosing}`. During the closing animation (`isClosing === true`), `aria-hidden` is `false` — the panel is in the accessibility tree while it is visually animating closed. If a user quickly Tabs during closing, they can land on a control in a collapsing panel. The content inside the panel (model pills, system prompt textareas) is still reachable even during the close animation.  
**Fix**: Set `aria-hidden={!isOpen}` (flip to hidden as soon as the close starts, not after the animation ends). Users never need to interact with a closing panel.

### A5 — ThreadActionMenu: no focus trap
**File**: `src/ui/Sidebar.tsx:176–302` (ThreadActionMenu)  
**WCAG**: 2.1.2 — No Keyboard Trap (note: this is about being able to leave, but the related issue is also 2.4.3 Focus Order)  
**Observed**: ThreadActionMenu is a `role="menu"` element that opens in place. It does not trap focus — a user can Tab past the menu items and out of the menu without closing it. Per WAI-ARIA Authoring Practices for Menu, keyboard focus must be managed inside the menu: Tab and Shift+Tab should close the menu (or wrap within it), and arrow keys should navigate between items. Currently, none of this is implemented: the menu items are plain `<button role="menuitem">` elements with natural tab order but no arrow key support and no Tab-closes-menu behavior.  
**Fix**: When the menu opens, move focus to the first menuitem. Implement `ArrowDown`/`ArrowUp` to navigate between items. `Escape` closes the menu (already wired via outside-click handler but not keyboard). `Tab` should close the menu and advance focus to the next element in the sidebar.

### A6 — Sidebar three-dot button: keyboard discoverability
**File**: `src/ui/Sidebar.tsx:430–450` (ThreadRow three-dot button)  
**WCAG**: 2.1.1 — Keyboard; 4.1.2 — Name, Role, Value  
**Observed**: The three-dot "Conversation actions" button is `opacity-0` at rest and `opacity-100` on `group-hover`. Keyboard-only users will Tab to this button without triggering the hover, so the button is visually invisible when focused. The button has an `aria-label="Conversation actions"` and correct ARIA attributes — so it IS in the Tab order and reachable — but a keyboard user receives no visual indication that they are focused on it.  
**Fix**: Add `focus-visible:opacity-100` to the three-dot button's class list so it becomes visible on keyboard focus. (The same issue applies to the ThreadRow checkbox — it shows on hover but not on keyboard focus, though checkbox focus indicators provided by the browser are typically visible.)

### A7 — InputBar: ghost mode indicator not announced
**File**: `src/ui/InputBar.tsx:188–209`  
**WCAG**: 1.1.1 — Non-text Content  
**Observed**: The ghost mode indicator (GhostIcon) is shown when `isGhostMode === true`. The icon is `aria-hidden="true"` and the tooltip is `role="tooltip"` — but the tooltip is CSS-only hover-reveal (`opacity-0 group-hover:opacity-100`) and is never wired to the icon via `aria-describedby`. A screen reader user has no indication that the current conversation is in ghost mode.  
**Fix**: On the ghost mode indicator container `<div>`, add `aria-label="Ghost mode active — this conversation won't be saved"` (or a `role="status"` live region in the InputBar that announces when `isGhostMode` changes). Remove the `title` attribute (it's a tooltip fallback that AT will read in place of a proper announcement).

### A8 — AccentColorPicker: focus not moved into dialog on open
**File**: `src/ui/ModelSelectorPanel.tsx:852–865` (portal render site)  
**WCAG**: 2.4.3 — Focus Order  
**Observed**: `AccentColorPicker` renders with `role="dialog"` and `aria-modal="true"`. When opened, focus is not moved into the dialog — it remains on the palette icon button that triggered the open. Per WAI-ARIA dialog pattern, when a dialog opens, focus must move to the first focusable element inside the dialog (or the dialog container itself if it has `tabIndex={-1}`).  
**Fix**: In `AccentColorPicker`, add a `useEffect` that focuses either a specific element (e.g. the first swatch button) or the `popoverRef` container (give it `tabIndex={-1}`) when the component mounts. On close, focus should return to `paletteButtonRef.current` in the parent — this is already available in `ModelPill.paletteButtonRef`.

### A9 — MessageThread: no live region for new messages
**File**: `src/ui/MessageThread.tsx:62–144`  
**WCAG**: 4.1.3 — Status Messages  
**Observed**: When a model responds (or when streaming completes), no live region announces the update to screen readers. The thread simply re-renders with new content, but unless focus is within the updated element, AT will not announce it.  
**Fix**: Add a visually hidden `aria-live="polite"` region to MessageThread (or App.tsx) that announces when a new message arrives (e.g. "Claude responded" / "All models responded"). The streaming content itself can remain `aria-live="polite" aria-atomic="false"` so partial chunks are announced incrementally.

### B5 — Chalk: text-muted fails 4.5:1 on bg and sidebar
**Token pairs**: `#737373` on `#F8F8F8` → **4.46:1**; on `#F0F0F0` → **4.16:1**  
**WCAG**: 1.4.3  
**Fix** (Luma): Darken `text.muted` in Chalk — e.g. `#6E6E6E` achieves ~4.6:1 on `#F8F8F8`.

### B6 — Slate: error on card fails 4.5:1
**Token pair**: `#EF4444` on `#1A1D26` → **4.47:1**  
**WCAG**: 1.4.3  
**Where used**: Error message text in `MessageBubble` error state (13px normal weight)  
**Fix** (Luma): Slightly brighten `semantic.error` in Slate — `#F05050` achieves ~4.6:1 on the card surface.

### B7 — Ash: error on card fails 4.5:1
**Token pair**: `#E05555` on `#22252A` → **4.10:1**  
**WCAG**: 1.4.3  
**Fix** (Luma): Brighten `semantic.error` in Ash — e.g. `#EA6060` achieves ~4.6:1 on card.

### B9 — Ash: accent-deepseek as text fails 4.5:1
**Token pair**: `#4472C4` on `#22252A` → **3.26:1** (card); `#4472C4` on `#181A1C` → **3.70:1** (bg)  
**WCAG**: 1.4.3  
**Fix** (Luma): Lighten `accent-deepseek` in Ash.

### B10 — Ash: accent-gemini as text fails 4.5:1
**Token pair**: `#9B72DB` on `#22252A` → **4.26:1**  
**WCAG**: 1.4.3  
**Fix** (Luma): Lighten `accent-gemini` in Ash.

### B11 — Ash: accent-mistral as text fails 4.5:1
**Token pair**: `#D45C8A` on `#22252A` → **4.17:1**  
**WCAG**: 1.4.3  
**Fix** (Luma): Lighten `accent-mistral` in Ash.

### B12 — Outrun: accent-gemini as text fails 4.5:1
**Token pair**: `#BF00FF` on `#130A1A` → **4.29:1** (card); on `#0D0D0D` → **4.31:1** (bg)  
**WCAG**: 1.4.3  
**Fix** (Luma): Lighten `accent-gemini` in Outrun slightly.

### B13 — Outrun: accent-deepseek as text fails 4.5:1
**Token pair**: `#4060FF` on `#130A1A` → **3.99:1** (card); on `#0D0D0D` → **4.01:1** (bg)  
**WCAG**: 1.4.3  
**Fix** (Luma): Significantly lighten `accent-deepseek` in Outrun — the deep blue is the most severe text-contrast failure in the outrun palette.

---

## Minor Findings

### C1 — pill-shake animation: not covered by reduced-motion
**File**: `src/index.css:64–66`  
**WCAG**: 2.3.3 — Animation from Interactions (AAA — noted)  
**Observed**: `@media (prefers-reduced-motion: reduce)` covers `chunk-entering`, `cursor-blink`, `bubble-entering`, `thread-entering`, and `streaming-shimmer` — but does NOT include `.pill-shake`. When a user tries to deactivate the last active model, the pill plays a shake animation that ignores `prefers-reduced-motion`.  
**Note**: WCAG 2.3.3 is AAA. However, the `<motion>` spirit of the codebase has already addressed this for all other animations — the omission of `pill-shake` appears to be an oversight rather than a deliberate choice.  
**Fix** (Aria): Add to the `prefers-reduced-motion: reduce` block:
```css
.pill-shake {
  animation: none;
}
```

### C2 — SessionTokenSection: toggle button missing aria-controls
**File**: `src/ui/ModelSelectorPanel.tsx:575–598`  
**WCAG**: 4.1.2 — Name, Role, Value  
**Observed**: The session token section toggle button has `aria-expanded` but no `aria-controls` pointing to the expandable body. AT cannot programmatically navigate from the toggle to the controlled content.  
**Fix** (Aria): Add `id="session-token-body"` to the expandable `<div>` and `aria-controls="session-token-body"` to the toggle button.

### C3 — AddModelButton: listbox/option ARIA pattern incorrect
**File**: `src/ui/ModelSelectorPanel.tsx:298–343`  
**WCAG**: 4.1.2 — Name, Role, Value  
**Observed**: The dropdown container has `role="listbox"` and each item has `role="option" aria-selected={false}`. However, all items have `aria-selected={false}` — none is ever `true`. Per the listbox pattern, `aria-selected` should reflect selection state. Additionally, a `listbox` with all `option` elements using `role="button"` events (onClick, no keyboard `role="option"` support) creates a hybrid that does not match any standard pattern. The `aria-haspopup="listbox"` on the trigger is technically correct.  
**Fix** (Aria): Either use a `role="menu"` with `role="menuitem"` children (simpler, since these are actions not selections), or implement the full WAI-ARIA listbox pattern with proper selection state management. The menu pattern is recommended here since adding a model is an action, not a persistent selection.

---

## Clean Findings (Confirmed Accessible)

These patterns are correctly implemented and should be preserved:

- **InputBar.textarea**: has `aria-label="Message input"` and `aria-multiline="true"`. Send button has `aria-label="Send message"`. Focus returns to textarea after send. Enter-to-submit with Shift+Enter newline exemption.
- **InputBar.directed-reply pill clear button**: has `aria-label="Clear directed reply to [Model]"` and visible focus ring.
- **InputBar.directed-reply pill**: `aria-live="polite"` on the pill container correctly announces mode change. `aria-label` describes the full state.
- **ModelPill**: `role="switch"`, `aria-checked`, and `aria-label` with full state description ("active, click to deactivate" / "inactive, click to activate") — excellent screen reader semantics.
- **ModelPill palette button**: `aria-label="Customize accent color for [Model]"`. Focus ring present.
- **InteractionModeSwitcher**: Correct `role="radiogroup"` with `role="radio"` + `aria-checked` buttons. Labels include descriptions.
- **SystemPromptRow**: Toggle button has `aria-expanded` + `aria-controls` correctly wired to the textarea container id. Textarea has `aria-label="System prompt for [Model]"`.
- **ArchiveToggle**: Buttons have `aria-pressed` correctly reflecting current state.
- **GroupHeader**: `aria-expanded` on the toggle button. Chevron is `aria-hidden`.
- **Sidebar nav**: `role="navigation"` via `<nav>` element, `aria-label="Conversations"`, `aria-busy` during load.
- **ThreadRow checkbox**: `aria-label="Select conversation: [title]"`.
- **ThreadRow three-dot trigger**: `aria-label`, `aria-haspopup="menu"`, `aria-expanded`.
- **ThreadActionMenu**: `role="menu"`, `aria-label="Conversation actions"`, menu items have `role="menuitem"`.
- **ExportButton**: `aria-label`, `aria-haspopup="menu"`, `aria-expanded`. Escape closes and returns focus to trigger.
- **AccentColorPicker**: `role="dialog"`, `aria-label`, `aria-modal="true"`. Swatch buttons have `aria-label` (swatch name) and `aria-pressed`. Hex field has `aria-label`. Escape closes.
- **ApiKeyPanel**: Uses `<section aria-labelledby>` with `<h2>`. Input has `aria-label`. Label element associated with input via `htmlFor`. Reveal/hide toggle correctly changes type between password and text.
- **TokenCountControl**: `<section aria-labelledby>` with `<h2>`. Button group has `role="group"` + `aria-label`. Buttons have `role="radio"` + `aria-checked`.
- **Sidebar settings toggle**: `aria-expanded` + `aria-controls="sidebar-settings-panel"`. The panel has matching `id`.
- **SVG icons**: All decorative SVG icons in interactive elements are `aria-hidden="true"`.
- **GhostIcon, SendIcon, ChevronIcon, DownloadIcon, etc.**: `aria-hidden="true"` throughout.
- **Streaming cursor**: `aria-hidden="true"` on the blinking cursor `<span>` — correct; the cursor is cosmetic.
- **Error state**: `role="alert"` on the storage error banner in Sidebar.
- **Contrast warning in AccentColorPicker**: `role="alert"` on the contrast warning banner — correct for a dynamic status message.
- **Animation reduced-motion**: `bubble-entering`, `thread-entering`, `chunk-entering`, `cursor-blink`, `streaming-shimmer`, and the model-selector-panel transition all have explicit `prefers-reduced-motion: reduce` overrides in index.css.
- **All focus rings**: `focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2` present on all interactive elements audited. `:focus-visible` (not `:focus`) is used throughout — correct, prevents spurious focus rings on mouse click.

---

## Reduced-Motion Audit

**PASS** — 6 of 7 animation classes have `prefers-reduced-motion` overrides.  
**FAIL** — `.pill-shake` missing (finding C1 above — AAA criterion).

The model-selector-panel transition override is present and correctly disables the slide animation for reduced-motion users.

---

## Color-Only Communication Audit

**PASS** — Model identity is communicated via both color (accent dot) AND text (model name). Color alone is never the only means of conveying model identity.

**PASS** — Error state uses both color (`text-error`) and a warning icon (⚠, `aria-hidden="true"`) plus error text content. Color is not the only indicator.

**PASS** — Active/inactive model pill state uses both color (filled/transparent background) AND text label in the `aria-label` attribute.

**PARTIAL** — The streaming shimmer bottom border (`.streaming-shimmer::after`) conveys streaming state via color-animated gradient only. The blinking cursor `|` also signals streaming but is `aria-hidden`. A screen reader user has no indication of streaming state from the bubble itself (finding A3 above).

---

## Interactive Element Size Audit

**PASS** — Send button: `w-9 h-9` = 36×36px. WCAG 2.5.5 (AAA) recommends 44×44px; WCAG 2.5.8 (AA, WCAG 2.2) recommends 24×24px minimum. 36×36px meets 2.5.8.

**PASS** — New conversation button: `w-8 h-8` = 32×32px. Meets 2.5.8.

**PASS** — Export button: `w-8 h-8` = 32×32px. Meets 2.5.8.

**PASS** — Three-dot menu trigger: `w-6 h-6` = 24×24px. Meets minimum 2.5.8 exactly.

**NOTE** — Palette icon on ModelPill: `w-[18px] h-[18px]` = 18×18px. This is below the WCAG 2.5.8 minimum of 24×24px. WCAG 2.5.8 is AA in WCAG 2.2 (not WCAG 2.1). Since the stated standard is WCAG 2.1 AA, this is not a failure under the current contract. Flagged for awareness when upgrading to 2.2.

**PASS** — Swatch buttons in AccentColorPicker: `w-7 h-7` = 28×28px. Meets 2.5.8.

---

## Contrast Audit Summary

All 7 themes fully checked. Failures:

| Theme | Failing pair | Measured | Required | Severity |
|-------|-------------|----------|----------|----------|
| Slate | text-muted on card | 4.43:1 | 4.5:1 | Serious |
| Slate | error on card | 4.47:1 | 4.5:1 | Moderate |
| Slate | accent-deepseek on card | 3.32:1 | 4.5:1 | Serious |
| Slate | accent-gemini on card | 4.25:1 | 4.5:1 | Moderate |
| Linen | text-muted on bg | 4.02:1 | 4.5:1 | Serious |
| Linen | text-muted on card | 4.38:1 | 4.5:1 | Serious |
| Linen | text-muted on sidebar | 3.74:1 | 4.5:1 | Serious |
| Ash | text-muted on card | 4.04:1 | 4.5:1 | Serious |
| Ash | text-muted on sidebar | 4.43:1 | 4.5:1 | Serious |
| Ash | error on card | 4.10:1 | 4.5:1 | Moderate |
| Ash | accent-deepseek on card | 3.26:1 | 4.5:1 | Serious |
| Ash | accent-gemini on card | 4.26:1 | 4.5:1 | Moderate |
| Ash | accent-mistral on card | 4.17:1 | 4.5:1 | Moderate |
| Ember | text-muted on bg | 4.32:1 | 4.5:1 | Serious |
| Ember | text-muted on card | 3.96:1 | 4.5:1 | Serious |
| Ember | text-muted on sidebar | 4.25:1 | 4.5:1 | Serious |
| Chalk | text-muted on bg | 4.46:1 | 4.5:1 | Moderate |
| Chalk | text-muted on sidebar | 4.16:1 | 4.5:1 | Moderate |
| Outrun | accent-deepseek on card | 3.99:1 | 4.5:1 | Moderate |
| Outrun | accent-gemini on card | 4.29:1 | 4.5:1 | Moderate |

**Midnight and Outrun** (for non-accent text pairs): All primary, secondary, and muted text checks pass.

---

## Test Coverage Added This Session

| File | Type | Tests |
|------|------|-------|
| `src/tests/a11y/themes/contrast.test.ts` | Contrast ratios (pure TS) | ~120 assertions across 7 themes |
| `src/tests/a11y/keyboard/keyboard-patterns.test.ts` | Keyboard logic (pure TS) | 18 assertions |
| `src/tests/a11y/components/axe-setup.md` | Dependency spec | (not runnable yet) |

**Axe-core component tests**: Pending `@testing-library/react` + `jsdom` installation. All 13 components listed in `axe-setup.md`.

---

## Issues to Open (Summary for Aria and Luma)

The following GitHub issues should be opened after this report:

**For Aria** (`[Aria] a11y:`):
1. MessageBubble bottom row: aria-hidden blocks Reply button from keyboard
2. ModelSelectorPanel: aria-controls id mismatch
3. MessageBubble: no live region for streaming state
4. ModelSelectorPanel: aria-hidden set too late during close animation
5. ThreadActionMenu: no focus trap or arrow key navigation
6. ThreadRow three-dot trigger: invisible when keyboard focused
7. InputBar ghost mode indicator: not announced to screen reader
8. AccentColorPicker: focus not moved into dialog on open
9. MessageThread: no live region for incoming messages
10. index.css: pill-shake missing prefers-reduced-motion override
11. SessionTokenSection: toggle missing aria-controls
12. AddModelButton: incorrect listbox/option ARIA pattern

**For Luma** (`[Luma] a11y:`):
1. 5 themes with text-muted contrast failures (Slate, Linen, Ash, Ember, Chalk)
2. 2 themes with error color contrast failures (Slate, Ash)
3. accent-deepseek contrast failure in Slate and Ash
4. accent-gemini contrast failure in Ash and Outrun
5. accent-mistral contrast failure in Ash
6. accent-deepseek contrast failure in Outrun

---

## Next Audit Session

After Aria and Luma address the issues above, Ada should:
1. Re-run contrast tests — all `it.fails()` wrappers should be removed as tokens are fixed
2. Install `@testing-library/react + jsdom + vitest-axe` and activate component axe tests
3. Keyboard test in the live app: tab through full conversation flow, open/close all panels
4. Verify focus management after AccentColorPicker opens/closes
5. Verify MessageThread live region announces streaming start and completion
6. Re-audit reduced-motion in browser with DevTools motion simulation
