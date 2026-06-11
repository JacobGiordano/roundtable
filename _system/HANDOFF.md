Last updated: 2026-06-11 (end of session — Aria #55)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed this session

- #55 (Aria): pill-shake animation now suppressed under prefers-reduced-motion.
  Added `.pill-shake { animation: none; transform: none; }` to the existing
  @media (prefers-reduced-motion: reduce) block in src/index.css.
  Also fixed in same commit:
  - .streaming-shimmer[data-model="claude"]::after: was not in reduced-motion
    block despite having its own animated rule — merged into base selector.
  - Added missing reduced-motion overrides for grok, deepseek, mistral shimmer variants.
  - Sidebar.tsx ThreadSkeleton: animate-pulse now has motion-reduce:animate-none.
  Awaiting merge authorization.

## Previously closed (awaiting merge authorization)

- #46 (Aria): MessageBubble Reply button a11y fix.
- #58 (Luma): text-muted contrast fixed in 5 themes.
- #64 (Scout): test deps updated, 415 tests passing.
- Arch + Quill: Marque added to CLAUDE.md and CONTRIBUTING.md.
- #47 (Aria): ModelSelectorPanel aria-controls id mismatch fixed.
- #56 (Aria): SessionTokenSection toggle button missing aria-controls fixed.
- #66 (Ada): axe-core tests for MessageBubble. 14 tests, all passing.

## Decisions this session

- Reduced-motion fix strategy: CSS @media block (not JS matchMedia) — consistent
  with existing pattern in index.css. Tailwind motion-reduce: variant used for
  Tailwind-sourced animations (animate-pulse in Sidebar skeleton).
- The streaming-shimmer model-specific reduced-motion rules were incomplete —
  claude variant re-added animation via its own rule, overriding the base ::after
  override. Grok/deepseek/mistral had no reduced-motion overrides at all.
  All fixed in #55 commit.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts and /src/auth/modelVersion.ts — update both when adding models
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Gemini model string is now in the URL path via buildGeminiUrl() — not a body field
- Adding new models: update MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- accent-deepseek in Slate and Ash is a serious text contrast failure — Luma fix tracked in #60
- npm audit reports 4 pre-existing vulns (3 moderate, 1 critical) in esbuild/vite chain —
  fix requires Vite v8 upgrade (breaking change), not in current scope
- vitest-axe axe-core assertion pattern: use assertNoViolations(results) helper, not
  expect.extend({ toHaveNoViolations })
- aria-controls: collapsible panels must always be in the DOM; use hidden attribute, not
  conditional render — both SessionTokenSection (#56) and ModelSelectorPanel (#47) follow this

## Next issues in priority order

1. Luma: #60 — accent-deepseek/gemini text contrast (Slate and Ash most severe)
2. Luma: #59 — error color contrast on card surface (Slate and Ash)
3. Aria: #48 — MessageBubble streaming state not announced to screen readers
4. Ada: remove it.fails() wrappers from B1–B5 in contrast.test.ts (#58 Luma fix merged)
5. Aria: #49–#57 (excluding #55, now closed) — remaining a11y issues (one per session)
6. Open branding issue → activate Marque
