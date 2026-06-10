Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 2 model providers complete. Wave 2 backend work is next.

## Active agents for next session

None pending. All Wave 2 model provider branches merged to main.

## Last closed (this session — Phase 4 Wave 2)

- Arch: extended `ModelId` + `CredentialKey` for `'deepseek'` and `'mistral'`
- Gate: added `deepseek`/`mistral` to `MODEL_CREDENTIAL_MAP` and `CREDENTIAL_LABELS`
- Atlas: added `DeepSeekModelProvider` + `MistralModelProvider`; both registered in
  `PROVIDERS` and `MODEL_REGISTRY`; exported from `@/models`
- Firewall: `api.deepseek.com` and `api.mistral.ai` added to `init-firewall.sh`

## Decisions made this session

- DeepSeek: endpoint `https://api.deepseek.com/v1/chat/completions`, model `deepseek-chat`
- Mistral: endpoint `https://api.mistral.ai/v1/chat/completions`, model `mistral-large-latest`
- Both use `Authorization: Bearer` header (same pattern as Grok/GPT)
- Both `defaultActive: false` — user must explicitly enable
- Both `color: 'accent-other'` — Luma to define dedicated tokens in color follow-up pass
- DeepSeek and Mistral credential labels: "DeepSeek" / "Mistral AI"

## Next issues in priority order

1. [Luma] Define accent color tokens for Grok, DeepSeek, and Mistral across all 7 themes
2. [Luma → Arch → Gate → Aria] User-customizable model accent colors feature
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
