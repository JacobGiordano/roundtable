Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Vault — issue #21 (export and archive/delete UI wiring)
- Coda — may sequence Vault #21 in parallel with Atlas real-streaming work

## Last closed

- Vault #20 — useConversationStore hook implemented and ready for Aria to consume

## Decisions made this session (#20 Vault)

- `useConversationStore` hook lives at `/src/storage/useConversationStore.ts`.
  Exports `useConversationStore()` and `UseConversationStoreReturn` type (Aria imports these).
- Single `LocalStorageProvider` instance per hook mount, held in a `useRef` — stable for the lifetime of the component.
- Optimistic in-memory updates: React state is updated immediately after each mutation; no full `listConversations()` round-trip per op. State is sorted newest-first by `updatedAt` after every update.
- Ghost-mode guard is the first check on every write path. Ghost conversations are never added to the persisted `conversations` list; callers manage them via `useGhostMode`.
- Auto-title: fires inside `updateConversation` when `conversation.title` is undefined and the conversation has at least one user message. Takes first ~60 chars, trims at last word boundary. Never overwrites an existing title.
- `setConversationGroup` follows the StorageProvider upsert pattern: load, mutate `groupId`, call `saveConversation`. No dedicated storage method needed.
- `getSessionTokenUsage` delegates to Atlas's `getSessionTokenUsage` utility from `@/models` — documented cross-agent exception per CLAUDE.md.
- `UseConversationStoreReturn` extends `ConversationStore`, so it satisfies the interface contract exactly.
- Pre-existing build failure fixed: `LocalStorageProvider.test.ts` used Node's `global` (not in tsconfig lib). Replaced with `globalThis` (ES2020 standard, already in lib). All 27 tests still pass.

## Downstream impact on Vault (#21)

- Aria can now import `useConversationStore` and `UseConversationStoreReturn` from `@/storage`.
- `storageError: Error | null` is exposed — Aria should surface quota/parse errors to the user.
- `isLoading: boolean` is exposed — Aria can show a skeleton during initial load.
- Archive/unarchive/delete are available on the hook — #21 can wire these to UI controls immediately.
- Export remains on `LocalStorageProvider` directly — Aria calls `provider.exportConversation(id, format)` then `downloadExportedConversation(result)` from `@/storage`.

## Next issues in priority order

1. Vault #21 — export and archive/delete UI
2. Atlas — real streaming (Anthropic + OpenAI APIs)
3. Gate — requiredKeys wiring to active models

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- exportConversation returns null (not void) for missing conversations — callers must null-check before calling downloadExportedConversation
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode. The `conversations` array in the store only contains persisted (non-ghost) conversations.
