# Axe-core Component Tests — Dependency Gap

Ada's component-level axe tests require:
- `@testing-library/react` (jsdom rendering)
- `vitest-axe` (axe-core integration for Vitest)
- `jsdom` (JSDOM environment for Vitest)

None of these are in `devDependencies` as of the Phase 4 audit (see HANDOFF.md:
"@testing-library/react not installed"). The HANDOFF.md lists adding
`@testing-library/react + jsdom` as the top next priority.

## When dependencies are installed

Run `npm install -D @testing-library/react jsdom vitest-axe @axe-core/react`.
Then the test file `input-bar.test.tsx` (and others in this directory) will be
runnable.

The test patterns are fully specified in Ada's agent profile
(`.claude/agents/ada.md`) and the audit report
(`src/tests/a11y/audit-reports/phase4-baseline.md`).

## What axe-core tests cover (once installable)

Components requiring axe tests (one file per component):
1. `InputBar` — label, send button, ghost mode indicator, directed-reply pill
2. `MessageBubble` — role, streaming state, error state, retry button
3. `MessageThread` — list structure, empty state, scroll anchor
4. `ModelSelectorPanel` — trigger, slide-up panel, model pills (role=switch)
5. `ModelPill` — aria-checked, aria-label, palette button
6. `Sidebar` — nav landmark, thread list, settings panel, bulk actions
7. `ThreadRow` — checkbox, three-dot menu trigger, menu items
8. `ThreadActionMenu` — role=menu, menuitem roles, confirm-delete sub-state
9. `AccentColorPicker` — dialog role, swatch buttons, hex input
10. `ExportButton` — trigger button, menu role
11. `InteractionModeSwitcher` — radiogroup, radio buttons
12. `ApiKeyPanel` — section, label associations, password input
13. `TokenCountControl` — group, radio buttons
