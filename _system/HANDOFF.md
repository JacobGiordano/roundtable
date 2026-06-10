Last updated: 2026-06-10

## Current phase

Phase 4 — All major features complete. Open source launch prep in progress (#27).

## Last closed (this session)

- #27 (Coda): Open source launch prep. README expanded with product overview,
  features, quick start, and dev commands. CONTRIBUTING.md with agent boundary
  rules, agent profiles table, and contributor workflow. LICENSE (MIT).
  CODE_OF_CONDUCT.md (Contributor Covenant v2.1). GitHub issue templates (bug,
  feature) and PR template. All in branch 27-coda-open-source-launch-prep.

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

None — project is feature-complete and launch-ready. Future issues TBD.

## Decisions made this session

- README screenshots section omitted — no browser environment available to
  capture them; add manually before public launch.
- CODE_OF_CONDUCT.md uses Contributor Covenant v2.1 (standard).
- /backend/README.md already existed and is comprehensive — no action needed.
- Agency Agents setup instructions folded into CONTRIBUTING.md (not a separate file).

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
- /backend/README.md exists and is comprehensive — no action needed
