Last updated: 2026-06-14 (ship #108–#112 + #115 #116)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- Aria: #108 — last-provider removal unblocked; "Last provider. Remove and start over?" confirm flow replaces dead-end "Got it"
- Aria: #109 — settings drawer capped at 704px width on desktop
- Aria: #110 — "Provider settings" shortcut added to bottom of model selector panel
- Aria: #111 — backdrop added behind settings drawer; click-outside closes it
- Aria: #112 — `mx-auto` on drawer content body equalizes left/right padding
- Aria: #115 — focus moves to Cancel when ProviderRow enters any confirm state (WCAG 2.4.3)
- Aria: #116 — focus trap + `aria-modal="true"` added to settings drawer (WCAG 2.1.2/2.4.3)
- Scout: smoke selectors updated for #107 data-testid, #110 phase4 helper disambiguation, #106 empty-roster localStorage seeding
- Arch: CLAUDE.md SOP updated — Ada audit, Scout smoke suite, and Flint gate are now required gates before every ship
- Ada: advisory issues #117 (backdrop motion-reduce) and #118 (settings shortcut nav signal) filed for future work

## Open issues

- #113 [Aria] — "Delete" option in session context menu fails WCAG AA contrast
- #114 [Aria] — Session context menu z-index and hover bleed issues
- #117 [Aria] — Backdrop missing `motion-reduce:transition-none` (advisory)
- #118 [Aria] — Settings shortcut doesn't signal cross-panel navigation (advisory)

## What's next

- Aria: #113 and #114 (session context menu bugs — contrast + z-index/hover)
- Aria: #117 and #118 can be batched with the next Aria session (advisory, non-blocking)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- E2E: last-provider removal guard is gone (#108) — removal tests no longer need a 2-provider precondition
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper — required so real model selector trigger renders (empty-roster button has same aria-controls but opens provider settings, not model selector)
- Settings drawer has focus trap (#116) — keyboard tests that open the drawer must account for Tab being intercepted
