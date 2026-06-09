Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Aria — wire export UI: call `exportConversation` from `useConversationStore` then `downloadExportedConversation` from `@/storage`
- Atlas — real streaming (Anthropic + OpenAI APIs)

## Last closed

- Aria #17 — session browser: `useConversationStore` wired into `App.tsx`; group/folder display added to `Sidebar.tsx`. Lint and build clean.
- Vault #21 — markdown + HTML export wiring complete (branch `21-vault-markdown-html-export`, not yet merged)

## Decisions made this session (#17 Aria)

- `MOCK_CONVERSATIONS` removed. `MOCK_MODELS` kept — model selection is Phase 4 territory.
- `useConversationStore` imported at App root (documented cross-agent exception). All conversation state (`conversations`, `activeConversationId`, mutations) now comes from the store.
- `handleSend` builds `updatedConversation` explicitly and calls `store.updateConversation()`. Auto-title fires inside the hook on first send.
- `handleModeChange` and `handleUpdateSystemPrompt` both call `store.updateConversation` instead of local `setConversations`.
- `handleNewConversation` calls `store.createConversation(newConv).then(() => store.setActiveConversation(newConv.id))`.
- `store.isLoading` and `store.storageError` threaded through AppLayout → Sidebar as `isConversationsLoading` / `conversationStoreError`.
- Sidebar loading: 3-row skeleton with `animate-pulse`, nav dims to `opacity-60`. Error: `role="alert"` red text line above settings panel.
- Group display: `groupId`-bearing conversations rendered under collapsible `GroupHeader` buttons (alphabetically sorted groups). Ungrouped last. All groups start open. No rename/drag-drop — deferred Phase 2+.
- Flat view preserved when no groups exist (no regression for ungrouped conversations).

## Decisions made this session (#21 Vault)

- `exportConversation(id, format)` added to `UseConversationStoreReturn` and implemented as pass-through to `provider.exportConversation`. No state mutation.
- `ExportFormat` type re-exported from `/src/storage/index.ts` so Aria can import from `@/storage` directly.
- Model display names in markdown/HTML export resolved from `conv.models` (falls back to `modelId` string, then `'Assistant'`).
- Aria does NOT call `downloadExportedConversation` through the hook — calls `exportConversation` on the store to get the result, then calls `downloadExportedConversation(result)` from `@/storage`.

## Next issues in priority order

1. Aria — wire export controls to `useConversationStore().exportConversation` + `downloadExportedConversation`
2. Atlas — real streaming (Anthropic + OpenAI APIs)
3. Gate — requiredKeys wiring to active models

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null (not void) for missing conversations — callers must null-check before calling downloadExportedConversation
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
- handleNewConversation is async (createConversation + then setActiveConversation) — not a concern in practice but worth noting for tests
