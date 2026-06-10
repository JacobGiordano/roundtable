Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed

- #61 (Arch): Model version selection types. Added `ModelVersionOption` interface
  and `selectedVersionId?: string` to `ModelConfig`. PR open on
  `61-arch-model-version-types`. Awaiting user authorization to merge.

## In progress

- #61 (Arch): Branch `61-arch-model-version-types` — PR open, not yet merged.

## Decisions made this session

- `getAvailableVersions()` does NOT go on `ModelProvider`. Available versions are
  static; they belong on MODEL_REGISTRY entries in Atlas. Rationale documented in
  JSDoc on `ModelVersionOption`.
- `selectedVersionId` is optional on `ModelConfig`. Absence = use provider default.
  Atlas must handle the undefined case in sendMessage.
- `ModelVersionOption.id` is the exact API-level model string (not a typed union) —
  Atlas controls the allowed values in its registry. Keeping it `string` avoids
  requiring a types PR every time Atlas adds a new version.

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

## Next issues in priority order

1. #61 Atlas: add `availableVersions: ModelVersionOption[]` to each MODEL_REGISTRY entry; read `selectedVersionId` from ModelConfig in sendMessage
2. #61 Gate: persist `selectedVersionId` on ModelConfig to/from localStorage; expose setter to Aria
3. #61 Aria: render version picker in per-model settings panel
4. #62 (Aria + Gate): Resizable sidebar — self-contained, can run anytime
5. Install @testing-library/react + jsdom so Scout can test React hook layer and Ada can run axe-core component tests
6. Aria: fix A1 (MessageBubble Reply button aria-hidden — #46)
7. Aria: fix A2 (ModelSelectorPanel aria-controls id mismatch — #47)
8. Luma: fix text-muted contrast failures (#58)
9. Luma: fix accent-deepseek text contrast failures (#60)
10. Aria: remaining a11y issues #48–#57

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with ModelId union
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry
- React hook layer (useConversationStore, useGhostMode) needs @testing-library/react
  + jsdom before it can be integration-tested; neither is in devDependencies.
- accent-deepseek in Slate and Ash is a serious text contrast failure (3.32:1 and
  3.26:1 on card) — Luma fix tracked in gh issue #60.
