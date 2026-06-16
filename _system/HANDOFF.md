Last updated: 2026-06-16 (ship #127 #141 #139 #135)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated Waves 1–4 of the audit backlog — all shipped:

**Wave 4 (bugs):**
- #141 (Aria): `formatRelativeTime` in Sidebar.tsx — added `if (diffMs < 60_000) return '< 1m'`
  before the `diffMinutes` branch. One line fix.
- #139 (Scout): 7 ThreadActionMenu/BulkActionBar tests were skipped on a false premise
  (@testing-library/react IS in devDeps). Scout created
  `/src/tests/integration/sidebar-state-machines.test.tsx` with all 7 behaviors implemented
  via public `<Sidebar>` rendering + fireEvent. 785 tests now pass.
  Note: `test.skip` stubs in `/src/ui/Sidebar.management.test.ts` still have false comment
  — Aria should clean them up in a future session (cosmetic only).
- #135 (Gate): `useCredentials` and `ApiKeyPanel` hardcoded `['anthropic', 'openai']`.
  Both now derive from `Object.keys(CREDENTIAL_LABELS)` — single source of truth in
  credentials.ts. Adding a 7th provider requires only one entry there.

**Also shipped this session (Waves 1–3 + bonus):**
#127, #168, #153, #185, #163, #157, #194, #155, #161, #173 — see git log.

## Key decisions

- Ghost guard at UI boundary (App.tsx) + storage layer = defense in depth.
- MAX_TOKENS named per-provider in constants.ts — prevents copy-paste drift.
- `BaseOpenAIProvider` abstract class — GPT/Grok/DeepSeek/Mistral extend it.
- Export serializers extracted to `/src/storage/exporters.ts` — any StorageProvider can use them.
- `pinnedToBottom` is a ref in MessageThread (no re-renders on scroll).
- `CREDENTIAL_LABELS` in credentials.ts is canonical for all built-in provider keys.
- Scout uses fireEvent not userEvent — avoids vi.useFakeTimers deadlock (HANDOFF gotcha).

## Open issues

~56 remaining in audit backlog (#126–#194, minus the 13 closed this session).

## What's next

Remaining bugs (highest priority):
- #126 (Aria/Vault) — Ghost mode toggle wired but unreachable in UI
- #128 (Ada/Aria) — Skip-to-main-content link absent (WCAG 2.4.1 failure)
- #129 (Ada/Aria) — BulkActionBar confirm-delete has no focus management (WCAG 2.4.3)
- #130 (Forge/Bastion) — 63 backend tests never run in CI
- #131 (Atlas/Aria) — Auto-chain and Manual interaction modes are silent no-ops
- #133 (Atlas) — SSE parser still duplicated in claude.ts + gemini.ts (post-#173)
- #134 (Spark) — Streaming shimmer wrong color for 4 providers
- #137 (Luma) — Token schema missing grok/deepseek/mistral accent entries
- #138 (Aria) — ProviderSettingsPanel width hardcoded, overlaps narrow sidebar
- #143 (Arch) — SendMessageFn public contract narrower than implementation

Good next wave: Aria #138 + Luma #137 + Arch #143 (no shared type changes, different owners).

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
- GPU compositing layers: remove `animation` class entirely to eliminate GPU layers (fixed #125)
- E2E CI: playwright.config.ts uses `reporter: 'list'` — HTML report artifact won't exist on failure
- git am drops binary files silently in worktrees — use cherry-pick from /workspace for Wave ships
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background. Never `bg-error text-white`.
- Sidebar.management.test.ts has 7 test.skip stubs with false comment — real coverage in sidebar-state-machines.test.tsx (#139)
