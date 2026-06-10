Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 2 in progress.

## Active agents for next session

Atlas (DeepSeek + Mistral provider implementations) — parallel with Gate's branch.

## Last closed (this session)

- Gate: added `'deepseek'` and `'mistral'` to `MODEL_CREDENTIAL_MAP` and `CREDENTIAL_LABELS`
  in `src/auth/credentials.ts`. Fixes tsc errors caused by the Arch-extended
  `ModelId` / `CredentialKey` union types already in `/src/types/index.ts`.

## Decisions made this session

- `CREDENTIAL_LABELS['deepseek']`: provider "DeepSeek", placeholder "sk-…",
  docsUrl https://platform.deepseek.com/api-keys
- `CREDENTIAL_LABELS['mistral']`: provider "Mistral AI", placeholder "…",
  docsUrl https://console.mistral.ai/api-keys/

## Next issues in priority order (Phase 4 — Wave 2)

1. [Atlas] DeepSeek provider implementation
2. [Atlas] Mistral provider implementation
3. [Vault] ServerStorageProvider (REST client for self-hosted backend)
4. [Gate] Backend auth support (session tokens, login/logout)
5. Self-hosted backend service (Node/Express, Docker Compose)
6. Open source launch prep

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY all exported
  from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null for missing conversations — always null-check before download
- ThreadRow is a `<div>` wrapper (not `<button>`) — accessible via inner navigation button
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
