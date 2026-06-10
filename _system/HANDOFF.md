Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed

- #62 (Gate + Aria): Resizable sidebar. Drag handle, keyboard (arrow ±8px), clamped
  [180–600]px, persisted at rt-ui-sidebar-width. prefers-reduced-motion respected.
- #61 partial (Arch + Atlas + Gate): Model version selection types, registry, and
  persistence merged. Aria model picker UI is the remaining piece — see In progress.

## In progress

- #61 (Aria): Model version picker UI — NOT YET STARTED. Aria needs to:
  1. Read availableVersions from MODEL_REGISTRY (same cross-agent exception as buildDefaultModelConfigs)
  2. On init: call getModelVersion(modelId) for each model, set ModelConfig.selectedVersionId
  3. Render version picker in per-model settings panel
  4. On selection: call setModelVersion(modelId, versionId), update local state
  5. Optionally: clearModelVersion(modelId) for reset to default

## Decisions made this session

- Atlas: getAvailableVersions() stays off ModelProvider — version lists are static,
  belong on MODEL_REGISTRY entries. Documented in JSDoc on ModelVersionOption.
- Atlas: selectedVersionId threaded via VersionAwareProvider cast — no types change.
- Atlas: Gemini URL is now dynamic (buildGeminiUrl(modelString)) — model is in URL path.
- Gate: version store at roundtable:model-versions — parallel to ModelConfig, not embedded.
  Vault untouched; old sessions work as-is.
- Aria: sidebar width via inline style (dynamic px doesn't work with Tailwind JIT).

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
- React hook layer (useConversationStore, useGhostMode) needs @testing-library/react
  + jsdom before it can be integration-tested; neither is in devDependencies.
- accent-deepseek in Slate and Ash is a serious text contrast failure — Luma fix tracked in #60

## Next issues in priority order

1. #61 (Aria): Model version picker UI — Aria's half, all backend ready
2. Install @testing-library/react + jsdom — unblocks Scout hook tests + Ada axe-core tests
3. Aria: fix A1 (MessageBubble Reply button aria-hidden — #46) — blocks keyboard users
4. Aria: fix A2 (ModelSelectorPanel aria-controls id mismatch — #47)
5. Luma: fix text-muted contrast failures (#58) — 5 themes affected
6. Luma: fix accent-deepseek text contrast failures (#60) — Slate and Ash most severe
7. Aria: remaining a11y issues #48–#57
