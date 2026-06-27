Last updated: 2026-06-27 (ship — #308 and #309 closed)

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#308 (Scout)** — Closed. Fixed 13 stale `aria-label` assertions in `provider-settings-panel.test.tsx` after the GPT-5.5 → ChatGPT display name rename (#302). Test file only; no app code changed. Suite: 1586 passed.

**#309 (Gate + Aria)** — Closed. Two-agent wave:
- Gate: Extended `addCustomProvider` / `updateCustomProvider` to accept `capabilities?: ProviderCapabilities`. Added `isValidCapabilities()` validator. 14 new unit tests.
- Aria: Added 4 capability toggles (Vision, Tool use, System prompt, Stream usage) to AddCustomForm and ProviderRow inline edit form. `<fieldset>`/`<legend>` grouping per WCAG 1.3.1.

## Open bugs / known issues

- **#285** — File attachments — deferred. Not core; revisit after Phase 5 design work.
- **#306** — Roving tabindex deviation: Tab visits all three radios; APG expects only checked radio at `tabIndex=0`. Intentional — Manual stays reachable for tooltip discoverability. Advisory.
- **#307** — WCAG 1.4.13 hoverable sub-criterion: `pointer-events-none` on tooltip means pointer cannot move onto tooltip text without it disappearing. Pre-existing. Advisory.
- **#305** — Cross-device export/import (Phase 6+). Deferred.

## Key decisions

- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy — do not import from `@/models`.
- `MAX_COMPLETION_TOKENS_MODELS` Set in `BaseOpenAIProvider` uses resolved model string post-version-selection.
- `GetCredentialsFn` passed as constructor param to `GenericOpenAIProvider` — do not revert to direct `@/auth` import.
- `updateCustomProvider` clears `capabilities` when field is omitted from input — edit form must always pass the full capabilities object back on save.
- `ProviderCapabilities` all fields optional — absence means Atlas uses per-capability defaults; this is intentional.
- `isValidCapabilities()` is forward-compat: unknown fields pass, non-object/non-boolean known fields are rejected and drop the entry.

## What's next

All open issues are either advisory (#306, #307) or deferred (#285, #305). No unblocked work in the queue. Options:
1. Tackle **#305** (cross-device export/import) — Gate + Vault wave, Phase 5/6 boundary.
2. Tackle **#285** (file attachments) — multi-agent, significant scope.
3. File new issues based on current user priorities.

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
- Chip accent pattern: border (40%) + background tint (15%) only — never apply accent as text `color:` on tinted background
- `updateCustomProvider` clears `capabilities` on omit — always pass full capabilities object from edit form
- `ProviderCapabilities` fields: `streamUsage`, `vision`, `toolUse`, `systemPrompt` (all optional booleans)
- `psp-` prefix for stable IDs in ProviderSettingsPanel helper elements
