Last updated: 2026-06-09

## Current phase

Phase 4 — Wave 2 accent token wiring complete (Aria). Atlas wiring pending.

## Active agents for next session

Arch + Atlas (in that order, or parallel if safe).

## Last closed (this session)

- Aria #37: wired `--accent-grok`, `--accent-deepseek`, `--accent-mistral` into
  `src/index.css` (`:root` fallbacks), `tailwind.config.js` (color entries),
  and `src/ui/theme.ts` (`setProperty` calls).

## Decisions made this session

- `CustomThemeJSON['accents']` in `/src/types/index.ts` does not yet include
  the three new keys. Temporary cast `theme.accents as Record<string, string>`
  used in `theme.ts` to unblock build. Arch must extend the type before the
  cast can be removed.
- Fallback values in `:root` use Midnight theme values (vivid defaults per spec).

## Next issues in priority order

1. [Arch] Extend `CustomThemeJSON['accents']` in `/src/types/index.ts` with
   `model-grok`, `model-deepseek`, `model-mistral` — removes cast in theme.ts
2. [Atlas] Update `src/models/registry.ts` — replace `color: 'accent-other'`
   with correct token names for Grok, DeepSeek, and Mistral entries
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
- theme.ts casts accents as Record<string,string> for wave-2 keys — remove after Arch types update
