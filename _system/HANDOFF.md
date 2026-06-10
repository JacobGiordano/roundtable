Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.

## Last closed (this session)

- #41 (Quill, Phase 3): Full doc audit. Updated CONTRIBUTING.md, README.md,
  PR template, and feature request template. Opened #42 for Atlas to fix two
  gaps in /backend/README.md.

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

## Next issue

- #42 (Atlas): Fix two doc gaps in /backend/README.md — /auth/refresh token
  invalidation behavior + /auth/login 400 response.

## Decisions made this session

- Quill row added to CONTRIBUTING.md ownership table and agent profiles table
- Atlas row in CONTRIBUTING.md updated to include /backend ownership
- Gate description updated to include accent color persistence
- PR template Agent field updated to include all agents (was missing Quill, Flint, Spark)
- Feature request template agent list updated to include Quill, Coda, Flint
- README Run locally section: added API key onboarding step (was present in dev
  container path but missing from local path)

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
