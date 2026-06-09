Last updated: 2026-06-09

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

- Aria (#36) — consume `tokenCountVisibility` from Gate and conditionally render token counts

## Last closed

- Gate #36 — getUserPreferences / saveUserPreferences / useUserPreferences / TokenCountControl implemented

## Decisions made this session (#36 Gate)

- Storage key: `'roundtable_user_preferences'` in localStorage (separate from `'roundtable:theme'` and `'rt_key_*'`)
- Default: `{ tokenCountVisibility: 'active' }` — matches #16 hover-reveal behavior
- `useUserPreferences()` returns `[UserPreferences, (prefs: UserPreferences) => void]` tuple
- `TokenCountControl` is a segmented button (not dropdown); labels: "Always" / "On tap" / "Never"
- "On tap" maps to `'active'` — accurate on mobile, acceptable on desktop
- Aria mounts `TokenCountControl` in the settings panel next to `ApiKeyPanel`
- Aria reads `tokenCountVisibility` via `useUserPreferences()` imported from `@/auth`

## Phase 2 completed so far

- #12 Aria: Interaction mode switcher ✅
- #13 Aria: Per-model system prompt UI ✅
- #14 Atlas: Directed reply routing ✅
- #15 Atlas: Token usage tracking ✅
- #16 Aria: Token usage display ✅
- #11 Aria: Directed reply UI ✅
- #36 Arch: TokenCountVisibility + UserPreferences types ✅
- #36 Gate: preferences storage + useUserPreferences hook + TokenCountControl UI ✅

## Next issue(s)

1. Aria — #36 consume `tokenCountVisibility` via `useUserPreferences()` from `@/auth`, conditionally render token counts (`'never'` = DOM removal, not CSS hide)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- `'never'` means DOM removal, not CSS hide — Aria must branch on this at render time
