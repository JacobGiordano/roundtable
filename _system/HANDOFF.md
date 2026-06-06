Last updated: 2026-06-06

## Current phase

Pre-Phase 1 — project not yet scaffolded.

## Status

No work started. Spec and issues finalized. Ready to begin.

## Next issues (in order)

1. Define core interface contracts (`/src/types/index.ts`) — all agents blocked on this
2. Project scaffold and directory structure — blocked on #1
3. Phase 1 issues open in parallel once scaffold is merged:
   - [Aria] Chat interface layout
   - [Atlas] Claude integration
   - [Atlas] GPT-4o integration
   - [Vault] LocalStorage provider
   - [Gate] API key management

## Gotchas

- `/src/types/index.ts` changes require review from all active agents — never modify unilaterally
- Branch naming: `{issue-number}-{agent}-{short-description}` e.g. `3-aria-chat-layout`
- Run all npm commands from project root, not from `src/`
- API keys: never log, never export, never transmit except to the provider's own API
