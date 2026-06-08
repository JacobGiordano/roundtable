Last updated: 2026-06-06

## Current phase

Pre-Phase 1 — project not yet scaffolded.

## Active agent for next session

Software Architect — interface contracts issue is first, all others blocked on it.

## Status

No work started. Spec and issues finalized. Ready to begin.
Agency Agents install required before first session (`./scripts/install.sh --tool claude-code`).

## Next issues (in order)

1. Define core interface contracts (`/src/types/index.ts`) — all agents blocked on this
2. Project scaffold and directory structure — blocked on #1
3. Phase 1 issues open in parallel once scaffold is merged:
   - [Aria] Chat interface layout → Frontend Developer
   - [Atlas] Claude integration → Backend Architect
   - [Atlas] GPT-5.5 integration → Backend Architect
   - [Vault] LocalStorage provider → Senior Developer
   - [Gate] API key management → Senior Developer

## Gotchas

- `/src/types/index.ts` changes require review from all active agents — never modify unilaterally
- Branch naming: `{issue-number}-{agent}-{short-description}` e.g. `3-aria-chat-layout`
- Run all npm commands from project root, not from `src/`
- API keys: never log, never export, never transmit except to the provider's own API
- GPT-4o is retired — all references use GPT-5.5 (`gpt-5.5`, `GPT55ModelProvider`)
