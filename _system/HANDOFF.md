Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.

## Last closed

- #42 (Atlas): Fixed two doc gaps in /backend/README.md (400 response on POST /auth/login;
  token invalidation note on POST /auth/refresh). Merged to main.
- #41 (Quill): CONTRIBUTING.md written (Quill, parallel session). Merge pending Coda sequencing.

## In progress

- #43 (Arch): Adding Scout and Ada to CLAUDE.md — branch `43-arch-add-scout-ada-to-claude-md`,
  commit pending user authorization to merge.

## Decisions made this session

- Scout 🔭 owns `/src/tests/` (excl. a11y/); Ada ♿ owns `/src/tests/a11y/`.
- Both agents added to Agents table, boundary rules table, and codebase structure block.
- Scout and Ada are read-only against application code — they open tickets, they do not fix.

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
