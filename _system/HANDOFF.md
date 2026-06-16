Last updated: 2026-06-16 (ship #168 #153 #185)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated Wave 1 of the audit backlog (#126–#194) — 3-way parallel, all shipped:

- #168 (Aria): Guard `updateConversation()` against ghost conversations — 4 call sites in App.tsx
  now check `isGhost` before writing to storage. Downstream guard in the store already existed;
  this adds the UI-boundary short-circuit.
- #153 (Atlas): Centralize MAX_TOKENS — removed 6 local `const MAX_TOKENS = 8096` definitions,
  created `/src/models/constants.ts` with correct per-provider output token limits
  (Claude 16000, GPT 16384, Grok 16384, Gemini/DeepSeek/Mistral/Generic 8192).
- #185 (Forge): Wire Playwright E2E smoke tests into CI — new `e2e` job in `ci.yml`, runs after
  build+test, installs Chromium, starts vite preview on port 5173, uploads artifacts on failure.

## Key decisions

- `semantic.error` and `semantic.error-bg` are intentionally split — see prior session notes.
- Ghost guard lives at the UI boundary (App.tsx), not only in the storage layer — defense in depth.
- MAX_TOKENS constants are named per-provider (`MAX_TOKENS_CLAUDE` etc.) to prevent future copy-paste collisions.
- Vite preview runs on port 5173 in CI (not the default 4173) to match `playwright.config.ts` hardcoded baseURL — done via CLI flag, no config file changes needed.
- Flint advisory: `playwright.config.ts` uses `reporter: 'list'` — HTML report artifact won't exist on failure. Filed as a non-blocker; worth a follow-up ticket.

## Open issues

49 remaining in audit backlog (#145–#194, minus #153 #168 #185 now closed).

## What's next

Wave 2 candidates (ready to parallelize):
- #163 (Aria) — Copy message button
- #161 (Aria) — Smart scroll fix
- #194 (Marque) — favicon.ico missing
- #155 or #157 (Vault) — GhostModeManager cleanup / export serializer extraction

Aria can only run one issue at a time — pick one Aria issue plus Marque + one Vault for the next wave.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open
- GPU compositing layers: remove the `animation` class entirely (not just override transform) to eliminate GPU layers. Fixed via `AnimatedListItem` in #125.
- E2E CI: `playwright.config.ts` uses `reporter: 'list'` — HTML report artifact won't exist on failure (Flint advisory from #185 review)
