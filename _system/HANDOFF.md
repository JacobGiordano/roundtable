Last updated: 2026-06-16 (ship #126 #133 #195)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated a 3-issue parallel wave — all shipped:

- #195 (Luma): `_design/BRIEF.md` Layout Constants updated — sidebar is 280px default
  (`SIDEBAR_WIDTH_DEFAULT`), drag-resizable, and `--sidebar-width` on `:root` is the
  runtime source of truth (set by `Sidebar.tsx` on mount and resize).

- #133 (Atlas): SSE loop logic extracted from `claude.ts`, `gemini.ts`, `generic.ts`,
  and `BaseOpenAIProvider.ts` into `/src/models/openai-sse.ts`. Exports:
  `parseSSEStream`, `mapHttpStatusToErrorCode`, `buildModelError`. Pure extract —
  no behaviour change. ~800 lines → ~114 lines of shared code.

- #126 (Aria): Ghost mode fully wired. `App.tsx` now calls `useGhostMode()` and
  reads `isGlobalGhostMode` for the toggle's visual state. Ghost toggle button added
  to sidebar header (mobile and desktop). `handleNewConversation` skips
  `createConversation` when ghost mode is on. `handleSend` and stream completion path
  route to `saveGhostConversation` instead of `store.updateConversation` for ghost
  convs. Post-merge Coda fix: button was wired to `isGhost` (per-conversation) instead
  of `isGlobalGhostMode` (global); corrected before ship.

## Key decisions

- Ghost mode toggle reflects `isGlobalGhostMode`, not per-conversation `isGhost`.
  The toggle controls whether *new* conversations are ghost — it does not report the
  current conversation's status.
- Ghost toggle is in the outer sidebar header `<div>` (no responsive-hide class) —
  visible on mobile and desktop alike.
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth (set by
  Sidebar.tsx useEffect). Any component needing sidebar width reads
  `var(--sidebar-width, 280px)` — never hardcode.
- `openai-sse.ts` in `/src/models/` is the canonical SSE helper for all OpenAI-
  compatible providers. New providers must import from it, not reimplement.
- Advisory #196 filed: ghost toggle `aria-label` embeds state text alongside
  `aria-pressed` — double announcement. Deferred.

## Open issues

~49 remaining in audit backlog.

## What's next

Next highest-priority bugs:
- #128 (Ada/Aria) — Skip-to-main-content link absent (WCAG 2.4.1 failure)
- #129 (Ada/Aria) — BulkActionBar confirm-delete has no focus management (WCAG 2.4.3)
- #130 (Forge/Bastion) — 63 backend tests never run in CI
- #131 (Atlas/Aria) — Auto-chain and Manual interaction modes are silent no-ops
- #132 (Aria) — Markdown rendering absent in message bubbles

Good next wave: #128 + #129 (Ada/Aria a11y pair) + #130 (Forge/Bastion CI) —
three owners, no shared type changes, no file conflicts.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
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
