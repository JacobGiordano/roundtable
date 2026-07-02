Last updated: 2026-07-01

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#314 (Scout)** — Closed. Integration test for `usePreferencesSync`. 9 tests: reactive update without remount, multiple-subscriber fan-out, subscriber cleanup, `_patched` guard, fast-path equality short-circuit. Key gotcha: jsdom `localStorage` is Proxy-backed — `_patchLocalStorage()` is a no-op in jsdom (not a production bug). Workaround: `vi.resetModules()` + plain-object Storage mock per test. Flint: PASS.

## Open bugs / known issues

- **#285** — File attachments. Fully specced (2026-06-28). Ready to fire.
- **#313** — Auto-chain non-linear ordering. Atlas only. Defer until after #285.
- **#315** — ProviderSettingsPanel sub-section labels should use heading elements. Aria + Ada. Small.

## Key decisions

- `usePreferencesSync` is the correct hook for any UI component that needs reactive Gate preferences — do not use `useUserPreferences()` in App.tsx or context providers.
- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy — do not import from `@/models`.
- `importSetup()` accepts `unknown` (not `SetupExport`) — Gate validates shape at runtime.
- `readJSONFile()` cancel resolves `null`, not rejection — always check for null before passing to `importSetup`.
- `SETUP_SCHEMA_VERSION = 1` in `/src/auth/setupExport.ts` — increment on any backward-incompatible shape change; requires new types PR per single-PR rule.
- Aria imports `exportSetup`/`importSetup` from `@/auth` and `downloadJSON`/`readJSONFile` from `@/storage` — documented cross-agent exceptions.
- jsdom `localStorage` is Proxy-backed — `_patchLocalStorage()` style patching is a no-op in test env; use `vi.resetModules()` + plain-object Storage mock.

## What's next

1. **#285** (file attachments) — Arch → Atlas + Vault (parallel) → Aria → Ada. Large wave; needs fresh usage window.
2. **#315** (heading elements in ProviderSettingsPanel) — Aria + Ada. Small; good warm-up wave.
3. **#313** (auto-chain non-linear) — Atlas only. Can run solo.

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
