Last updated: 2026-06-08

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

All agents unblocked after Arch PR #31 merged.

Parallel track A (no dependencies):
- Atlas — issue #14 (directed reply routing)
- Atlas — issue #15 (token usage tracking)
- Aria  — issue #12 (interaction mode switcher)
- Aria  — issue #13 (per-model system prompt UI)

Parallel track B (depends on Atlas shipping first):
- Aria  — issue #11 (directed reply UI) → needs Atlas #14
- Aria  — issue #16 (token usage display) → needs Atlas #15

## Last closed

- #12 [Arch] Interaction mode switcher types — InteractionModeConfig added
- #14 [Arch] Directed reply routing types — ChainStep, AutoChainConfig, chainConfig on SendMessageOptions
- #15 [Arch] Token usage tracking types — SessionTokenUsage, getSessionTokenUsage() on ConversationStore

## Decisions made this session

- Arch issues #12+#14+#15 batched into single PR (all additive, no conflicts)
- Atlas review caught missing chainConfig on SendMessageOptions — fixed before merge
- ChainStep.appendToContext controls context-feeding in auto-chain sequencer
- AutoChainConfig.maxPasses is the loop-termination guard for Atlas
- getSessionTokenUsage() returns SessionTokenUsage[] — Atlas aggregates, Vault implements, Aria reads

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- Subagents must be prompted to commit before reporting back (learned pattern)
- Aria and Atlas cannot self-review their own PRs on GitHub — agent approvals logged in PR comments only
