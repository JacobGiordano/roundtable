Last updated: 2026-07-28 (CI green — E2E scenario 1 race fix #561)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths
- Bundle audit (wave 29): GREEN vs. wave 27 baseline; lazy boundary working correctly
- KeyIcon redesign (wave 30): axis-aligned paths replace diagonal strokes — diagonal strokes at 13px anti-alias into interlocked-oval artefacts
- Live version picker (#407): fully implemented in wave 26 via `useLiveVersionCatalog` hook — `resolveVersionCatalog` fans out to all registry entries in parallel
- System prompt persistence (#408): seeded from `Conversation.conversationSystemPrompt` on load/switch; persisted via `store.updateConversation()` on edit; ghost guard in place
- Lazy panel boundaries (waves 31 + 31b): index chunk 345 kB → 200 kB raw / 88 → 55 kB gzip across two passes. Wave 31: `ModelSelectorPanel` + `ProviderSettingsPanel`. Wave 31b: `ApiKeyPanel`, `BackendServerPanel`, `ProxySettingsPanel`, `UserAccentColorPicker`, `ProxyOnboardingModal`, `credentialTest` (transitive dep). Remaining index chunk is all critical-path code (App, Sidebar, InputBar, sidebarUtils, ThreadActionMenu, icons) — no further splits available. `ProviderSettingsPanel` uses mount-once guard (`hasEverOpenedProvider`); all other lazy panels are already conditionally rendered. Dev server does not show chunks; verify against `npm run build && npx serve dist`.
- Sidebar min/default width (wave 31): raised from 278/280 → 330 px. Four desktop header icons (ghost + collapse + new + gear) need ~324 px; old default clipped the gear via `overflow-hidden`. Stored values below 330 auto-migrate via `parseStoredWidth` out-of-range guard. If a 5th icon is added, recalculate: 5×32 + 4×4 + logo(152) + padding(32) = 360 px.

## Open issues

None — backlog clear.

## Next up (not yet filed as issues)

None.

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek V4 active — migrated from retired deepseek-chat/reasoner to deepseek-v4-flash/v4-pro (#563)
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode`
- Dev server: restart after all merges — HMR can disrupt in-flight streams
- KeyIcon: use axis-aligned paths — diagonal strokes anti-alias poorly at small sizes
