Last updated: 2026-06-15 (ship #119 #120 #121 #122)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- Ada: #121 — contrast.test.ts outrun tokens corrected (15/16 were stale, not just `card`)
- Luma: #119/#120 — semantic.error split into error (foreground) + error-bg (button bg)
- Arch: added `'error-bg': string` to `CustomThemeJSON.semantic` in types/index.ts
- Aria: #119/#120 — wired --semantic-error-bg in theme.ts + tailwind.config.js; bg-error → bg-error-bg on both delete buttons
- Ada: audited Aria's changes; 14 new contrast tests added (7 per issue, all 7 themes)
- Ada: fixed pre-existing isEnabled → isVisible breakage in provider-settings-panel.test.tsx
- #122 — Luma tailwind-mapping.md doc gap; already complete, closed immediately
- #123 — Scout: exclude .claude/worktrees/ from Vitest glob (filed, not started)

## Key decision

`semantic.error` and `semantic.error-bg` are intentionally split. `semantic.error` is a bright
foreground text color. `semantic.error-bg` is the dark-red variant for button backgrounds with
white text. NEVER use `bg-error text-white` — use `bg-error-bg text-white` for destructive buttons.

## Open issues

- #123 [Scout] — Exclude .claude/worktrees/ from Vitest glob (advisory, no correctness impact)

## What's next

- #123 (Scout): add exclude pattern to vitest config — small, self-contained

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run; also clears stale path references that cause loadAndTransform noise
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper — required so real model selector trigger renders (empty-roster button has same aria-controls but opens provider settings, not model selector)
- Settings drawer has focus trap (#116) — keyboard tests that open the drawer must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open — tests that interact with confirm-delete must account for this
