Last updated: 2026-06-14 (ship #113 #114 #117 #118)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- Aria: #113 — context menu Delete contrast fixed (`text-semantic-error` → `text-error`, all 7 themes pass 4.5:1)
- Aria: #114 — context menu z-index/hover bleed fixed (full-viewport z-30 backdrop, menu at z-40)
- Aria: #113/#114 inline blocker — focus drops to Cancel on confirm-delete open (WCAG 2.4.3, matched #115 pattern)
- Aria: #117 — backdrop opacity fade now suppresses under `prefers-reduced-motion`
- Aria: #118 — settings shortcut aria-label updated to communicate cross-panel navigation side-effect
- Ada: updated provider-settings-panel.test.tsx selectors after #118 aria-label change
- Ada: committed provider-settings-panel.test.tsx and issues-108-112.md (were untracked since prior session)

## Open issues

- #119 [Aria/Luma] — `text-white bg-error` fails WCAG AA in 5 dark themes (advisory)
- #120 [Aria/Luma] — `text-error on interactive.hover` fails WCAG AA in 4 dark themes (advisory)
- #121 [Ada] — Stale outrun surface tokens in `contrast.test.ts` (advisory)

## What's next

- #121 (Ada): quick token update in contrast.test.ts — good warm-up for the next session
- #119 + #120 (Luma + Aria): semantic error token contrast in dark themes — will need Luma to audit/adjust token values, then Aria to consume; coordinate via Arch if types change

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper — required so real model selector trigger renders (empty-roster button has same aria-controls but opens provider settings, not model selector)
- Settings drawer has focus trap (#116) — keyboard tests that open the drawer must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open — tests that interact with confirm-delete must account for this
