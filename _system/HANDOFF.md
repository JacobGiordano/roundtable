Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 1 complete. All model provider + registry work merged to main.

## Active agents for next session

None pending. Wave 1 fully merged.

## Last closed (this session — Phase 4 Wave 1)

- Arch: extended `ModelId` (`'gemini' | 'grok'`) and `CredentialKey` (`'google' | 'xai'`)
- Atlas: added GeminiModelProvider, GrokModelProvider, central model registry;
  activated both providers in PROVIDERS and MODEL_REGISTRY
- Gate: MODEL_CREDENTIAL_MAP and CREDENTIAL_LABELS extended with google/xai entries
- Aria: MOCK_MODELS removed from App.tsx; replaced with buildDefaultModelConfigs()
- Firewall: generativelanguage.googleapis.com and api.x.ai added to init-firewall.sh

## Decisions made this session

- Gemini: `defaultActive: false` — user must explicitly enable; avoids surprise API spend
- Grok: `defaultActive: false` — same reasoning
- CREDENTIAL_LABELS['google']: provider "Google AI Studio", placeholder "AIza…",
  docsUrl https://aistudio.google.com/app/apikey
- CREDENTIAL_LABELS['xai']: provider "xAI", placeholder "xai-…",
  docsUrl https://console.x.ai/team/default/api-keys
- buildDefaultModelConfigs passed as lazy initializer (no `()`) to useState

## Next issues in priority order (Phase 4 — Wave 2)

1. [Vault] ServerStorageProvider (REST client for self-hosted backend)
2. [Gate] Backend auth support (session tokens, login/logout)
3. Self-hosted backend service (Node/Express, Docker Compose)
4. Open source launch prep

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
