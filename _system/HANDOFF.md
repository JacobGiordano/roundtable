Last updated: 2026-06-09

## Current phase

Phase 2 — COMPLETE

## Active agents for next session

- Coda or Atlas — Phase 3 kickoff (backend / persistence / export)

## Last closed

- Aria #36 — tokenCountVisibility preference consumed and applied throughout UI

## Decisions made this session (#36 Aria)

- `useUserPreferences()` called once at App root; `tokenCountVisibility` threaded as a prop through AppLayout → MessageThread → MessageBubble and AppLayout → ModelSelectorPanel → SessionTokenSection
- `'never'`: DOM removal (null return / conditional render) — not CSS hidden — in both MessageBubble token count and SessionTokenSection
- `'always'`: bottom row in MessageBubble is always visible (no hover required); SessionTokenSection still collapsible but counts visible when expanded
- `'active'` (default): existing hover-reveal behavior preserved unchanged
- Settings panel added to Sidebar bottom: collapsible, houses ApiKeyPanel + TokenCountControl from Gate
- ApiKeyPanel mounted without `requiredKeys` prop (no active-model key enforcement yet — that can be wired in Phase 3 when models are real)
- No new dependencies introduced

## Phase 2 completed

- #12 Aria: Interaction mode switcher ✅
- #13 Aria: Per-model system prompt UI ✅
- #14 Atlas: Directed reply routing ✅
- #15 Atlas: Token usage tracking ✅
- #16 Aria: Token usage display ✅
- #11 Aria: Directed reply UI ✅
- #36 Arch: TokenCountVisibility + UserPreferences types ✅
- #36 Gate: preferences storage + useUserPreferences hook + TokenCountControl UI ✅
- #36 Aria: tokenCountVisibility rendering + settings panel ✅

## Next issue(s)

1. Phase 3 kickoff — Coda to sequence: Vault (storage/persistence), Atlas (real streaming), Gate (requiredKeys wiring), Aria (export UI, archive/delete UI)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- Phase 3 types will need Arch review before any agent starts implementation
