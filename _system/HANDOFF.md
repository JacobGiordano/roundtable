Last updated: 2026-06-08

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

Parallel track A (no dependencies):
- Atlas — issue #14 (directed reply routing)
- Atlas — issue #15 (token usage tracking)
- Aria  — issue #13 (per-model system prompt UI)

Parallel track B (depends on Atlas shipping first):
- Aria  — issue #11 (directed reply UI) → needs Atlas #14
- Aria  — issue #16 (token usage display) → needs Atlas #15

## Last closed

- #12 [Aria] Interaction mode switcher UI — InteractionModeSwitcher component (this session)

## Decisions made this session

- InteractionModeSwitcher is a segmented radiogroup (pill buttons) placed to
  the right of the ModelSelectorPanel trigger chip in AppLayout bottom strip
- Mode is persisted per conversation: onModeChange → setConversations in App.tsx
- Tooltip uses group-hover pattern consistent with ghost mode tooltip in InputBar
- INTERACTION_MODES registry (InteractionModeConfig[]) lives in the component file

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- Subagents must be prompted to commit before reporting back (learned pattern)
- Aria and Atlas cannot self-review their own PRs on GitHub — agent approvals logged in PR comments only
