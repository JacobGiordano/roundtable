Last updated: 2026-06-10

## Current phase

Phase 4 — 6 model providers live. Color system complete.

## Active agents for next session

None pending. Ready for #38 (user-customizable colors) or Wave 2 backend work.

## Last closed (this session)

- #39: Made model accent colors data-driven in InputBar and Sidebar.
  - InputBar: replaced switch/getPillAccentClasses with getPillAccentStyle that uses
    color-mix() on a CSS variable derived from ModelConfig.color — no per-model cases.
  - Sidebar: replaced switch/getModelDotStyle with a MODULE_DOT_CSS_VAR lookup built
    from MODEL_REGISTRY at module load time — no per-model cases.

## Model providers (all on main)

| Model | Default active | Accent token |
|-------|---------------|--------------|
| Claude | yes | accent-claude |
| GPT-5.5 | yes | accent-gpt |
| Gemini | no | accent-gemini |
| Grok | no | accent-grok |
| DeepSeek | no | accent-deepseek |
| Mistral | no | accent-mistral |

## Next issues in priority order

1. [Luma → Arch → Gate → Aria] User-customizable model accent colors (#38) — Luma spec first
2. [Vault] ServerStorageProvider (REST client for self-hosted backend) (#24)
3. [Gate] Backend auth support (session tokens, login/logout) (#25)
4. Self-hosted backend service (Node/Express, Docker Compose) (#26)
5. Open source launch prep (#27)

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
