Last updated: 2026-07-02

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#316, #317 (Scout)** — Closed. Two regression tests added to `/src/tests/regression/auto-chain-shuffle-ordering.test.ts`. #316: asserts `sharedMessages` grows in shuffled step order under `appendToContext: true`. #317: asserts abort signal stops chain at correct shuffled step. 1752 passing (was 1750).

**#318, #319, #320 (Aria + Ada + Flint)** — Closed prior. aria-live on chips, Safari focus return, VisionWarningModal backdrop aria-hidden removed.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities.
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data.
- `Attachment.base64` stored raw; prefix added only at `<img src>` and API boundaries.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception.
- `includeAttachments` on Vault export defaults false; metadata only.
- Attach button icon: `PhotoIcon` (mountain-in-frame) — not paperclip. Image-only affordance is intentional.
- VisionWarningModal backdrop: remove `aria-hidden` entirely — do not set to `"true"`. `aria-modal="true"` on the inner panel is the correct suppression mechanism.
- Bubble presentation redesign: Nameplate (Proposal B) selected. Luma → Aria wave queued as #322.

## Open bugs / known issues

- **#323** — Aria: ModelVisibilityBar missing on new conversation (pre-existing, unconfirmed regression)

## What's next

1. **#322** — Luma + Aria + Ada: Nameplate bubble redesign (Luma spec first, then Aria implements)
2. **#323** — Aria: investigate ModelVisibilityBar on new conversation

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `focus-trap-browser.spec.ts` fails in Vitest — pre-existing Playwright/Vitest misconfiguration, not a regression
- `Attachment.base64` is raw — add `data:<mimeType>;base64,` prefix only at render/API boundary
- `getProviderRoster()` from `@/auth` permitted in `InputBar.tsx` for vision check — documented exception
- `usePreferencesSync` (not `useUserPreferences`) for reactive Gate preferences
- `BuiltInProviderConfig.capabilities` absence = conservative defaults (`vision: false`)
- `aria-disabled` not `disabled` for buttons needing tooltip discoverability
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
- `inert` and `aria-hidden` must always be controlled by the same boolean
- `var(--semantic-error)` not `var(--error)` for error colors in inline styles
- `emitErrorChunk` mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks silently dropped
- `updateCustomProvider` clears `capabilities` on omit — always pass full capabilities object from edit form
- Textarea baseline: `py-[3px]` is intentional — counteracts browser-default top padding variance across Chrome/Firefox/Safari
- VisionWarningModal backdrop: `aria-hidden="true"` hides the dialog subtree — always omit the attribute entirely on the backdrop
- Scout test setup: `runAutoChain` with `appendToContext` requires `messages: [makeUserMessage(...)]` in the conversation — empty `messages: []` produces invalid assertions (App.tsx pre-appends the user message before calling)
