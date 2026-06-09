Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Vault — issues #20 and #21 (storage persistence, export UI wiring)
- Coda — may sequence Vault #20 + #21 in parallel with Atlas real-streaming work

## Last closed

- Arch #22 — StorageProvider abstraction finalized; Phase 3 unblocked

## Decisions made this session (#22 Arch)

- `exportConversation` signature changed: now returns `Promise<ExportedConversation | null>` instead of `Promise<void>`. It serializes only — no DOM access. Download triggering is a separate `downloadExportedConversation()` utility exported from `/src/storage`. This makes the interface backend-compatible for Phase 4 `ServerStorageProvider`.
- `ExportedConversation` interface added to `/src/types/index.ts`: `{ content: string; filename: string; mimeType: string }`.
- `unarchiveConversation(id: string): Promise<void>` added to `StorageProvider` and implemented in `LocalStorageProvider`. Required for Phase 3 archive/unarchive UI.
- `groupId` update pattern: no dedicated `setConversationGroup` method. Callers update `groupId` on the `Conversation` object and call `saveConversation` (upsert). Documented in interface JSDoc.
- Full JSDoc on every `StorageProvider` method covering contract, ghost-mode behavior, and missing-record behavior.
- 27 unit tests added at `/src/storage/LocalStorageProvider.test.ts` — all pass.
- `downloadExportedConversation()` exported from `/src/storage/index.ts` — Aria calls this after receiving `ExportedConversation` from Vault.

## Downstream impact on Vault (#20, #21)

- `LocalStorageProvider.exportConversation` now returns `ExportedConversation | null` — any caller that previously expected `void` must be updated.
- `unarchiveConversation` is implemented — Vault's UI wiring issues can use it directly.
- `downloadExportedConversation` is the new download trigger — import from `@/storage`.

## Next issues in priority order

1. Vault #20 — wire persistence to real conversations (save/load/list)
2. Vault #21 — export and archive/delete UI
3. Atlas — real streaming (Anthropic + OpenAI APIs)
4. Gate — requiredKeys wiring to active models

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
- exportConversation returns null (not void) for missing conversations — callers must null-check before calling downloadExportedConversation
