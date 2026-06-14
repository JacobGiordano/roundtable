Last updated: 2026-06-14 (ship #106 #107)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Test coverage for Phase 4 complete.

## Session summary

- Aria: closed #106 — Added `aria-controls`/`aria-expanded` to empty-roster "Add providers" button in `ModelSelectorPanel.tsx`. Smoke test selector `button[aria-controls="model-selector-panel"]` now resolves unconditionally.
- Aria: closed #107 — Added `data-testid="sidebar-settings-toggle"` (Sidebar.tsx) and `data-testid="mobile-settings-toggle"` (AppLayout.tsx). Scout must update smoke test selector from `button[aria-controls="sidebar-settings-panel"]` to `[data-testid="sidebar-settings-toggle"]`.

## Open issues

- Scout follow-on for #107: update smoke test selector to `[data-testid="sidebar-settings-toggle"]` — this resolves the remaining smoke test failure.
- User has additional UX/UI bugs to file — gathering now.

## What's next

- Scout: update smoke test selector (follow-on from #107)
- Aria: UX/UI bug fixes (issues TBD — user briefing in progress)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- E2E: "Remove" confirmation dialog is guarded by `isLast` — removal tests need 2+ providers in the roster
- #107 fix: smoke test must use `[data-testid="sidebar-settings-toggle"]` not `[aria-controls="sidebar-settings-panel"]` (ARIA selector is intentionally ambiguous — two buttons, one panel)
