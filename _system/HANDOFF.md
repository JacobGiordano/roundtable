Last updated: 2026-06-16 (ship #127)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

- #127 (Aria): Replaced `bg-error` with `bg-error-bg` on 2 destructive "Remove" buttons in
  ProviderSettingsPanel.tsx (`ConfirmDeleteRow`, both normal and last-provider paths).
  `hover:bg-error/10` on the ghost button left unchanged — that's a tint, not a solid background.

Also shipped this session (Waves 1–3):

Coda coordinated Wave 3 of the audit backlog — 3-way parallel, all shipped:

- #155 (Vault): Removed redundant `_ghostIds: Set<string>` from GhostModeManager.
  7 paired operations eliminated; `isGhost()` now delegates to `this._store.has(id)`.
  Net: 10 deletions, 1 substitution, zero behavior change. 778 tests pass.
- #161 (Aria): Smart scroll in MessageThread.tsx. `pinnedToBottom` ref (no re-renders),
  passive scroll listener with 100px threshold, user-message force-pin via
  `lastUserMessageIdRef`. Sticky ↓ FAB when unpinned. Structural fix: outer wrapper
  changed from `overflow-y-auto` to `overflow-hidden` — inner div is now sole scroll surface.
- #173 (Atlas): Extracted `BaseOpenAIProvider` abstract class. GPT, Grok, DeepSeek, Mistral
  now extend it with 4 abstract getters each (apiUrl, defaultModel, maxTokens, authErrorMessage).
  1,043 lines → 438 lines (58% reduction). generic.ts untouched — different concerns.

## Key decisions

- `pinnedToBottom` is a ref, not state — prevents re-renders on every scroll event.
  Only `showScrollButton` (the FAB visibility) is state.
- BaseOpenAIProvider uses `abstract readonly config` (interface requirement) + 4 abstract
  protected getters for per-provider config. `sendMessage()` is fully concrete on the base.
- generic.ts was deliberately left out of the BaseOpenAIProvider refactor — it takes a
  dynamic `CustomProviderConfig` at construction time, which is a different concern.

## Open issues

43 remaining in audit backlog (original #145–#194, minus 9 closed this session).

## What's next

Wave 4 candidates:
- #166 (Aria) — Cmd+N keyboard shortcut for new conversation
- #164 (Aria) — Conversation rename
- #145 (Scout) — providerRoster.ts unit tests (Gate's most complex file, zero coverage)
- #189 (Scout) — App.tsx chunk handler integration tests
- #148 (Aria) — Extract shared getModelDotStyle (defined 3 times)

Good 3-way parallel: Aria #166 + Scout #145 + one more (Aria can only do one, pick Scout #189
or another single-agent issue for third slot).

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open
- GPU compositing layers: remove `animation` class entirely to eliminate GPU layers (fixed #125)
- E2E CI: playwright.config.ts uses `reporter: 'list'` — HTML report artifact won't exist on failure
- git am drops binary files silently in worktrees — use cherry-pick from /workspace for Wave ships
