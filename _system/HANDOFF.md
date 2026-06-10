Last updated: 2026-06-09

## Current phase

Phase 4 — in progress.

## Active agents for next session

- Atlas: remove casts in gemini.ts/grok.ts and activate Gemini/Grok in registry.ts + index.ts
- Aria: replace MOCK_MODELS in App.tsx with buildDefaultModelConfigs() from @/models

## Last closed

- Gate (phase4-gate-credential-entries): MODEL_CREDENTIAL_MAP and CREDENTIAL_LABELS
  extended with 'google'/'xai' entries. TypeScript build errors resolved.

## Decisions made this session

- CREDENTIAL_LABELS['google']: provider "Google AI Studio", placeholder "AIza…",
  docsUrl https://aistudio.google.com/app/apikey
- CREDENTIAL_LABELS['xai']: provider "xAI", placeholder "xai-…",
  docsUrl https://console.x.ai/team/default/api-keys
- No other files touched — Gate's change confined to /src/auth/credentials.ts

## Next issues in priority order (Phase 4 — Expansion)

1. [Atlas] Remove double casts and activate Gemini/Grok in registry.ts + index.ts
2. [Aria] Replace MOCK_MODELS in App.tsx with buildDefaultModelConfigs() from @/models
3. [Vault] ServerStorageProvider (REST client for self-hosted backend)
4. [Gate] Backend auth support (session tokens, login/logout)
5. Self-hosted backend service (Node/Express, Docker Compose)
6. Open source launch prep

## Gotchas

- firewall allowlist does NOT include generativelanguage.googleapis.com or api.x.ai —
  must be added before Gemini/Grok can be tested in dev container (user authorization required)
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- MODEL_REGISTRY and buildDefaultModelConfigs() exported from @/models — documented
  cross-agent exception for Aria to consume
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
