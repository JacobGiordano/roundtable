Last updated: 2026-06-16 (ship #138 #137 #143)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated a 3-issue parallel wave — all shipped:

- #138 (Aria): `ProviderSettingsPanel` width was hardcoded to `calc(100vw - 256px)`, which was
  wrong in two ways: (1) the actual `SIDEBAR_WIDTH_DEFAULT` is 280px, not 256px; (2) it broke
  on drag-resized sidebars. Fix: Sidebar.tsx now writes `--sidebar-width` to `:root` on mount
  and every resize; ProviderSettingsPanel consumes `calc(100vw - var(--sidebar-width, 280px))`.

- #137 (Luma): Token schema (`schema.md`), tailwind-mapping spec, and `BRIEF.md` were missing
  `model-grok`, `model-deepseek`, and `model-mistral` accent entries. Theme files already had
  correct values — only the specs were stale. All three spec files updated.

- #143 (Arch): `SendMessageOptions` in `/src/types/index.ts` was narrower than Atlas's
  implementation (`conversation` and `systemPrompt` were missing from the public type). Both
  added as optional fields. All existing call sites remain valid.

## Key decisions

- `--sidebar-width` CSS variable on `:root` is set by Sidebar.tsx (single source of truth).
  Any component that needs to know the sidebar width should read this variable, not hardcode.
- Ghost guard at UI boundary (App.tsx) + storage layer = defense in depth.
- MAX_TOKENS named per-provider in constants.ts — prevents copy-paste drift.
- `BaseOpenAIProvider` abstract class — GPT/Grok/DeepSeek/Mistral extend it.
- Export serializers extracted to `/src/storage/exporters.ts` — any StorageProvider can use them.
- `pinnedToBottom` is a ref in MessageThread (no re-renders on scroll).
- `CREDENTIAL_LABELS` in credentials.ts is canonical for all built-in provider keys.
- Scout uses fireEvent not userEvent — avoids vi.useFakeTimers deadlock.

## Open issues

~52 remaining in audit backlog.

## What's next

Advisory filed this session:
- #TBD (Luma): `/_design/BRIEF.md` Layout Constants still says "Sidebar width: 256px fixed.
  Not resizable." — wrong on both counts after #138.

Next highest-priority bugs:
- #126 (Aria/Vault) — Ghost mode toggle wired but unreachable in UI
- #128 (Ada/Aria) — Skip-to-main-content link absent (WCAG 2.4.1 failure)
- #129 (Ada/Aria) — BulkActionBar confirm-delete has no focus management (WCAG 2.4.3)
- #130 (Forge/Bastion) — 63 backend tests never run in CI
- #131 (Atlas/Aria) — Auto-chain and Manual interaction modes are silent no-ops
- #133 (Atlas) — SSE parser still duplicated in claude.ts + gemini.ts

Good next wave: #126 (Aria/Vault) + #133 (Atlas) — different owners, no shared type changes.

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
