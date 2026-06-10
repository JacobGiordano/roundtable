Last updated: 2026-06-10

## Current phase

Phase 4 — All major features complete. Color customization, backend auth, self-hosted backend, storage provider wiring all shipped.

## Last closed (this session)

- #38 (Aria): Color picker UI. applyUserAccentColors in theme.ts, AccentColorPicker
  popover, palette icon on ModelPill (selector panel context only), "Reset all model
  colors" in Settings panel. 22 new tests (colorUtils + applyUserAccentColors), all
  passing. Lint and build clean.
- #25 (Gate): Backend auth support. login(), logout(), refreshToken(),
  getActiveStorageProvider(), isBackendConfigured(), getBackendFallbackStatus()
  in /src/auth/backendAuth.ts. 37 tests, all passing.
- #26 (Atlas): Self-hosted backend in /backend/. Express + SQLite (better-sqlite3)
  + JWT auth + bcrypt passwords. All ServerStorageProvider endpoints implemented.
  Docker Compose included. Build and lint pass.

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

1. Open source launch prep (#27)

## Decisions made this session

- applyUserAccentColors exported from /src/ui/theme.ts — wired at app load only.
  Must be re-called after every applyTheme() — pending when theme switcher is added.
- Pure WCAG helpers in colorUtils.ts (react-refresh: component files export components only).
- Color picker is fixed-position (no React portal infrastructure exists).
- BackendAuthError internal to /src/auth — Aria catches by duck-typing (.code field).
- createStorageProvider imported from @/storage/storageFactory — sanctioned exception.
- saveAuthToken() unexported — only login()/refreshToken() write it.
- logout() clears localStorage only — no network call.
- refreshToken() does NOT call logout() on invalid_response.
- Backend is a standalone Node.js package (/backend/package.json).
- ESLint 9 flat config for backend to match root workspace versions.
- DELETE /conversations/:id always returns 204 (idempotent).
- PATCH /conversations/:id keeps JSON blob archivedAt in sync with archived column.

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
