Last updated: 2026-07-02

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#285 (Atlas + Gate + Vault + Scout + Aria + Ada + Flint)** — Closed. Full file-attachment feature across 4 waves. Flint: PASS.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities. Gate populates on creation and backfills on roster read. Claude/GPT: full vision. Gemini: vision ✓ streamUsage ✗. Grok/DeepSeek/Mistral: vision ✗ (conservative).
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data. Stripping at Atlas dispatch, not at UI layer.
- `Attachment.base64` stored raw (no `data:` prefix) everywhere. Prefix added only at `<img src>` and API boundaries (OpenAI/generic). Anthropic and Gemini expect raw.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception for send-time vision check.
- `includeAttachments` on Vault export defaults false; metadata only (name, mimeType) — no base64 in exports.
- Ada advisories deferred: #318 (aria-live on chips), #319 (Safari file picker focus return), #320 (modal backdrop aria-hidden).

## Open bugs / known issues

- **#316** — Scout: `appendToContext` + shuffle interaction untested (deferred)
- **#317** — Scout: abort mid-shuffle untested (deferred)
- **#318** — Aria: chips list missing `aria-live` (Ada advisory)
- **#319** — Aria: Safari file picker focus return not guaranteed (Ada advisory)
- **#320** — Aria: VisionWarningModal backdrop `aria-hidden` value incorrect (Ada advisory)

## What's next

1. **#318, #319, #320** — Aria: batch all three Ada advisories in one session (Aria + Ada fixed cost)
2. **#316, #317** — Scout: auto-chain regression tests (low priority, non-blocking)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `focus-trap-browser.spec.ts` fails in Vitest — pre-existing Playwright/Vitest misconfiguration, not a regression
- `Attachment.base64` is raw — add `data:<mimeType>;base64,` prefix only at render/API boundary
- `getProviderRoster()` from `@/auth` permitted in `InputBar.tsx` for vision check — documented exception
- `usePreferencesSync` (not `useUserPreferences`) for reactive Gate preferences
- Parallel agent worktrees: `main` may be locked in a stale worktree — check `git worktree list` before checkout
- `BuiltInProviderConfig.capabilities` absence = conservative defaults (`vision: false`) — Gate migration handles old records
- `aria-disabled` not `disabled` for buttons needing tooltip discoverability
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
- `inert` and `aria-hidden` must always be controlled by the same boolean
- `var(--semantic-error)` not `var(--error)` for error colors in inline styles
- `emitErrorChunk` mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks silently dropped
- `updateCustomProvider` clears `capabilities` on omit — always pass full capabilities object from edit form
