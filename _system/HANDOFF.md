Last updated: 2026-06-09

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

- Arch (#36) → Gate → Aria — sequence: Arch types first, Gate wires API key flow, Aria consumes

## Last closed

- #11 [Aria] Directed reply UI — "Reply to [Model]" hover affordance on assistant bubbles,
  directed-mode pill in InputBar, "→ [Model]" label on directed user messages

## Decisions made this session (#11)

- "Reply to [Model]" button: opacity-0 at rest, revealed on hover — shares row with token count
- Directed-reply pill sits above the input row, flush against it (shared bg-input surface);
  uses model accent color (bg-accent/15, text-accent, border-accent/30)
- × on pill returns to broadcast mode; conversation switch also clears the target
- After send, pendingTargetModelId is cleared automatically — single-shot directed mode
- targetModelId stamped onto the user Message at send time; visible as "→ [Model]" label
  below user bubble content (accent-colored text)
- No Arch work needed — Message.targetModelId and SendMessageOptions.targetModelId already
  existed on the type

## Phase 2 completed so far

- #12 Aria: Interaction mode switcher ✅
- #13 Aria: Per-model system prompt UI ✅
- #14 Atlas: Directed reply routing ✅
- #15 Atlas: Token usage tracking ✅
- #16 Aria: Token usage display ✅
- #11 Aria: Directed reply UI ✅

## Next issue(s)

1. Arch — #36 types work (sequence: Arch → Gate → Aria)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
