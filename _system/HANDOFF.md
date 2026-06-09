Last updated: 2026-06-09

## Current phase

Phase 3 — COMPLETE. Ready for Phase 4.

## Active agents for next session

None pending. All Phase 3 branches merged to main.

## Last closed

- Arch — added `error?: ModelError` to `Message` interface (`feat(types): add error field to Message for streaming error propagation`)
- Aria — wired streaming error display in MessageBubble; propagates `chunk.error` → `Message.error` in App.tsx; threaded through MessageThread (`feat(ui): wire streaming error display — inline error in message bubble`)

## Decisions made this session

- `error?: ModelError` is optional (not `| null`) — absence means no error, avoids null noise at every construction site.
- Error indicator uses ⚠ (`&#9888;`) with `aria-hidden` — screen readers read only the message text.
- When partial content exists, error block separated with `border-t border-border-subtle + mt-3 pt-2` to signal terminal state.
- When stream fails immediately (no content), error uses `mt-1` only.

## Next issues in priority order (Phase 4 — Expansion)

1. [Atlas] Add Gemini (Google) ModelProvider
2. [Atlas] Add Grok (xAI) ModelProvider
3. [Atlas] Central model registry
4. [Vault] ServerStorageProvider (REST client for self-hosted backend)
5. [Gate] Backend auth support (session tokens, login/logout)
6. Self-hosted backend service (Node/Express, Docker Compose)
7. Open source launch prep (README, CONTRIBUTING, LICENSE, templates)

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- downloadExportedConversation and useConversationStore both from @/storage — documented exceptions, used only in App.tsx
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks (no logic)
- exportConversation returns null for missing conversations — always null-check before calling downloadExportedConversation
- ThreadRow is a `<div>` wrapper (not a `<button>`) — accessible because inner navigation button keeps keyboard/click semantics
- useConversationStore does NOT manage ghost conversations — those go through useGhostMode
