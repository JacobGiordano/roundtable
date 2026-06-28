Last updated: 2026-06-28

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#311 (Gate)** — Closed. Bug fix: `testCustomCredential` was probing `<endpointUrl>/models`, but `endpointUrl` is the full chat completions URL — so the probe hit `.../chat/completions/models` → 404. Fix: strip trailing `/chat/completions` before building probe URL (one-liner regex in `credentialTest.ts`). 6 new test cases added. Suite: 1605 passed.

## Open bugs / known issues

- **#305** — Cross-device export/import. Fully specced (plaintext JSON, Gate + Vault + Aria wave). Deferred pending weekly usage reset.
- **#285** — File attachments. Fully specced (2026-06-28). Deferred pending weekly usage reset.

## Key decisions

- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy — do not import from `@/models`.
- `MAX_COMPLETION_TOKENS_MODELS` Set in `BaseOpenAIProvider` uses resolved model string post-version-selection.
- `GetCredentialsFn` passed as constructor param to `GenericOpenAIProvider` — do not revert to direct `@/auth` import.
- `updateCustomProvider` clears `capabilities` when field is omitted from input — edit form must always pass the full capabilities object back on save.
- `ProviderCapabilities` all fields optional — absence means Atlas uses per-capability defaults; this is intentional.
- `isValidCapabilities()` is forward-compat: unknown fields pass, non-object/non-boolean known fields are rejected and drop the entry.
- `testCustomCredential` strips `/chat/completions` from `endpointUrl` before probing `/models` — `endpointUrl` is the full URL and must not have `/models` appended naively.

## What's next

Both issues are deferred pending weekly usage reset. Both are fully specced and ready to fire:
1. **#305** (cross-device export/import) — Gate + Vault + Aria wave. Fire first; smaller scope.
2. **#285** (file attachments) — Arch → Atlas + Vault (parallel) → Aria → Ada → Flint. Larger wave.

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- `tabIndex={-1}` elements: `focus:outline-none focus:bg-hover` only — no ring
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
- `inert` attribute: `isClosed ? '' : undefined`
- `inert` and `aria-hidden` must always be controlled by the same boolean — keep in sync
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
- `aria-disabled` not `disabled` for buttons that need tooltip discoverability via keyboard
- jsdom `DOMException` does not extend `Error` — always duck-type AbortError: `err?.name === 'AbortError'`
- Vault cache is in `LocalStorageProvider` instance scope — tests that create fresh instances always start cold
- `emitErrorChunk` is mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks are silently dropped by `useStreamingMessages`
- `sentConversationRef` in App.tsx: set synchronously before `sendMessage()`, read in `handleMessageComplete` — never replace with `store.getActiveConversation()` in that callback
- `credentialTest.ts` `ANTHROPIC_TEST_BASE` must mirror `ANTHROPIC_API_BASE` in `claude.ts` — same three-tier fallback
- `isCustomProviderReady(config)` is the correct readiness check for custom providers — `hasCredential` alone returns false for intentionally keyless providers
- `accents.user` custom theme validator: key is now required in `accents` object — custom themes pre-dating #279 need `"user": "<hex>"` added
- `resolveAccentCssColor(token, modelId?)` exported from `src/ui/utils/modelColor.ts`
- `sanitizeCustomAccentId(id)` in `src/ui/utils/modelColor.ts` — single source of truth for `custom:*` → CSS ident
- `applyRosterAccentColors(roster)` must be called at boot, theme switch, and roster change
- `var(--error)` does not exist — use `var(--semantic-error)` in inline styles
- Custom endpoint `endpointUrl` in `generic.ts` is the full URL including path — provider posts directly to it
- `testCustomCredential` strips `/chat/completions` suffix before probing `/models` — do not change without updating `generic.ts` contract
- Chip accent pattern: border (40%) + background tint (15%) only — never apply accent as text `color:` on tinted background
- `updateCustomProvider` clears `capabilities` on omit — always pass full capabilities object from edit form
- `ProviderCapabilities` fields: `streamUsage`, `vision`, `toolUse`, `systemPrompt` (all optional booleans)
- `psp-` prefix for stable IDs in ProviderSettingsPanel helper elements
