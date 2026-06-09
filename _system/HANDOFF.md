Last updated: 2026-06-09

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

- Aria — issue #11 (directed reply UI) → Atlas #14 already shipped ✅

## Last closed

- #16 [Aria] Token usage display — hover-reveal per-message count in MessageBubble,
  collapsible per-model session totals (SessionTokenSection) in ModelSelectorPanel

## Decisions made this session

- Per-message token count: opacity-0 at rest, opacity-100 on hover via isHovered state —
  no layout shift; title attribute surfaces input/output breakdown
- Session totals: SessionTokenSection sub-component below System Prompts, collapsed by
  default; header always shows grand total; expanded shows per-model input/output/total rows
- getSessionTokenUsage() imported from @/models in App.tsx — same documented exception
  as sendMessage; sessionUsage is required prop on AppLayout and ModelSelectorPanel
- SessionTokenSection renders null when sessionUsage is empty (no empty-state clutter)

## Phase 2 completed so far

- #12 Aria: Interaction mode switcher ✅
- #13 Aria: Per-model system prompt UI ✅
- #14 Atlas: Directed reply routing ✅
- #15 Atlas: Token usage tracking ✅
- #16 Aria: Token usage display ✅

## Next issue(s)

1. Aria — #11 directed reply UI (unblocked — Atlas #14 shipped)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Phase 2 types already merged (ee8f017) — #11 should not need Arch
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- Message.targetModelId already on the type — #11 can read it directly
