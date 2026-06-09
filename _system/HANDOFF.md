Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Merge `aria-wire-required-keys` into main (Aria, awaiting authorization)
- Merge `gate-required-keys` into main (Gate, awaiting authorization)
- Merge `streaming-wiring-aria` into main (awaiting authorization)

## Last closed

- Aria — wire `requiredKeys` prop in `Sidebar.tsx` (branch `aria-wire-required-keys`)
  Added `getRequiredCredentialKeys` import from `@/auth`, derived `requiredKeys` from
  active conversation's models, passed as prop to `<ApiKeyPanel requiredKeys={requiredKeys} />`.

## Decisions made this session

- `requiredKeys` derivation lives at Sidebar component body scope (before `return`), not
  inside JSX — keeps it a plain expression, avoids inline derivation in render.
- Import documented as Gate cross-agent permitted exception per CLAUDE.md.

## Next issues in priority order

1. Merge `gate-required-keys` into main (Gate, awaiting authorization)
2. Merge `aria-wire-required-keys` into main (Aria, awaiting authorization)
3. Merge `streaming-wiring-aria` into main (awaiting authorization)
4. Merge `19-aria-export-ui` into main (awaiting authorization)

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
