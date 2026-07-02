Last updated: 2026-07-02

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#313 (Atlas + Scout)** — Closed. Fisher-Yates shuffle added to `runAutoChain` in `sendMessage.ts` — each pass now iterates over `shuffleArray(steps)` independently. 5 regression tests added in `/src/tests/regression/auto-chain-shuffle-ordering.test.ts`. Flint: PASS.

**#285 Wave 1 (Arch)** — Types landed. `Attachment` interface, `Message.attachments?`, `SendMessageOptions.attachments?`, and `BuiltInProviderConfig.capabilities?` all in `/src/types/index.ts`. Wave 2 unblocked.

## Key decisions

- `BuiltInProviderConfig.capabilities?: ProviderCapabilities` added — symmetric with `CustomProviderConfig`. Gate populates it from BUILTIN_META for all 6 built-ins (+ migration on roster read). Aria checks `config.capabilities?.vision` uniformly across both provider kinds for the pre-send warning.
- **Wave 2 is Atlas + Vault + Gate in parallel** (Gate added — must populate `capabilities` on built-ins before Aria can show vision warning correctly).
- `usePreferencesSync` is the correct hook for reactive Gate preferences — do not use `useUserPreferences()` in App.tsx.
- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy — do not import from `@/models`.

## Open bugs / known issues

- **#316** — Scout: `appendToContext` + shuffle interaction untested (deferred, not a blocker)
- **#317** — Scout: abort mid-shuffle untested (deferred, low risk)

## What's next

1. **#285 Wave 2** — Atlas + Vault + Gate in parallel. Atlas: extend provider formatters for image content parts, read `capabilities.vision` per-provider. Vault: add `includeAttachments` export flag. Gate: populate `capabilities` in BUILTIN_META for all 6 built-ins, migrate existing `BuiltInProviderConfig` records on roster read.
2. **#285 Wave 3** — Aria: all UI (attach button, drag-drop, clipboard paste, thumbnail chips, pre-send warning modal).
3. **#285 Wave 4** — Ada + Flint gate.

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
- `readJSONFile()` resolves `null` on user cancel — always null-check before passing to `importSetup`
- `importSetup()` accepts `unknown` not `SetupExport` — internal validation; pass raw parsed JSON directly
- `usePreferencesSync` (not `useUserPreferences`) for any reactive preference reads in UI components
- `Attachment.base64` is raw — no `data:` URL prefix; providers must prepend `data:<mimeType>;base64,` when needed
- `BuiltInProviderConfig.capabilities` is optional — absence = conservative defaults (`vision: false`); Gate must populate for all 6 built-ins on roster init + migrate existing records
