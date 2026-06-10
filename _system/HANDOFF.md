Last updated: 2026-06-10

## Current phase

Phase 4 — 6 model providers live. Color system complete.

## Last closed (this session)

- #38 (Gate): Model accent color persistence implemented. Four functions
  (getModelAccentColors, setModelAccentColor, clearModelAccentColor,
  clearAllModelAccentColors) in /src/auth/accentColors.ts. 41 tests, all
  passing. Lint and build clean.

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

1. [Aria] Color picker UI — palette icon on model pills, popover, CSS override
   pass (#38 Aria phase). Import getModelAccentColors, setModelAccentColor,
   clearModelAccentColor, clearAllModelAccentColors from @/auth.
2. [Gate] Backend auth support (session tokens, login/logout) (#25)
3. Self-hosted backend service (#26) — Atlas
4. Open source launch prep (#27)

## Decisions made this session

- Gate maintains its own VALID_MODEL_IDS set (no import from @/models) per
  boundary rules. Must be kept in sync with ModelId union in types/index.ts.
- Validation on read is fail-open per entry (invalid entries silently dropped,
  valid entries returned). Validation on write is fail-closed (TypeError thrown).
- clearModelAccentColor writes back an empty object {} when the last entry is
  removed, rather than calling removeItem. clearAllModelAccentColors removes
  the key entirely. Both are correct per spec.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY exported from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI components now auto-update
- VALID_MODEL_IDS in /src/auth/accentColors.ts must be updated whenever ModelId union in types/index.ts changes
