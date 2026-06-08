Last updated: 2026-06-08

## Current phase

Phase 1 — COMPLETE. All 9 Phase 1 issues shipped.

## Active agent for next session

**Next: Coda — Phase 2 kickoff**
Check Arch issues (#12, #14, #15) — Phase 2 requires type changes before agents can build.
Arch must go first (single-PR rule).

## Last issues closed

- #7 [Atlas] Parallel broadcast — Promise.allSettled + runProviderIsolated, one failure never kills others
- #4 [Aria] Model selector panel — ModelSelectorPanel above InputBar, shake UX on last-active guard, prefers-reduced-motion

## Phase 1 complete — all shipped

#3 Aria chat layout · #4 Aria model selector · #5 Atlas Claude · #6 Atlas GPT-5.5
#7 Atlas parallel broadcast · #8 Vault LocalStorage · #9 Vault ghost mode
#10 Gate API keys · #30 Gate theme storage

## Phase 2 issues (priority order)

Arch first (type changes required before any agent builds):
1. [Arch] #12 — Interaction mode switcher types
2. [Arch] #14 — Directed reply routing types
3. [Arch] #15 — Token usage tracking types

After Arch PRs merge, agents unblock in parallel:
4. [Atlas] Directed reply routing (#14 dependency)
5. [Atlas] Token usage tracking (#15 dependency)
6. [Aria] Directed reply UI (#11, needs Atlas #14)
7. [Aria] Interaction mode switcher (#12 dependency)
8. [Aria] Per-model system prompt UI (#13)
9. [Aria] Token usage display (#16, needs Atlas #15)

## Gotchas

- Single-PR rule on types/index.ts — Arch issues must not overlap
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- Subagents must be prompted to commit before reporting back (learned pattern this session)
