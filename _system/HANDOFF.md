Last updated: 2026-06-08

## Current phase

Phase 2 — IN PROGRESS. Arch PR open; all agents blocked until merge.

## Active agent for next session

**After Arch PR merges:** Atlas and Aria unblock in parallel (see priority order below).

## Last issue closed

Arch #12 / #14 / #15 — Phase 2 type additions PR opened (branch: 12-14-15-arch-phase2-types).

## Decisions made this session

- `InteractionModeConfig` added — display metadata for mode-switcher UI (Aria #12 / #7).
- `ChainStep` + `AutoChainConfig` added — cross-agent contract for auto-chain sequencing (Atlas #14).
- `SessionTokenUsage` added — per-model running totals shape (Atlas #15 / Aria #16).
- `ConversationStore.getSessionTokenUsage()` method signature added — Vault implements, Aria reads.
- `ChainStep.appendToContext` boolean controls whether a model's response feeds the next step.
- `AutoChainConfig.maxPasses` caps runaway chains at the type level.
- Atlas standalone `getSessionTokenUsage()` from @/models remains a documented exception.

## Phase 2 priority order (after Arch PR merges)

1. [Atlas] Directed reply routing (#14) — SendMessageOptions.targetModelId + auto-chain sequencing
2. [Atlas] Token usage tracking (#15) — parse + aggregate SessionTokenUsage, expose getSessionTokenUsage()
3. [Aria] Interaction mode switcher (#12) — InteractionModeConfig registry + switcher UI
4. [Aria] Per-model system prompt UI (#13)
5. [Aria] Directed reply UI (#11) — depends Atlas #14
6. [Aria] Token usage display (#16) — depends Atlas #15

## Gotchas

- Single-PR rule on types/index.ts — Arch PR must merge before any agent starts implementation
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- Subagents must be prompted to commit before reporting back (learned pattern this session)
