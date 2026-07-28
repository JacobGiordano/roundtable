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
- Lazy panel boundaries (wave 31): `ProviderSettingsPanel` and `ModelSelectorPanel` split into separate chunks; index chunk 345 kB → 237 kB raw / 88 → 64 kB gzip. `ProviderSettingsPanel` uses mount-once guard (`hasEverOpenedProvider`) — chunk defers to first click, panel stays mounted after so close animation works. Dev server does not show chunks; verify lazy loading against `npm run build && npx serve dist`.

## Open issues

None — backlog clear.

## Next up (not yet filed as issues)

- Tempo follow-on: sourcemap analysis of remaining 237 kB index chunk — further lazy-load candidates if any emerge

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
