Last updated: 2026-06-17 (ship #216 #217 #218 #219 #220 #182 #176)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Coda coordinated three parallel tracks — all shipped (Flint PASS, 886 tests green):

- #216 + #217 + #218 + #219 + #220 (Aria): focus-visible sweep. ThreadActionMenu input (Sidebar.tsx), SystemPromptRow textarea + ModelVersionRow select (ModelSelectorPanel.tsx), InteractionModeSwitcher coming-soon spans (aria-describedby + sr-only). Ada audit: PASS. Note: #216/#218 were duplicates (same element); #217/#219 were duplicates (same two elements). Advisory #221 filed (sr-only span inside radiogroup — cosmetic, no WCAG violation).

- #182 (Forge): Release workflow added at `.github/workflows/release.yml`. Triggers on `v*.*.*` tag. Gate: lint → build + test + backend-ci → docker (GHCR) → GitHub Release. One-time setup: Settings → Actions → General → Workflow permissions → "Read and write permissions".

- #176 (Vault): Schema versioning and migration pipeline. `StoredConversation` envelope written to localStorage; `migration.ts` handles v0→1 (identity) and future versions. Bare legacy records auto-migrate on read. No-data-loss: migration failure returns null. 29 new tests.

## Key decisions

- `ring-focus` is the correct Tailwind token for focus rings in this codebase (`var(--interactive-focus)` in tailwind.config.js). `ring-ring` does NOT exist here.
- Ghost mode tooltip anchor pattern remains canonical in InputBar.tsx (from prior session).
- `StoredConversation` envelope is intentionally NOT in `/src/types/index.ts` — it is a storage-layer concern only.
- Adding a schema v2 migration: increment `CURRENT_SCHEMA_VERSION`, add `MIGRATION_STEPS[1]` in `migration.ts`.

## Open advisories (not yet addressed)

- #221 (Aria/Ada) — sr-only IMS description span is inside radiogroup; should be a sibling (cosmetic)
- #222 (Aria/Ada) — MessageThread scroll container missing focus-visible ring (discovered during visual QA this wave)
- #199 (Aria, deferred) — coming-soon spans: radiogroup ownership + keyboard discoverability
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
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
- #182 (Forge) — CLOSED this session
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit

## What's next

Good next wave options:
- Aria: #222 (scroll container ring — quick) + #221 (sr-only sibling move — trivial) batch with Ada audit
- Aria: #166 (Cmd+N) or #167 (theme picker swatches) — user-visible features
- Gate: #171 (test connection) or #172 (credentialKey status)
- Atlas: #177 (remote model catalog)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `ring-focus` = focus ring token; `ring-ring` does NOT exist in this codebase
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- Worktree agents sometimes commit to main workspace instead of isolated worktree — verify branch before merging
- Bash tool CWD can drift into a worktree — always use `git -C /workspace` for git commands
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background
- Ghost mode tooltip anchor pattern: `tabIndex={0}` wrapper div + `aria-label` + `aria-describedby` + immediate onFocus show + 600ms hover setTimeout — see InputBar.tsx
- App.tsx handleSend calls store.updateConversation() TWICE per send+done cycle — correct, documented
- Ada sometimes gets stuck mid-run — re-spawn with a focused prompt if no notification after 10+ min
- Release workflow requires one-time repo setting: Settings → Actions → General → "Read and write permissions"
- `StoredConversation` envelope in localStorage: `{ schemaVersion: 1, data: Conversation }` — bare legacy records auto-migrate on read
