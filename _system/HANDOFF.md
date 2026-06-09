Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Atlas — real streaming (Anthropic + OpenAI APIs)
- Gate — requiredKeys wiring to active models

## Last closed

- Aria #18 — archive/delete/group management UI in Sidebar.tsx.
- Aria #19 — export UI: ExportButton + format picker popover, wired to store.exportConversation + downloadExportedConversation. Branch `19-aria-export-ui`, not yet merged.

## Decisions made this session (#19 Aria)

- `ExportButton` is a self-contained component at `/src/ui/ExportButton.tsx`. Owns popover open/close state, outside-click (pointerdown) and Escape-key dismissal.
- Button placed in `MessageThread` header area (top-right, above message list). Rendered only when `onExport` prop is provided. Disabled when `messages.length === 0`.
- `onExport` is optional on `MessageThread`; `onExportConversation` is optional on `AppLayout`. When `store.activeConversationId` is null, `App.tsx` passes `undefined` — button is absent entirely, not just disabled.
- `handleExportConversation` in `App.tsx` is `useCallback`-wrapped async. Calls `store.exportConversation`, null-checks result, then calls `downloadExportedConversation` from `@/storage`. Both are documented cross-agent exceptions.
- HTML export is fully self-contained: the Vault serializer (issue #21) produces a single-file document. No additional UI work needed.

## Next issues in priority order

1. Atlas — real streaming (Anthropic + OpenAI APIs)
2. Gate — requiredKeys wiring to active models
3. Merge `19-aria-export-ui` into main once authorized

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
