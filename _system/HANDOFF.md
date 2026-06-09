Last updated: 2026-06-09

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

- Aria  — issue #11 (directed reply UI) → needs Atlas #14
- Aria  — issue #12 (interaction mode switcher) — no Atlas dependency

## Last closed

- #16 [Aria] Token usage display — hover-reveal per-message count in MessageBubble,
  collapsible per-model session totals in ModelSelectorPanel (Token usage section)

## Decisions made this session

- Per-message token count: opacity-0 by default, opacity-100 on mouseover via
  useState(isHovered) on the bubble div — no layout shift, no always-on clutter
- tooltip via `title` attribute: shows input/output breakdown on hover
- Session totals: new SessionTokenSection sub-component in ModelSelectorPanel,
  placed below System Prompts, collapsed by default, header always shows grand
  total as a summary; expanded view shows per-model input/output/total rows
- getSessionTokenUsage() imported from @/models in App.tsx — same documented
  cross-agent exception as sendMessage
- sessionUsage prop is an empty array when no token data exists; SessionTokenSection
  renders null in that case (no empty-state clutter)
- AppLayout.sessionUsage is a required prop (not optional) — keeps the call site honest

## Next issue(s)

1. Aria — #11 directed reply UI (needs Atlas #14 to ship first)
2. Aria — #12 interaction mode switcher (no Atlas dependency, can run in parallel)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- Atlas #14 (directed reply routing) is a hard dependency for Aria #11
