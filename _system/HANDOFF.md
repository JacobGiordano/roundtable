Last updated: 2026-06-10

## Current phase

Phase 4 — 6 model providers live. Color system complete.

## Active agents for next session

Aria — consume `providerName` from `MODEL_REGISTRY` in `ModelSelectorPanel.tsx`
to replace the hardcoded claude/gpt ternary (issue #40, Aria side).

## Last closed (this session)

- #40 (Atlas side): Added `providerName: string` to `ModelRegistryEntry` interface
  and populated it for all 6 entries (Anthropic, OpenAI, Google, xAI, DeepSeek, Mistral).
  No changes to `/src/types/index.ts` — `ModelRegistryEntry` is a local interface in
  `/src/models/registry.ts`. Lint and build pass.

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

1. [Aria] Consume `providerName` from `MODEL_REGISTRY` in `ModelSelectorPanel.tsx` (#40, Aria side)
2. [Luma → Arch → Gate → Aria] User-customizable model accent colors (#38) — Luma spec first
3. [Vault] ServerStorageProvider (REST client for self-hosted backend) (#24)
4. [Gate] Backend auth support (session tokens, login/logout) (#25)
5. Self-hosted backend service (Node/Express, Docker Compose) (#26)
6. Open source launch prep (#27)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- When Arch extends types AND Gate/Aria must follow: merge both locally before pushing
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- DeepSeek `#4060FF` in Outrun is ~3.4:1 contrast — known trade-off; bold 14px label required
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY exported from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null for missing conversations — always null-check before download
- ThreadRow is a `<div>` wrapper (not `<button>`) — accessible via inner navigation button
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- Gemini API key goes in URL as `?key=<apiKey>` — Google REST API pattern, not a header
- color-mix() used in InputBar pill for opacity — supported Chrome 111+/Firefox 113+/Safari 16.2+
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI components now auto-update
