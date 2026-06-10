Last updated: 2026-06-10

## Current phase

Phase 4 — All major features complete. Open source launch prep complete.

## Last closed (this session)

- #41 (Arch, Phase 2): Added Quill technical writer agent to CLAUDE.md.
  Updated agents table and boundary rules table. CLAUDE.md is now authoritative
  for Quill's ownership and no-touch rules. Quill agent file (.claude/agents/quill.md)
  was Phase 1, already on main.

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

- Quill row added to agents table: work type "Documentation (README.md, CONTRIBUTING.md, /docs/)"
- Quill row added to boundary table: owns root-level docs + .github/ + /docs/; must never touch all src dirs, CLAUDE.md, and HANDOFF.md
- Parallel agent execution section not modified — it is procedural, not a roster; no Quill entry needed there
- Codebase structure block not modified — Quill owns root-level files, not a subdirectory; no inline annotation applies

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
