Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Merge `aria-wire-required-keys` into main (Aria, awaiting authorization)
- Merge `gate-required-keys` into main (Gate, awaiting authorization)
- Merge `streaming-wiring-aria` into main (awaiting authorization)
- Merge `aria-stream-error-display` into main (Aria, awaiting authorization)

## Last closed

- Aria — streaming error display (branch `aria-stream-error-display`)
  Wired chunk.error -> Message.error in App.tsx streaming handler.
  Threaded message.error as error prop in MessageThread -> MessageBubble.
  Error renders inline below any partial content with a warning icon; separated
  by a subtle border when partial content is present.

## Decisions made this session

- Error stored on Message.error at stream finalization in App.tsx; passed as
  MessageBubble error prop from MessageThread via message.error.
- When message has partial content, error block is separated with border-t
  border-border-subtle + mt-3 pt-2 to signal terminal state.
- When message has no content (stream failed immediately), error uses mt-1 only.
- Warning icon uses &#9888; (Unicode triangle warning) with aria-hidden so
  screen readers only announce the message text.

## Next issues in priority order

1. Merge `gate-required-keys` into main (Gate, awaiting authorization)
2. Merge `aria-wire-required-keys` into main (Aria, awaiting authorization)
3. Merge `streaming-wiring-aria` into main (awaiting authorization)
4. Merge `19-aria-export-ui` into main (awaiting authorization)
5. Merge `aria-stream-error-display` into main (Aria, awaiting authorization)

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
