Last updated: 2026-06-08

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

Parallel track A (no dependencies):
- Atlas — issue #15 (token usage tracking)
- Aria  — issue #13 (per-model system prompt UI)

Parallel track B (unblocked — Atlas #14 and Aria #12 now merged):
- Aria  — issue #11 (directed reply UI)
- Aria  — issue #16 (token usage display) → needs Atlas #15

## Last closed

- #14 [Atlas] Directed reply routing — sendMessage() now supports three routing modes
- #12 [Aria] Interaction mode switcher UI — InteractionModeSwitcher component

## Decisions made this session

- sendMessage() mode priority: chainConfig > targetModelId > parallel broadcast
- Auto-chain: appendToContext=true steps accumulate into sharedMessages; false steps run against frozen context
- Inactive model in directed/chain mode: emits synthetic error StreamChunk, chain continues (no halt)
- collectingChunkHandler wraps onChunk to capture response text for context injection without blocking UI streaming
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
