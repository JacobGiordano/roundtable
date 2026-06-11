Last updated: 2026-06-11

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed (wave 1 — all awaiting merge authorization)

- #46 (Aria): MessageBubble Reply button a11y fix. Removed aria-hidden from bottom row
  container; added focus-within:opacity-100. Token count div gets aria-hidden={!rowVisible}.
- #58 (Luma): text-muted contrast fixed in 5 themes (Slate, Linen, Ash, Ember, Chalk).
  Minimal per-theme adjustments; each theme file has _a11y annotation with ratios.
  Ada should remove it.fails() wrappers from B1–B5 in contrast.test.ts.
- #64 (Scout): @testing-library/react 16.3.2, @testing-library/user-event 14.6.1,
  jsdom 29.1.1, @axe-core/react 4.11.3, vitest-axe 0.1.0 installed. Vitest config
  updated to jsdom environment. 415 tests passing, 0 failures.
- Arch: Marque added to CLAUDE.md routing table and boundary rules.
- Quill: Marque added to CONTRIBUTING.md ownership and agent profiles tables.

## Last closed (wave 2)

- #47 (Aria): ModelSelectorPanel aria-controls id mismatch fixed. Added
  id="model-selector-panel" to the panel container div so it matches the trigger
  button's existing aria-controls="model-selector-panel". Awaiting merge authorization.

## In progress

- #66 (Ada): axe-core tests for MessageBubble (#46 Reply button + #48 streaming live region).
  Branch: 66-ada-message-bubble-axe-tests. 14 new tests, all passing. Awaiting merge authorization.

## Decisions made this session

- Ada: vitest-axe@0.1.0 exports `toHaveNoViolations` under `export type *` which
  prevents value-import under strict tsc. Pattern: use `axe(container)` + inline
  `assertNoViolations(results)` helper that checks `results.violations.length` and
  formats failures identically to toHaveNoViolations. No type workarounds needed.
  This pattern should be used in all future axe-core test files.
- HTMLCanvasElement.getContext() stderr warnings from axe-core in jsdom are non-fatal.
  axe uses canvas for color contrast checks; canvas is not installed. Violations are
  still detected; only some contrast checks are skipped. This is acceptable for unit tests.

## Model providers (all on main)

| Model | Default active | Accent token | providerName | Default version |
|-------|---------------|--------------|--------------|-----------------|
| Claude | yes | accent-claude | Anthropic | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | OpenAI | gpt-5.5 |
| Gemini | no | accent-gemini | Google | gemini-2.5-flash |
| Grok | no | accent-grok | xAI | grok-3 |
| DeepSeek | no | accent-deepseek | DeepSeek | deepseek-chat |
| Mistral | no | accent-mistral | Mistral | mistral-large-latest |

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with ModelId union
- VALID_MODEL_IDS also in /src/auth/modelVersion.ts — update both when adding models
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Gemini model string is now in the URL path via buildGeminiUrl() — not a body field
- Adding new models: update MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry
- accent-deepseek in Slate and Ash is a serious text contrast failure — Luma fix tracked in #60
- npm audit reports 4 pre-existing vulns (3 moderate, 1 critical) in esbuild/vite chain —
  fix requires Vite v8 upgrade (breaking change), not in current scope
- vitest-axe axe-core assertion pattern: use assertNoViolations(results) helper, not
  expect.extend({ toHaveNoViolations }) — see decisions above

## Brand work (post-a11y)

Marque (brand agent, he/him) is drafted in .claude/agents/marque.md.
Open a GitHub issue for the branding pass before activating him.
Do not activate Marque until Aria's a11y fixes are complete.

## Next issues in priority order

1. Luma: #60 — accent-deepseek/gemini text contrast (Slate and Ash most severe)
   [run in parallel with #59]
2. Luma: #59 — error color contrast on card surface (Slate and Ash)
3. Aria: #48 — MessageBubble streaming state not announced to screen readers
4. Ada: remove it.fails() wrappers from B1–B5 in contrast.test.ts (#58 Luma fix merged)
5. Aria: #49–#57 — remaining a11y issues (one per session)
6. Open branding issue → activate Marque
