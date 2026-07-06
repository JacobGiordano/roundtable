Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#342 — Persist last-used model roster and interaction mode** — Shipped in 3cb9f64.

Three-agent wave (Arch → Vault + Aria in parallel):
- Arch: `ConversationDefaults`, `GetConversationDefaultsFn`, `SaveConversationDefaultsFn` in types
- Vault: `getConversationDefaults` / `saveConversationDefaults` — localStorage key `"roundtable:conversation-defaults"`
- Aria: `useConversationDefaults` hook + App.tsx wiring (boot, toggle, mode change, new conversation)
- Post-wave fix: `pendingMode` not synced on mode change with active conv, and boot effect skipped mode when active conv present — both patched in 3cb9f64

## Key decisions

- `ConversationDefaults` implemented as standalone exported fns, not `StorageProvider` methods — it's a preferences/settings value like `ThemePreferences`, not a conversation entity
- Ghost mode guard lives in Aria (skip save when `isGhost`), not Vault — Vault has no ghost context
- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS

## Open bugs / known issues

- #343: 2 pre-existing `aria-hidden` failures in `conversation-empty-state.test.tsx` (from #341 refactor) — Scout to fix
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- #343: Scout fixes aria-hidden test failures
- No other open issues — good time for a new issue triage pass

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- `ConversationEmptyState` beacon stagger: 150ms base delay is intentional — clears parent opacity ramp before beacons animate
