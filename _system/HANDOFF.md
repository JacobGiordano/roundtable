Last updated: 2026-06-06

## Current phase

Pre-Phase 1 — interface contracts defined, project not yet scaffolded.

## Last issue closed

Issue #1 — Define core interface contracts. All five contracts defined in
`/src/types/index.ts`. Branch `1-arch-core-interfaces` pending merge.

## Decisions made this session

- `ModelId` typed as a union literal (`'claude' | 'gpt-5.5'`) — extend for Phase 4
- `sendMessage()` is a top-level function type (not a class method); Atlas wires it up
- `ConversationStore` is a read-only interface; Vault owns the implementation (React context or similar)
- `StorageProvider.exportConversation()` included now (Phase 3 feature) so Vault's interface is stable
- `StreamChunk.error` carries model errors inline rather than rejecting, so one model failure doesn't kill the whole broadcast
- `ModelProviderConfig.credentialKey` links each provider to its Gate credential key

## Next issues (in order)

1. Issue #2 — Project scaffold and directory structure (blocked was on #1, now unblocked)
2. Phase 1 issues open in parallel once scaffold is merged:
   - [Aria] Chat interface layout
   - [Atlas] Claude integration
   - [Atlas] GPT-5.5 integration
   - [Vault] LocalStorage provider
   - [Gate] API key management

## Gotchas

- `/src/types/index.ts` changes require review from all active agents — never modify unilaterally
- Branch naming: `{issue-number}-{agent}-{short-description}`
- Run all npm commands from project root, not from `src/`
- API keys: never log, never export, never transmit except to the provider's own API
