Last updated: 2026-06-16 (ship #201 #200 #186)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated two parallel tracks — both shipped:

- #201 (Aria): Markdown heading downshift in `MessageBubble.tsx`. h1→h3, h2→h4, h3→h5, h4+→h6 via custom `components` prop on `ReactMarkdown`. Visual output unchanged; semantic HTML corrected. WCAG 1.3.1 resolved.

- #200 (Aria): External links in `MessageBubble.tsx` now inject `<span className="sr-only"> (opens in new tab)</span>` via `isExternal` guard. Internal links unaffected.

- #186 (Scout/Forge): Coverage thresholds added to `vite.config.ts` (lines: 80, functions: 80, branches: 70, provider: v8, reporters: text + lcov). CI step updated to `npm run test:run -- --coverage`. `@vitest/coverage-v8@1.6.1` added to devDependencies.

Housekeeping: stale test artifacts and agent profile updates from #131/#132 wave committed.

## Key decisions

- #186 does not upload lcov as a CI artifact — text reporter satisfies the summary-step criteria. Forge can add `actions/upload-artifact` later for badge/PR comment integration (#203 filed).
- New advisory filed: #202 — AppLayout missing persistent `<h1>` in `<main>` (pre-existing, found by Ada).

## Open advisories (not yet addressed)

- #202 (Aria) — AppLayout missing h1 in main (quick)
- #198 (Aria) — InteractionModeSwitcher tooltip not wired via aria-describedby
- #199 (Aria) — Coming-soon spans break radiogroup ownership
- #196 (Aria) — Ghost toggle aria-label double announcement
- #197 (Aria) — BulkActionBar confirms-delete focuses destructive action

## What's next

- #202 + #196 (Aria) — batch into one Aria session (both small, one Ada audit)
- #134 (Spark) — Streaming shimmer wrong color for 4 models
- #193 (Luma) — Markdown token layer (text-link, code-bg, prose colors)
- #203 (Forge) — Upload lcov artifact in CI for badge/PR integration

Good next wave: batch #202 + #196 into one Aria session.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- Context menu confirm-delete state moves focus to Cancel on open
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background
- Sidebar.management.test.ts has 7 test.skip stubs with false comment — real coverage in sidebar-state-machines.test.tsx (#139)
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth — set by Sidebar.tsx useEffect
- Parallel agent worktrees share the git object store — always verify HEAD after merging worktree branches
- Ghost mode toggle visual state = `isGlobalGhostMode` (global), not `isGhost` (per-conversation)
- react-markdown re-parses on every render chunk — no debounce applied; fast enough in practice
- Markdown link color = `text-text-primary underline` (interim); swap to `text-link` token when Luma #193 ships
- Coverage lcov report written to `coverage/` dir locally but not uploaded as CI artifact yet (#203)
