Last updated: 2026-06-10

## Current phase

Phase 4 — Backend auth and storage provider wiring complete.

## Last closed (this session)

- #25 (Gate): Backend auth support implemented. login(), logout(), refreshToken(),
  getActiveStorageProvider(), isBackendConfigured(), getBackendFallbackStatus()
  in /src/auth/backendAuth.ts. 37 tests, all passing. Lint and build clean.

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
2. Self-hosted backend service (#26) — Atlas
3. Open source launch prep (#27)

## Decisions made this session

- BackendAuthError is internal to /src/auth — Aria catches by duck-typing (.code
  field), no Arch PR needed unless Aria needs instanceof checks.
- createStorageProvider imported from @/storage/storageFactory — sanctioned
  exception documented in module doc comment. Gate calls factory only, never
  instantiates LocalStorageProvider/ServerStorageProvider directly.
- saveAuthToken() is unexported (package-private) — only getAuthToken() reads
  the token; only saveAuthToken() writes it. clearAuthToken() exported for logout.
- logout() does not make a network call — clears localStorage only. Token-based
  auth means client-side clear is sufficient.
- refreshToken() does NOT call logout() on invalid_response — only on
  auth failure or network error. A malformed response body does not mean the
  token is revoked.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY exported from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI components now auto-update
- VALID_MODEL_IDS in /src/auth/accentColors.ts must be updated whenever ModelId union in types/index.ts changes
- getActiveStorageProvider() is the App.tsx entry point — passes provider to useConversationStore()
