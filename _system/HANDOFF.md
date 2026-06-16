Last updated: 2026-06-16 (ship #163 #157 #194)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated Wave 2 of the audit backlog — 3-way parallel, all shipped:

- #163 (Aria): Copy-to-clipboard button on all message bubbles. Hover-reveal (opacity-0 →
  opacity-100 on isHovered or focus-visible). Clipboard API with silent failure swallowing.
  1.5s checkmark feedback; aria-label switches for screen readers. Single file: MessageBubble.tsx.
- #157 (Vault): Extracted `conversationToMarkdown` and `conversationToHtml` from
  LocalStorageProvider.ts into new `/src/storage/exporters.ts`. Both functions now exported
  from the `/src/storage` barrel. Public API unchanged. 778 tests pass.
- #194 (Marque): favicon.ico (16×32px ICO, generated via pure-Node script), apple-touch-icon.png
  (180×180), manifest.json (PWA, theme #2D2B55), index.html updated. Generator script lives in
  /_design/brand/scripts/generate-favicon.cjs. Follow-up: 192/512px PNG sizes for full PWA
  install prompts not yet generated (not required for #194 acceptance criteria).

## Key decisions

- Ghost guard lives at the UI boundary (App.tsx) AND in the store — defense in depth.
- MAX_TOKENS constants are named per-provider to prevent future copy-paste collisions.
- Vite preview in CI runs on port 5173 (not default 4173) to match playwright.config.ts baseURL.
- Export serializers are pure functions (no DOM, no side effects) — safe to call from any context.
- Favicon generator uses no external deps (pure Node zlib + manual PNG/ICO framing) so it's
  reproducible in CI and the devcontainer without extra installs.

## Open issues

46 remaining in audit backlog (original #145–#194, minus 6 now closed: #153 #168 #185 #157 #163 #194).

## What's next

Wave 3 candidates:
- #161 (Aria) — Smart scroll fix (high UX value)
- #166 (Aria) — Cmd+N keyboard shortcut
- #155 (Vault) — Remove redundant GhostModeManager._ghostIds Set
- #145 (Scout) — providerRoster.ts unit tests
- #173 (Atlas) — BaseOpenAIProvider class (eliminate duplication across 4 OpenAI-compatible files)

Good 3-way parallel: Aria #161 + Vault #155 + Atlas #173 (no type file changes, different owners).

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
- GPU compositing layers: remove the `animation` class entirely to eliminate GPU layers. Fixed via AnimatedListItem in #125.
- E2E CI: playwright.config.ts uses `reporter: 'list'` — HTML report artifact won't exist on failure (advisory from #185)
- format-patch → git am drops binary files silently; Marque's ICO/PNG committed directly in the worktree (verified via log comparison)
