Last updated: 2026-07-27 (wave 29 merged to local main — pending ship with next Aria wave)

## Current phase

Phase 5 — Full gate process active.

## ⚠️ RESUME STATE — wave 29 pending ship

Wave 29 is merged to local main. No visual check required (test-only changes).

**Blocked on:** pre-existing lint failure in `src/ui/MessageBubble.tsx:743` — unused `eslint-disable` directive left by Aria's wave 28. Aria must fix this before wave 29 can be pushed.

**Plan:** batch the lint fix into the next Aria wave alongside #558 (key icon bug), then ship both waves together.

**Issues to close on ship:** #559

## Wave 29 (merged, pending ship)

- **#559** — Vault: `conversationSystemPrompt` field already persisted via whole-object JSON; 7 tests added
- **#549, #416, #420, #410** — all confirmed already done in prior commits; closed

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths — no system prompt ever leaks into storage from ghost sessions
- Bundle audit: GREEN vs. wave 27 baseline (< 1 kB drift on all chunks); lazy boundary working correctly

## Follow-on issues to file (next session)

- Aria: wire App state ephemeral Map → `conversation.conversationSystemPrompt` on save/load
- Tempo follow-on: sourcemap analysis of 344 kB index chunk — `ModelSelectorPanel` / `ProviderSettingsPanel` as lazy-load candidates (~20–40 kB gzip savings possible)

## Next Aria wave (batch these together)

- Lint fix: remove unused `eslint-disable` at `src/ui/MessageBubble.tsx:743` (wave 28 residue)
- **#558** — fix garbled key icon in API key error bubble header

## Open issues

- #407 — feat(ui): wire live model discovery into version picker (Aria)
- #408 — feat(ui): system prompt support per conversation (Aria + Vault + Arch — large)
- #558 — fix(ui): API key error icon renders as garbled glyph (Aria — next wave)

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
- Ghost bubble root cause (wave 28): ThinkingIndicator timer dep array issue — fixed with refs
