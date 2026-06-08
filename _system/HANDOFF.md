Last updated: 2026-06-08

## Current phase

Phase 1 — LocalStorage provider complete.

## Active agent for next session

**Next: activate agents in this order:**
1. Gate — API key management (#10)
2. Atlas — Claude integration (#5)

## Last issue closed

Issue #8 — [Vault] LocalStorage provider. Implemented `LocalStorageProvider`
satisfying the `StorageProvider` interface. Storage layout uses
`roundtable:conv:{id}` per-conversation keys and `roundtable:index` for the
ordered ID list. Ghost-mode conversations are silently bypassed at the save
boundary. QuotaExceededError (all browser spellings) is caught and re-thrown as
a user-readable Error. `exportConversation` triggers a browser download for both
`markdown` and `html` formats. lint + build pass.

## Decisions this session

- Index key: `roundtable:index` (string[]); conversation keys: `roundtable:conv:{id}`
- `listConversations()` skips corrupt/missing entries silently and sorts newest-first by `updatedAt`
- `archiveConversation()` mutates and re-saves the conversation; does not remove it from the index
- `exportConversation()` is a no-op (not a throw) if the conversation is not found — Phase 3 feature
- Ghost mode guard lives in `saveConversation` only; other read/delete operations are not gated

## Cross-agent dependencies (unresolved — carry forward)

1. **Atlas**: Streaming state flag — Aria reads `isStreaming` prop; Atlas must supply via context
2. **Atlas**: Retry method — Aria renders Retry button with `onRetry` callback; Atlas wires re-request
3. **Atlas**: Mid-stream model deactivation — stream completes, then model goes inactive
4. **Gate**: Ghost mode state — Aria reads `isGhostMode` prop; Gate wires toggle

## Next issues (priority order)

1. [Gate] API key management (#10)
2. [Gate] #30
3. [Atlas] Claude integration (#5)
4. [Atlas] GPT integration (#6)
5. [Atlas] #7
6. [Vault] #9
7. [Aria] Model selector (#4) — unblocked after Gate and Atlas land

## Gotchas

- Arch owns `/src/types/index.ts` and `CLAUDE.md` — no other agent touches these
- Single-PR rule for types
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- `src/ui/index.ts` now exports all Phase 1 components
- Markdown rendering inside MessageBubble is deferred — plain text with whitespace-pre-wrap
- `LocalStorageProvider` is exported from `src/storage/index.ts` — ready for Aria/Gate to consume via React context
