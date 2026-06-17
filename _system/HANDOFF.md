Last updated: 2026-06-17 (ship #204 #197 #134 #192 #191 #189 + #193-fo)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Coda coordinated three parallel tracks — all shipped (Flint PASS, 837 tests green):

- #204 (Aria): `OnboardingEmptyState.tsx` — heading downshifted `<h1>` → `<h2>`. Page now has exactly one `<h1>` (sr-only in AppLayout).

- #197 (Aria): `Sidebar.tsx` `BulkActionBar` — Cancel button receives focus when confirm-delete state opens; Tab/arrows cycle between Cancel and Delete in the confirm sub-state.

- #134 (Aria): `src/index.css` — shimmer variants for Gemini, Grok, DeepSeek, Mistral; all 6 models covered; prefers-reduced-motion guards on all.

- #193-fo (Aria): `MessageBubble.tsx` — link class updated to `text-link underline underline-offset-2`; `text-link` token registered in `tailwind.config.js`, CSS variable wired in `theme.ts`.

- #192 (Luma): `/_design/specs/tooltip.md` — standalone tooltip spec (trigger delay, positioning, tokens, z-index, ARIA).

- #191 (Luma): `/_design/specs/z-index.md` — canonical 8-layer z-index scale; all existing values mapped.

- #189 (Scout): `src/tests/integration/app-chunk-handler.test.tsx` — 22 integration tests for App.tsx streaming chunk handler.

Post-ship fixes (committed to main before push):
- `<main tabIndex={-1}>` no longer shows focus ring on mouse click (`focus:ring-*` removed).
- ThreadActionMenu confirm-delete: Tab/Left/Right arrows cycle between Cancel and Delete (was closing menu).

Aria's profile updated with 3 new explicit rules: `focus-visible:` vs `focus:`, two-step token verification, confirm sub-state keyboard contracts.

## Key decisions

- #193 follow-on used `text-link` (Luma's `colors.link` token, already in tailwind.config) rather than `text-prose-link` (unregistered). Token is live; `CustomThemeJSON` still needs a `prose` field for type safety (Arch #206).
- Broad keyboard focus gap found during dev-server review → filed as #212 rather than patching inline; ships in next Aria+Ada wave.

## Open advisories (not yet addressed)

- #212 (Ada/Aria) — Full keyboard focus indicator audit — PRIORITY; `<main>` skip-link focus also covered
- #205 (Aria) — BulkActionBar confirm buttons missing `focus-visible:ring-*`
- #206 (Arch) — `CustomThemeJSON` missing `prose` field (type cast workaround in theme.ts)
- #210 (Aria) — InputBar tooltip missing 600ms hover delay
- #211 (Aria) — InteractionModeSwitcher tooltip missing 600ms hover delay
- #207/#208/#209 (Scout) — App.tsx untested handler paths (handleRosterChange, handleToggleGhostMode, directed-reply send)
- #199 (Aria, deferred) — Coming-soon spans break radiogroup ownership (defer until #131 Option 1)
- #189 (Scout/Flint) — App.tsx chunk handler untested ← CLOSED this session

## What's next

- #212 + #205 (Ada + Aria) — batch: focus indicator audit + BulkActionBar confirm rings
- #206 (Arch) — CustomThemeJSON prose field (quick types-only change)
- #210 + #211 (Aria) — tooltip hover delay fixes (can batch with #205 if small enough)

Good next wave: Aria #212 + #205 (+ #210 + #211 if capacity allows), Ada audit after.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- Worktree agents sometimes commit to main workspace instead of isolated worktree — verify branch stats before merging
- Bash tool CWD can drift into a worktree — always check `pwd` before running git commands; use `git -C /workspace` if needed
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background
- Sidebar.management.test.ts has 7 test.skip stubs with false comment — real coverage in sidebar-state-machines.test.tsx (#139)
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth — set by Sidebar.tsx useEffect
- Parallel agent worktrees share the git object store — always verify HEAD after merging worktree branches
- Ghost mode toggle visual state = `isGlobalGhostMode` (global), not `isGhost` (per-conversation)
- react-markdown re-parses on every render chunk — no debounce applied; fast enough in practice
- `text-link` token = `var(--prose-link)` registered in tailwind.config; CSS var set in theme.ts applyTheme()
- `CustomThemeJSON` has no `prose` field yet — applyTheme() uses a cast (safe at runtime, type gap only) until Arch ships #206
- Coverage lcov report uploaded as CI artifact (`coverage-report`) since #203 — retention 30 days
- App.tsx handleSend calls store.updateConversation() TWICE per send+done cycle (user msg + finalized assistant msg) — correct, documented in chunk handler tests
