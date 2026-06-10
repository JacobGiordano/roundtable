Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 2 model providers complete. Wave 2 accent color tokens complete.

## Active agents for next session

Aria + Atlas (parallel, separate worktrees) to wire accent tokens into CSS/Tailwind/registry.

## Last closed (this session)

- Luma: defined `model-grok`, `model-deepseek`, `model-mistral` accent tokens across all 7
  theme files; wrote spec at `/_design/specs/model-accent-colors-wave2.md`

## Decisions made this session

- Grok: sky/electric blue (~210°) — cold, technical, xAI brand fit
- DeepSeek: royal/cobalt blue (~235°) — distinct from Grok's sky blue, matches DeepSeek brand
- Mistral: rose/warm pink (~345°) — only clean open hue family; French lab cultural fit
- DeepSeek royal blue passes 3:1 (UI components) in all themes; marginally below 4.5:1 on
  dark themes (slate, ash) and in Outrun — documented in spec; recommendation is 14px bold
  pill label. Outrun's `#4060FF` is a known trade-off, intentional.
- Chalk and Linen share identical values (same light-theme adaptation problem, same solution)

## Next issues in priority order

1. [Aria] Wire accent tokens — add `--accent-grok`, `--accent-deepseek`, `--accent-mistral`
   to `src/index.css`; register in `tailwind.config.js`; wire in `src/ui/theme.ts`
2. [Atlas] Update `src/models/registry.ts` — replace `color: 'accent-other'` with correct
   token names for Grok, DeepSeek, and Mistral entries
   NOTE: Aria and Atlas work above can run in parallel (separate worktrees)
3. [Luma → Arch → Gate → Aria] User-customizable model accent colors feature
4. [Vault] ServerStorageProvider (REST client for self-hosted backend)
5. [Gate] Backend auth support (session tokens, login/logout)
6. Self-hosted backend service (Node/Express, Docker Compose)
7. Open source launch prep

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
- DeepSeek model-deepseek accent is ~3.4:1 in Outrun — known trade-off per spec, bold label required
