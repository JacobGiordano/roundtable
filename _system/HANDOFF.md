Last updated: 2026-07-27 (wave 31 shipped — #408 complete)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths
- Bundle audit (wave 29): GREEN vs. wave 27 baseline; lazy boundary working correctly
- KeyIcon redesign (wave 30): axis-aligned paths replace diagonal strokes — diagonal strokes at 13px anti-alias into interlocked-oval artefacts
- Live version picker (#407): fully implemented in wave 26 via `useLiveVersionCatalog` hook — `resolveVersionCatalog` fans out to all registry entries in parallel
- System prompt persistence (#408): seeded from `Conversation.conversationSystemPrompt` on load/switch; persisted via `store.updateConversation()` on edit; ghost guard in place

## Open issues

None — backlog clear.

## Next up (not yet filed as issues)

- Tempo: sourcemap analysis of 344 kB index chunk — `ModelSelectorPanel` / `ProviderSettingsPanel` as lazy-load candidates (~20–40 kB gzip savings)
- Scout: fix pre-existing KeyIcon test failure — `message-bubble-error-tone.test.tsx` uses `circle[cx="5"]` selector, stale after wave 30 axis-aligned redesign

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode`
- Dev server: restart after all merges — HMR can disrupt in-flight streams
- KeyIcon: use axis-aligned paths — diagonal strokes anti-alias poorly at small sizes
