Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Atlas — real streaming (Anthropic + OpenAI APIs)
- Gate — requiredKeys wiring to active models

## Last closed

- Aria #18 — archive/delete/group management UI in Sidebar.tsx. Per-row three-dot action menu, archive filter toggle, bulk action bar with inline delete confirmation, group assignment input with existing-group suggestions. All 6 mutation callbacks threaded App → AppLayout → Sidebar. Lint and build clean.

## Decisions made this session (#18 Aria)

- `ThreadRow` refactored from `<button>` to a `<div>` wrapper containing a `<button>` for click navigation, a checkbox for bulk selection, and a three-dot trigger. The `<div>` uses CSS `group` for hover-reveal of checkbox and menu trigger.
- `ThreadActionMenu` is a self-contained component with its own `useState` for sub-states (menu / confirm-delete / group-input). Document listener on `mousedown` for outside-click close.
- Archive filter toggle (Active/Archived) lives between the sidebar header and the thread list. Changing tabs clears bulk selection to avoid stale cross-filter selections.
- Bulk action bar appears only when `selectedIds.size > 0`. Delete confirmation is inline in the bar (no `window.confirm`). Archive is immediate (no confirmation).
- Group assignment input pre-fills with the conversation's current `groupId`. Existing group names shown as clickable suggestions below the input. Blank confirm clears the group (`undefined`).
- All 6 store mutations (`archiveConversation`, `unarchiveConversation`, `deleteConversation`, `setConversationGroup`, and bulk wrappers) wired in `App.tsx` as thin `useCallback` pass-throughs — no business logic in App.
- `AppLayout.tsx` updated: 6 new optional props added to `AppLayoutProps`, destructured, and threaded through to `<Sidebar>`.

## Next issues in priority order

1. Atlas — real streaming (Anthropic + OpenAI APIs)
2. Gate — requiredKeys wiring to active models

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null (not void) for missing conversations — callers must null-check before calling downloadExportedConversation
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- handleNewConversation is async (createConversation + then setActiveConversation) — not a concern in practice but worth noting for tests
- ThreadRow is now a `<div>` wrapper (not a `<button>`) — accessible because the inner navigation button keeps keyboard/click semantics for conversation selection
