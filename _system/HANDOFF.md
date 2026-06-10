Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.

## Last closed

- #43 (Arch + Quill): Added Scout 🔭 and Ada ♿ testing agents — profiles, CLAUDE.md registry,
  CONTRIBUTING.md tables. Scout is a talking dog (they/them). All merged to main.

## In progress

None. All known issues closed.

## Decisions made this session

- Scout 🔭 owns `/src/tests/` (excl. a11y/); Ada ♿ owns `/src/tests/a11y/`.
- Both are read-only against application code — they open tickets, they do not fix.
- Scout's gender: he/him (the goodest boy; a talking dog).

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

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
