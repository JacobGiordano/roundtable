Last updated: 2026-06-14 (ship #104 #105)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Test coverage for Phase 4 complete.

## Session summary

- Scout: closed #104 — `rosterToModelConfigs` unit tests (24 tests). Added `export` to the function in `App.tsx` for testability. Covers: empty roster, built-in/custom provider mapping, `prevModels` state preservation, output ordering.
- Scout: closed #105 — Phase 4 E2E Playwright tests (11 tests). Covers: credential editor Set/Edit/Remove/Escape/save-disabled flows, keyless provider guard, roster reactivity (add+remove round-trip in model selector), layout overflow check.

## Open issues

- #106 [Aria] — Model selector trigger hidden when roster is empty; smoke tests fail. Two fix options: always render trigger (Aria), or seed localStorage in smoke beforeEach (Scout).
- #107 [Aria] — Settings button selector ambiguous; two elements match `aria-controls="sidebar-settings-panel"`. Three fix options documented in issue.

## What's next

- #106 and #107 are Aria issues (or optionally Scout selector fixes). Aria should read both issues and decide fix approach before implementing.
- Smoke test suite has 3 pre-existing failures tied to #106 and #107 — will resolve once those are closed.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- E2E: "Remove" confirmation dialog is guarded by `isLast` — removal tests need 2+ providers in the roster
