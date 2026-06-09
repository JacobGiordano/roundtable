Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Gate — requiredKeys wiring to active models

## Last closed

- Aria — streaming wiring (branch `streaming-wiring-aria`, not yet merged)
  Chunk handler wired: parallel streaming, per-model accumulation, store write on isDone.

## Decisions made this session (Aria streaming wiring)

- Accumulator pattern: `accumulatorRef` (React ref) holds in-flight messages keyed by
  `${conversationId}:${modelId}`. Used inside chunk callback to avoid stale closure.
  `streamingMessages` (React state) mirrors ref to trigger renders.
- Store writes only on `isDone: true` — no localStorage write per chunk.
- `isDone` guard: reads `store.getActiveConversation()` at finalization time, guards with
  `currentConv.id === sendingConversationId` to handle user switching conversations mid-stream.
- `chunk.error` is NOT stored on `Message` — `Message` has no error field in the type
  contract. Error display on streaming messages deferred; requires Arch to add `error?` to `Message`.
- `streamingMessages` prop added to `AppLayout` and `MessageThread`. Rendered after persisted
  messages in a merged `allMessages` array. Auto-scroll useEffect now depends on both.
- `MessageBubble` already had `isStreaming` support (blinking cursor, streaming-shimmer). No changes needed.
- Branch `19-aria-export-ui` from prior session still unmerged — needs authorization.

## Next issues in priority order

1. Merge `streaming-wiring-aria` into main once authorized
2. Merge `19-aria-export-ui` into main once authorized (from prior session)
3. Gate — requiredKeys wiring to active models

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- downloadExportedConversation and useConversationStore both from @/storage — documented exceptions, used only in App.tsx
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null for missing conversations — always null-check before calling downloadExportedConversation
- AppLayout.tsx has archive/delete/group props from issue #18 (prior session) — pre-existing in working tree
- ThreadRow is a `<div>` wrapper (not a `<button>`) — accessible because inner navigation button keeps keyboard/click semantics
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- chunk.error on StreamChunk cannot be attached to Message (no field) — needs Arch PR to unblock streaming error display
