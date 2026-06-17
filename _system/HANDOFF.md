Last updated: 2026-06-17 (ship #205 #207 #208 #209 #210 #211 #212 #187 #188; close #183 #184 #206)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Coda coordinated three parallel tracks — all shipped (Flint PASS, 857 tests green):

- #205 + #210 + #211 + #212 (Aria): Full focus ring sweep across Sidebar, InputBar, InteractionModeSwitcher, ModelSelectorPanel. 600ms tooltip hover delay on InputBar ghost tooltip and InteractionModeSwitcher ModeButton. Keyboard focus shows immediately (0ms) per tooltip spec. Ada audit: PASS WITH ADVISORIES (3 advisories filed as #216, #217, comment on #199).

- #207 + #208 + #209 (Scout): 20 new integration tests in `src/tests/integration/app-handler-paths.test.tsx` — handleToggleGhostMode (6), handleRosterChange (6), handleSend directed reply / pendingTargetModelId (8).

- #187 + #188 (Bastion): Backend fixtures extracted to `backend/tests/helpers/fixtures.ts`; 3 route test files updated. 16 new tests in `backend/tests/integration/seed-admin-user.test.ts`.

Also shipped this session (pending from prior session):
- #183 (Arch): ConversationContext type narrowing — closed.
- #184 (Arch): AppError base type + source: 'model' sweep — closed.
- #206 (Arch): CustomThemeJSON prose field — was already closed.

## Key decisions

- Ghost mode tooltip keyboard pattern (InputBar.tsx): `tabIndex={0}` wrapper div, `aria-label`, immediate `onFocus` show, 600ms hover-only delay. This is now the canonical pattern for non-button tooltip anchors.
- Bastion agent committed to main workspace instead of worktree — caught at merge time, all work correctly attributed.
- Ada ran twice (first run got stuck without writing report); second run confirmed all 3 blockers fixed.

## Open advisories (not yet addressed)

- #216 (Aria/Ada) — ThreadActionMenu group-name input uses `focus:outline-none` instead of `focus-visible:`
- #217 (Aria/Ada) — ModelSelectorPanel system-prompt textarea and version select missing `focus-visible:ring-*`
- #199 (Aria, deferred) — Coming-soon spans: radiogroup ownership + keyboard discoverability (updated with Ada comment)
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
- #176 (Vault) — Schema versioning on stored Conversation objects
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps has 30 props)
- #172 (Gate) — credentialKey status not exposed for custom providers
- #171 (Gate) — 'Test connection' for API keys
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #167 (Aria) — Theme picker visual preview swatches
- #166 (Aria) — Keyboard shortcut Cmd+N for new conversation
- #165 (Aria) — Per-model visibility toggle
- #164 (Aria) — Conversation rename
- #162 (Aria) — Message editing
- #182 (Forge) — Release workflow
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #188 (Bastion) — CLOSED this session

## What's next

Good next wave options (pick 2-3 parallel tracks):
- Aria: #216 + #217 (quick focus:→focus-visible: fixes; batch with Ada audit)
- Aria: #166 (Cmd+N shortcut) or #167 (theme picker swatches) — user-visible features
- Gate: #171 (test connection) or #172 (credentialKey status)
- Vault: #176 (schema versioning) — architectural, no UI
- Forge: #182 (release workflow)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- Worktree agents sometimes commit to main workspace instead of isolated worktree — verify branch stats before merging; check `git -C /workspace worktree list` and `git -C /workspace branch --show-current` before any merge
- Bash tool CWD can drift into a worktree — always use `git -C /workspace` for git commands
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth — set by Sidebar.tsx useEffect
- Ghost mode tooltip anchor pattern: `tabIndex={0}` wrapper div + `aria-label` + `aria-describedby` + immediate onFocus show + 600ms hover setTimeout — see InputBar.tsx as canonical reference
- `text-link` token = `var(--prose-link)` registered in tailwind.config; CSS var set in theme.ts applyTheme()
- Coverage lcov report uploaded as CI artifact (`coverage-report`) since #203 — retention 30 days
- App.tsx handleSend calls store.updateConversation() TWICE per send+done cycle (user msg + finalized assistant msg) — correct, documented in chunk handler tests
- Ada sometimes gets stuck mid-run without writing her report — if no notification after 10+ min, re-spawn with a focused prompt (read files → write report → respond)
