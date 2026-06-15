Last updated: 2026-06-15 (ship #123)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- #123 (Scout): exclude `.claude/worktrees/` from Vitest glob
  - Added `'**/.claude/worktrees/**'` to the `exclude` array in `vite.config.ts`
  - Eliminates `loadAndTransform` noise from stale worktree transform cache entries
  - 778 tests passing, lint + build clean

## Key decisions

- `semantic.error` and `semantic.error-bg` are intentionally split. `semantic.error` is a bright foreground text color; `semantic.error-bg` is the dark-red variant for button backgrounds with white text. NEVER use `bg-error text-white` — use `bg-error-bg text-white` for destructive buttons.
- Co-located unit tests in domain directories (`/src/storage/*.test.ts`) are established practice and consistent with the existing `LocalStorageProvider.test.ts` / `ServerStorageProvider.test.ts` pattern.

## Open issues

None.

## What's next

No open issues — queue is clear. Await new issue from user.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run; also clears stale path references that cause loadAndTransform noise (fixed by #123)
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper — required so real model selector trigger renders (empty-roster button has same aria-controls but opens provider settings, not model selector)
- Settings drawer has focus trap (#116) — keyboard tests that open the drawer must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open — tests that interact with confirm-delete must account for this
