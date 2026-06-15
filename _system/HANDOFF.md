Last updated: 2026-06-15 (ship #124)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- #124 (Vault): auto-select most recent non-archived conversation on boot
  - Root cause: `activeConversationId` started as `null` and was never auto-set after `listConversations()` resolved; mode switcher silently no-opped on all clicks
  - Fix: functional-updater `setActiveConversationId` in the initial load effect; skips archived, no-ops on empty list, preserves any pre-set value
  - 7 new tests in `useConversationStore.test.ts`; 778 passing, lint + build clean

## Key decisions

- `semantic.error` and `semantic.error-bg` are intentionally split. `semantic.error` is a bright foreground text color; `semantic.error-bg` is the dark-red variant for button backgrounds with white text. NEVER use `bg-error text-white` — use `bg-error-bg text-white` for destructive buttons.
- Co-located unit tests in domain directories (`/src/storage/*.test.ts`) are established practice and consistent with the existing `LocalStorageProvider.test.ts` / `ServerStorageProvider.test.ts` pattern.

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
