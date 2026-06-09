Last updated: 2026-06-09

## Current phase

Phase 4 — in progress.

## Active agents for next session

- Arch: needed immediately — types PR required before Gemini/Grok can be activated
- Gate: needed after Arch — add 'google'/'xai' to CredentialKey handling in auth
- Aria: needed after Gate — consume MODEL_REGISTRY/buildDefaultModelConfigs from @/models

## Last closed

- Atlas (phase4-atlas-model-providers): central registry built; Gemini + Grok provider
  implementations complete but gated on Arch types PR.

## Decisions made this session

- `PROVIDERS` moved from inline in sendMessage.ts to registry.ts — sendMessage.ts
  now imports from registry (no circular dep; registry ← claude/gpt, sendMessage ← registry).
- `ModelRegistryEntry` interface added to registry.ts and exported from @/models.
  Aria should replace MOCK_MODELS in App.tsx with `buildDefaultModelConfigs()` once
  Gemini/Grok are activated (or sooner — it's a clean drop-in for current two models).
- Gemini uses `gemini-1.5-flash` via the `v1beta` streamGenerateContent endpoint.
  API key passed as `?key=<apiKey>&alt=sse` query param (Google REST auth pattern).
  System prompt sent as `system_instruction.parts[0].text` at the request root.
- Grok uses `grok-beta` via `https://api.x.ai/v1/chat/completions` (OpenAI-compatible).
  Same SSE format as OpenAI; `stream_options: { include_usage: true }` for token counts.
- Double cast (`'gemini' as unknown as ModelId`) used in gemini.ts and grok.ts to
  satisfy tsc without modifying types/index.ts. Casts are documented and localized
  to the config constants. Will be removed when Arch's PR lands.

## Next issues in priority order (Phase 4 — Expansion)

1. [Arch] Add 'gemini', 'grok' to ModelId; 'google', 'xai' to CredentialKey in types/index.ts
2. [Gate] Add MODEL_CREDENTIAL_MAP entries and CREDENTIAL_LABELS for google + xai
3. [Atlas] Remove casts and activate Gemini/Grok in registry.ts + index.ts
4. [Aria] Replace MOCK_MODELS in App.tsx with buildDefaultModelConfigs() from @/models
5. [Vault] ServerStorageProvider (REST client for self-hosted backend)
6. [Gate] Backend auth support (session tokens, login/logout)
7. Self-hosted backend service (Node/Express, Docker Compose)
8. Open source launch prep

## Gotchas

- firewall allowlist does NOT include generativelanguage.googleapis.com or api.x.ai —
  must be added before Gemini/Grok can be tested in dev container (user authorization required)
- Single-PR rule on types/index.ts — Arch PR for 'gemini'/'grok' must land before any
  other types PR starts
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- MODEL_REGISTRY and buildDefaultModelConfigs() exported from @/models — documented
  cross-agent exception for Aria to consume
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
