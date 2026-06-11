Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed

- #64 (Scout): Install @testing-library/react + jsdom — fully shipped. RTL, user-event,
  jsdom, @axe-core/react, vitest-axe all added as devDependencies. Vitest configured
  with environment: 'jsdom'. All 14 test files pass (415 tests). Lint and build clean.

## In progress

None. All known issues closed.

## Decisions made this session

- Scout: Added `test` block to vite.config.ts (no separate vitest.config.ts) — kept
  the config surface minimal. environment: 'jsdom', globals: true.
- Scout: Pre-existing esbuild/vite vulnerability chain is NOT introduced by this PR;
  fix requires Vite v8 upgrade (breaking change, separate issue).

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

## Next issues in priority order

1. Aria: fix A1 (MessageBubble Reply button aria-hidden — #46) — blocks keyboard users
2. Aria: fix A2 (ModelSelectorPanel aria-controls id mismatch — #47)
3. Luma: fix text-muted contrast failures (#58) — 5 themes affected
4. Luma: fix accent-deepseek/gemini text contrast failures (#60) — Slate and Ash most severe
5. Luma: fix error color contrast on card surface (#59) — Slate and Ash
6. Aria: remaining a11y issues #48–#57
7. Arch: add Marque to CLAUDE.md agent table and boundary rules
8. Marque: branding pass (logo, icon, favicon, palette, typography) — open issue first
