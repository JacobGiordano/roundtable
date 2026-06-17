# Roundtable Z-Index Scale

All overlay layers must use a named z-index from this scale. Raw numeric values scattered across component code are prohibited — every z-index assignment traces back to a named layer here. When Aria needs to position an overlay, she looks up the layer name, not a number.

Token references use `{category.key}` notation consistent with other specs. Z-index is not a themeable token (values are structural, not visual) and is therefore not declared in theme JSON files. The values below are fixed system constants.

---

## Named Scale

| Layer name | Value | Purpose |
|------------|-------|---------|
| `z-base` | `0` | Normal document flow. No explicit z-index needed — this is the default. |
| `z-raised` | `10` | Intra-component elevation: sticky panel headers, drag handles, inline icon overlays that must clear sibling elements within their containing block. Does not escape a positioned ancestor. |
| `z-dropdown` | `20` | Tooltip bubbles and small informational popovers anchored to a parent element via `position: absolute`. Sits above `z-raised` so tooltips clear any raised sibling within the same component. |
| `z-backdrop-low` | `30` | Transparent or semi-transparent full-viewport backdrop used to close context menus, thread action menus, and the provider-settings scrim. Sits below the element it guards. |
| `z-overlay` | `40` | Full-panel overlays that cover the main content area but not the sidebar: provider settings panel, mobile sidebar backdrop. |
| `z-modal` | `50` | Modal-priority elements: mobile sidebar drawer, export format menu, model selector panel, color picker popover (which must clear the model selector panel). |
| `z-toast` | `70` | Toast / snackbar notifications. Must clear all interactive overlays so they are never obscured. Reserved for Phase 2 toast implementation. |
| `z-top` | `9999` | Absolute top-of-stack. Reserved for: the Outrun entry flash overlay (full-viewport, pointer-events: none), and the skip-navigation link on keyboard focus. Nothing should sit above these. |

---

## Layer Inventory

### `z-base` (0) — Normal document flow

No components assign this explicitly. It is the default stacking behavior.

---

### `z-raised` (10) — Intra-component elevation

| Component | Location | Why it needs elevation |
|-----------|----------|----------------------|
| Provider settings panel header | `ProviderSettingsPanel.tsx` — `sticky top-0` panel header | Must stay above scrolling panel content while the panel scrolls |
| Sidebar drag handle | `Sidebar.tsx` — 1px right-edge resize strip | Must remain clickable above the sidebar's overflow-hidden scroll container |
| Sidebar thread-row icon overlays | `Sidebar.tsx` — edit/delete icons positioned absolutely within a row | Must clear adjacent row elements within the sidebar container |

---

### `z-dropdown` (20) — Tooltips and anchored popovers

| Component | Location | Why it needs elevation |
|-----------|----------|----------------------|
| Interaction mode switcher tooltips | `InteractionModeSwitcher.tsx` | Positioned absolute above the mode buttons; must clear `z-raised` siblings |
| Ghost mode tooltip | `InputBar.tsx` | Positioned absolute above the ghost icon; must clear input bar content |

See `/_design/specs/tooltip.md` for the full tooltip spec, including appearance, timing, and per-theme values. All tooltips sit at `z-dropdown` (20).

**Why 20, not higher:** Tooltips are anchored to their trigger via `position: absolute` within a `position: relative` container. They do not need to escape the document's stacking context to float above unrelated content — their containing block is already on top of normal flow. The value 20 is large enough to clear any `z-raised` (10) siblings within the same parent and small enough to remain below all full-panel overlays.

---

### `z-backdrop-low` (30) — Low-priority full-viewport backdrops

| Component | Location | Purpose |
|-----------|----------|---------|
| Thread action menu backdrop | `Sidebar.tsx` — `fixed inset-0` | Intercepts pointer events behind the open thread action menu; clicking it closes the menu |
| Provider settings scrim | `AppLayout.tsx` — `fixed inset-0`, semi-transparent | Dims the conversation area while the provider settings panel is open; clicking it closes the panel |
| Sidebar drag-handle layer | `Sidebar.tsx` — `absolute right-0 top-0 h-full w-1` | Within sidebar stacking context; sits at 30 relative to sidebar children |

---

### `z-overlay` (40) — Main-content overlays

| Component | Location | Purpose |
|-----------|----------|---------|
| Mobile sidebar backdrop | `AppLayout.tsx` — `fixed inset-0 md:hidden` | Covers main content while mobile sidebar drawer is open; tapping it closes the drawer |
| Provider settings panel | `AppLayout.tsx` / `ProviderSettingsPanel.tsx` — `fixed top-0 right-0` | Full-panel settings UI; overlays conversation column, leaves sidebar visible |
| Thread action menu (the menu itself) | `Sidebar.tsx` — `absolute right-2 top-1` | The menu element, above its own backdrop at `z-backdrop-low` (30) |

**Spec note**: The provider settings panel is `z-index: 40` per `/_design/specs/provider-settings.md`. That spec predates this scale; the named equivalent is `z-overlay`. Aria should treat these as identical — `z-overlay = 40`.

---

### `z-modal` (50) — Modal-priority elements

| Component | Location | Purpose |
|-----------|----------|---------|
| Mobile sidebar drawer | `Sidebar.tsx` — `fixed inset-y-0 left-0` | Drawer sits above the mobile backdrop at `z-overlay` (40) |
| Export format menu | `ExportButton.tsx` — `absolute right-0 top-full` | Anchored dropdown that must clear all page content |
| Model selector panel | Spec: `/_design/specs/components.md` | The panel that slides above the input bar |
| Color picker popover | Spec: `/_design/specs/accent-color-customization.md` | Anchored popover above the model selector panel; must clear it |

**Note on color picker popover**: The accent-color-customization spec assigns `z-index: 60` to the color picker popover so it clears the model selector panel at `z-index: 50`. Both values fall within the `z-modal` band. Since Aria assigns these values to elements that share the same stacking context (the color picker is a child of the model selector panel DOM subtree), the relative ordering is what matters: `60 > 50`. Both are canonical and correct. Luma does not flatten these to a single value because doing so would remove the guaranteed ordering.

---

### `z-toast` (70) — Notifications

Reserved. No toast component exists in Phase 1. When Aria implements toast/snackbar notifications in Phase 2, she assigns `z-toast` (70) to the toast container. This value is documented now to prevent future layers from being assigned values between 50 and 70 that would interfere.

---

### `z-top` (9999) — Absolute top-of-stack

| Component | Location | Purpose |
|-----------|----------|---------|
| Outrun theme entry flash overlay | `AppLayout.tsx` (JS-driven) | Full-viewport `position: fixed` overlay; `pointer-events: none`; must sit above everything including the sidebar |
| Skip-navigation link (keyboard focus) | `AppLayout.tsx` — `focus:z-[9999]` | Visually-hidden link becomes visible and floats above all content on keyboard focus for accessibility |

These two usages share the value. They never appear simultaneously (the Outrun flash is momentary; the skip-nav link is only visible on keyboard focus). No collision risk.

---

## Usage Rules

1. **Use named layers, not raw numbers.** When assigning a z-index in a component, the comment should read: `/* z-overlay — see z-index.md */`, not `/* sits above the sidebar */`. The name communicates intent; the spec explains the full picture.

2. **Never invent an intermediate value.** If a new component needs to sit between two existing layers, the correct action is to update this spec with a new named layer — not to use `z-index: 45` without documentation. Intermediate values create invisible ordering dependencies that break when layers are reordered.

3. **Within a positioned ancestor, values are relative.** Elements positioned within a non-`z-auto` containing block (e.g., a component with `position: relative`) form their own stacking context. Their z-index values are relative to siblings within that context, not to the full page. `z-raised` (10) and `z-dropdown` (20) are typically used in this mode. `z-overlay` and above typically require `position: fixed` or a top-level containing block.

4. **`z-top` is a reserved ceiling.** Do not assign new components to `z-top` (9999) without explicit design system review. The skip-nav and Outrun flash are the only sanctioned uses.

---

## Cross-Reference

- Tooltip appearance, trigger behavior, and animation: `/_design/specs/tooltip.md`
- Provider settings panel overlay: `/_design/specs/provider-settings.md`
- Color picker popover ordering: `/_design/specs/accent-color-customization.md`
- Outrun flash overlay animation: `/_design/specs/motion.md`
