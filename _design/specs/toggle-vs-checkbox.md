# Toggle Switch vs. Checkbox — Design Spec

**Owner:** Luma
**Date:** 2026-07-11
**Downstream:** Aria (ProviderSettingsPanel and any future live-setting controls)

---

## 1. The Semantic Rule

The choice is determined by **when the effect applies**, not visual shape.

**Use a toggle switch** (`role="switch"`) when the change takes effect immediately — no Save button, no form submission. The user is controlling a live system state. Flipping it does something right now.

**Use a checkbox** (`<input type="checkbox">`) when the control is part of a form that requires explicit submission before the value is committed, or when multiple items in a group can be independently selected.

This distinction follows established UX convention (iOS HIG, Material Design, ARIA APG): toggles carry an implicit contract of instantaneous effect. Checkboxes communicate "staging a value for later submit." Mismatching the control to the contract creates cognitive overhead.

---

## 2. ProviderSettingsPanel Ruling

**All controls in ProviderSettingsPanel — capability flags (vision, toolUse, streamUsage, systemPrompt, imageGeneration) and "No API key required" — use checkboxes. Keep native `<input type="checkbox">`.**

These controls live inside an edit form with a Save button. Values are staged until the user clicks Save. A toggle switch here would violate the semantic rule. The current `accent-[var(--accent-claude)]` styling on native checkboxes is correct and requires no change.

---

## 3. Token Reference for Future Toggle Switches

No new tokens are needed. Existing tokens cover all toggle switch needs:

| State | Token | CSS class |
|---|---|---|
| Track — on | `{interactive.active}` | `bg-active` |
| Track — off | `{borders.subtle}` | `bg-border-subtle` |
| Thumb | hardcoded `#FFFFFF` | `bg-white` |
| Focus ring | `{interactive.focusRing}` | `ring-focus` |
| Transition | `{timing.medium}` | `duration-200` |

**On-state color note:** use `{interactive.active}` (not `{semantic.success}`) for new toggles. `semantic.success` means "operation succeeded," not "setting is enabled" — using it for on-state conflates feedback color with configuration state.

**Reduced motion:** wrap the thumb transform transition in `motion-reduce:transition-none`. Track color may still transition; motion reduction applies to the sliding thumb only.
