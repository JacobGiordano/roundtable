Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 2 in progress. Atlas complete; Gate parallel session still open.

## Active agents for next session

Gate — must add `deepseek` and `mistral` entries to MODEL_CREDENTIAL_MAP and
CREDENTIAL_LABELS in /src/auth/credentials.ts to unblock the build.

## Last closed (this session — Phase 4 Wave 2 Atlas)

Atlas: added DeepSeekModelProvider and MistralModelProvider; registered both in
PROVIDERS and MODEL_REGISTRY; exported from @/models index.

## Decisions made this session

- DeepSeek: endpoint https://api.deepseek.com/v1/chat/completions, model deepseek-chat
- Mistral: endpoint https://api.mistral.ai/v1/chat/completions, model mistral-large-latest
- Both use Authorization: Bearer header (same pattern as Grok/GPT)
- Both use stream_options: { include_usage: true } for token usage in final SSE chunk
- Both defaultActive: false — user must explicitly enable
- Both color: 'accent-other' — Luma to define accent-deepseek and accent-mistral tokens
  in a follow-up Wave 2 palette pass

## Build status

Two tsc errors remain in /src/auth/credentials.ts (Gate's directory):
  - deepseek missing from MODEL_CREDENTIAL_MAP
  - mistral missing from MODEL_CREDENTIAL_MAP and CREDENTIAL_LABELS
Atlas's models/ code is clean; build unblocks when Gate's session merges.

## Next issues in priority order (Phase 4)

1. [Gate] Add deepseek/mistral to credentials.ts — unblocks build (parallel session)
2. [Vault] ServerStorageProvider (REST client for self-hosted backend)
3. [Gate] Backend auth support (session tokens, login/logout)
4. Self-hosted backend service (Node/Express, Docker Compose)
5. Open source launch prep

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
- api.deepseek.com and api.mistral.ai NOT on firewall allowlist — user must add before live testing
