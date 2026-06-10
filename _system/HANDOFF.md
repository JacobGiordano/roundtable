Last updated: 2026-06-10

## Current phase

<<<<<<< HEAD
Phase 4 — Backend auth and storage provider wiring complete.

## Last closed (this session)

- #25 (Gate): Backend auth support implemented. login(), logout(), refreshToken(),
  getActiveStorageProvider(), isBackendConfigured(), getBackendFallbackStatus()
  in /src/auth/backendAuth.ts. 37 tests, all passing. Lint and build clean.
=======
Phase 4 — 6 model providers live. Color system complete. Self-hosted backend added.

## Last closed (this session)

- #26 (Atlas): Self-hosted backend implemented in /backend/. Express + SQLite
  (better-sqlite3) + JWT auth (jsonwebtoken) + bcrypt passwords. All
  ServerStorageProvider endpoints implemented. Docker Compose included.
  npm run build and npm run lint both pass inside /backend/.
>>>>>>> 26-atlas-backend-service

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
<<<<<<< HEAD
2. Self-hosted backend service (#26) — Atlas
=======
2. [Gate] Backend auth support (session tokens, login/logout) (#25)
>>>>>>> 26-atlas-backend-service
3. Open source launch prep (#27)

## Decisions made this session

<<<<<<< HEAD
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
=======
- Backend is a standalone Node.js package (/backend/package.json) — no root
  package.json changes.
- ESLint 9 + typescript-eslint v8 (flat config) chosen for backend to match
  root workspace versions and avoid module resolution conflicts.
- Export format extended: backend accepts 'json' | 'markdown' | 'html'; client
  ExportFormat only declares 'markdown' | 'html'. JSON format is server-only
  convenience, not exposed to the client.
- PATCH /conversations/:id keeps the JSON blob's archivedAt in sync with the
  archived INTEGER column so both remain consistent.
- DELETE /conversations/:id always returns 204 (idempotent) matching the
  ServerStorageProvider contract which treats 404 as success.
>>>>>>> 26-atlas-backend-service

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY exported from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI components now auto-update
- VALID_MODEL_IDS in /src/auth/accentColors.ts must be updated whenever ModelId union in types/index.ts changes
<<<<<<< HEAD
- getActiveStorageProvider() is the App.tsx entry point — passes provider to useConversationStore()
=======
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
>>>>>>> 26-atlas-backend-service
