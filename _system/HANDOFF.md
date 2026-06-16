Last updated: 2026-06-16 (ship #128 #129 #130)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated a 3-issue parallel wave — all shipped:

- #128 (Aria): Skip-to-main-content link added to `AppLayout.tsx` as the first focusable
  element in DOM. `sr-only` at rest, visible with `focus:bg-bg focus:ring-focus` on focus.
  `<main id="main-content" tabIndex={-1}>` is the target with `focus:ring-2 focus:ring-inset
  focus:ring-focus` so the user can see where focus lands after activation.

- #129 (Aria): BulkActionBar confirm-delete focus management added to `Sidebar.tsx`.
  `confirmDeleteRef` moves focus to the "Delete" confirm button on state transition.
  `deleteSelectedRef` restores focus to the trigger on cancel or confirm (both via
  `setTimeout(..., 0)` deferral to wait for DOM re-render).

- #130 (Forge + Bastion): Backend test suite wired into CI. `.github/workflows/ci.yml`
  job `backend-lint-build-test` now runs `cd backend && npm test` (maps to `vitest run`).
  `backend/package.json` gained a `test:run` alias for developer consistency.
  63/63 backend tests pass.

## Key decisions

- Skip link focus ring on `<main>` uses `focus:ring-2 focus:ring-inset focus:ring-focus`
  (not `focus:outline-none` alone) — user confirmed the outline-only approach gave no
  visible feedback on where focus landed.
- BulkActionBar focuses "Delete" confirm button (not "Cancel") — diverges from
  ThreadActionMenu convention. Filed advisory #197; not blocking.
- Advisory #196 still open: ghost toggle `aria-label` double announcement.
- `bg-bg` (not `bg-bg-surface`) is the correct Tailwind surface background token —
  Ada caught `bg-bg-surface` as unregistered during this wave's audit.

## Open issues

~48 remaining in audit backlog.

## What's next

Next highest-priority:
- #131 (Atlas/Aria) — Auto-chain and Manual interaction modes are silent no-ops
- #132 (Aria) — Markdown rendering absent in message bubbles
- #134 (Spark) — Streaming shimmer wrong color for 4 models
- #186 (Scout/Forge) — Coverage report absent in CI

Good next wave: #132 (Aria alone, significant) or #131 (Atlas + Aria, cross-agent).
#131 requires Atlas + Aria coordination — separate worktrees required.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
  (exception: backend's `npm test` maps to `vitest run` directly — documented in ci.yml)
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token (generates no CSS)
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- Context menu confirm-delete state moves focus to Cancel on open
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background. Never `bg-error text-white`.
- Sidebar.management.test.ts has 7 test.skip stubs with false comment — real coverage in sidebar-state-machines.test.tsx (#139)
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth — set by Sidebar.tsx useEffect
- Parallel agent worktrees share the git object store; branch checkouts in a worktree can affect main workspace reflog — always verify HEAD after merging worktree branches
- Ghost mode toggle visual state = `isGlobalGhostMode` (global), not `isGhost` (per-conversation) — don't confuse the two
