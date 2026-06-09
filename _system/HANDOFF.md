Last updated: 2026-06-09

## Current phase

Phase 3 — IN PROGRESS

## Active agents for next session

- Aria — wire export UI: call `exportConversation` from `useConversationStore` then `downloadExportedConversation` from `@/storage`
- Atlas — real streaming (Anthropic + OpenAI APIs)

## Last closed

- Vault #21 — markdown + HTML export wiring complete (branch `21-vault-markdown-html-export`, not yet merged)

## Decisions made this session (#21 Vault)

- `exportConversation(id, format)` added to `UseConversationStoreReturn` interface and implemented in `useConversationStore` hook as a pure delegation to `provider.exportConversation(id, format)`. No state mutation — read-only pass-through.
- `ExportFormat` type re-exported from `/src/storage/index.ts` so Aria can import it from `@/storage` without reaching into `@/types` directly.
- `conversationToMarkdown` updated: looks up display name from `conv.models` by `modelId` (falls back to `modelId` string, then to `'Assistant'`). Exports now say "Claude" not "claude".
- Same display name lookup applied to `conversationToHtml` for consistency.
- Aria does NOT call `downloadExportedConversation` through the hook — the download trigger is a DOM concern. Aria calls `useConversationStore().exportConversation(id, format)` to get the result, then calls `downloadExportedConversation(result)` imported from `@/storage`.

## Lint/build note for next session

`src/ui/Sidebar.tsx` has an uncommitted working-tree modification (unused `useMemo` import) from in-progress Aria work. This causes `npm run lint` and `npm run build` to fail on the full project. Vault's storage files pass lint and TypeScript cleanly. Aria must fix the `useMemo` import before any merged PR can have clean build/lint.

## Next issues in priority order

1. Aria — wire export controls to `useConversationStore().exportConversation` + `downloadExportedConversation`
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
