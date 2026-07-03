Last updated: 2026-07-03

## Current phase

Phase 5 — Full gate process active.

## Session summary

**README update (Quill)** — Closed. Rewrote the Features section to reflect Phase 5 state: 9 items → 23 items across 5 groups (conversation modes, messages, models & providers, conversations, UI & setup). Corrected Node requirement (20+ → 24+), fixed theme description (no high-contrast mode exists), added Docker registry note for backend image.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities.
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data.
- `Attachment.base64` stored raw; prefix added only at `<img src>` and API boundaries.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception.
- `includeAttachments` on Vault export defaults false; metadata only.
- Attach button icon: `PhotoIcon` (mountain-in-frame) — not paperclip. Image-only affordance is intentional.
- VisionWarningModal backdrop: remove `aria-hidden` entirely — `aria-modal="true"` on inner panel is the correct suppression mechanism.
- Bubble nameplate: Proposal B selected and shipped. Left-border system fully removed.
- Copy icon + nameplate tint: `color-mix(in srgb, var(--bubble-accent) var(--nameplate-tint), var(--surface-card))` — tint percentage is now theme-aware via `--nameplate-tint`.
- `--nameplate-tint` set in `applyTheme()` via `theme.mode`: 18% dark, 16% light. New themes automatically inherit correct value based on mode.
- Colored perimeter stroke on bubbles: rejected by Luma. Redundant with nameplate, conflicts with streaming indicator bottom-edge signal, error-state color collision, breaks bubble tail join, degrades on Outrun/Linen/Chalk.

## Open bugs / known issues

- `playwright.a11y.config.ts` `testDir` points at `src/tests/a11y/keyboard/` which now has no `.spec.ts` files — config is idle but harmless.

## What's next

No queued issues. User to identify next priority.

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
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
- Scout test setup: `runAutoChain` with `appendToContext` requires `messages: [makeUserMessage(...)]` in the conversation — empty `messages: []` produces invalid assertions
- Bubble tail must be a sibling of the wrapper div (not a child) — wrapper has `overflow-hidden` which clips children that protrude outside
- Copy icon fill: use `color-mix(in srgb, var(--bubble-accent) var(--nameplate-tint), var(--surface-card))` — error-state nameplate uses `--semantic-error` at 12% and is intentionally separate
