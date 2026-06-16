Last updated: 2026-06-16 (ship #202 #196 #198 #203 #193 #190)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated three parallel tracks — all shipped:

- #202 (Aria): `AppLayout.tsx` — unconditional `<h1 className="sr-only">Roundtable Conversation</h1>` as first child of `<main>`. Resolves WCAG 1.3.1 landmark heading gap.

- #196 (Aria): `Sidebar.tsx` — ghost toggle `aria-label` simplified to static `"Ghost mode"`; `aria-pressed` carries state. Resolves double announcement (WCAG 4.1.2 advisory).

- #198 (Aria): `InteractionModeSwitcher.tsx` — `tooltipId` per mode; `id`/`aria-describedby` wired on both disabled spans and active buttons. Tooltip no longer orphaned.

- #203 (Forge): `ci.yml` — `actions/upload-artifact@v4` after Vitest coverage step; `if: always()`, `path: coverage/`, `retention-days: 30`.

- #193 (Luma): New `/_design/specs/markdown.md` — 7 prose tokens (`code-bg`, `code-border`, `code-text`, `block-bg`, `link`, `link-hover`, `blockquote-border`) with per-theme values in all 7 theme files and schema.md updated. Unblocks Aria from removing hardcoded markdown link color.

- #190 (Luma): `BRIEF.md` — Outrun prose section annotated with live values vs. original creative intent (Option B). No silent divergences remain.

Housekeeping: filed #204 (OnboardingEmptyState h1→h2 — pre-existing advisory found by Ada).
Scout activated 9 ghost toggle tests (sidebar-ghost-toggle.test.tsx). Full suite: 809/0.

## Key decisions

- Luma chose Option B for #190 (annotate, not erase) — preserves original creative intent alongside live values.
- Slate Gemini divergence in the #190 issue was a non-issue; live value already matched BRIEF.
- #199 (radiogroup ownership) remains deferred — future-state fix for when Manual/Auto-chain modes ship.

## Open advisories (not yet addressed)

- #204 (Aria) — OnboardingEmptyState h1 should downshift to h2 (quick)
- #197 (Aria) — BulkActionBar confirm-delete focuses destructive action instead of Cancel
- #199 (Aria, deferred) — Coming-soon spans break radiogroup ownership (future-state, defer until #131 Option 1)
- #189 (Scout/Flint) — App.tsx chunk handler untested
- #192 (Luma) — No standalone tooltip spec
- #191 (Luma) — Z-index scale undocumented
- #134 (Spark) — Streaming shimmer wrong color for 4 models

## What's next

- #204 + #197 (Aria) — batch into one session, one Ada audit
- #193 follow-on (Aria) — swap hardcoded `text-text-primary underline` link color in `MessageBubble.tsx` to `text-prose-link` now that token exists
- #192 + #191 (Luma) — tooltip spec + z-index scale
- #134 (Spark) — shimmer color fix

Good next wave: Aria #204 + #197 (+ optional: MessageBubble link token swap).

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- Worktree agents sometimes commit to main workspace instead of isolated worktree — verify branch stats before merging
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
- Markdown link color = `text-text-primary underline` (interim); swap to `text-prose-link` token now that Luma #193 shipped
- Coverage lcov report uploaded as CI artifact (`coverage-report`) since #203 — retention 30 days
- OnboardingEmptyState still has `<h1>` — should be `<h2>` (#204); pre-existing, not introduced this wave
