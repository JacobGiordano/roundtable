Last updated: 2026-06-09

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

- Gate (#36) -> Aria (#36) — types are locked; both can proceed in sequence

## Last closed

- Arch #36 types prerequisite — TokenCountVisibility type added, UserPreferences interface created

## Decisions made this session (#36 Arch)

- `TokenCountVisibility`: string union `'always' | 'active' | 'never'`
- `UserPreferences`: new interface (was not previously in types file); Gate owns storage, Aria reads
- Default value for `tokenCountVisibility` is `'active'` — matches existing hover-reveal behavior (#16)
- `'never'` means DOM removal, not CSS hide — Aria must branch on this at render time, not with visibility/opacity

## Phase 2 completed so far

- #12 Aria: Interaction mode switcher ✅
- #13 Aria: Per-model system prompt UI ✅
- #14 Atlas: Directed reply routing ✅
- #15 Atlas: Token usage tracking ✅
- #16 Aria: Token usage display ✅
- #11 Aria: Directed reply UI ✅
- #36 Arch: TokenCountVisibility + UserPreferences types ✅ (branch: 36-arch-token-visibility-type)

## Next issue(s)

1. Gate — #36 implement `getUserPreferences()` / `saveUserPreferences()` against `UserPreferences`
2. Aria — #36 consume `tokenCountVisibility` from Gate and conditionally render token counts

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
