Last updated: 2026-07-03

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#324 (Aria + Ada)** — Closed. Both nameplate timestamps in MessageBubble.tsx replaced with `<time dateTime={new Date(message.timestamp).toISOString()}>`. No visual change — purely a semantic/accessibility improvement. Ada confirmed: valid ISO 8601 datetime attribute, human-readable visible text unchanged, no WCAG violations. Ada's test updated to assert the new element type.

**#322 (Luma + Aria + Ada + Flint)** — Closed prior wave. Nameplate bubble redesign shipped. Copy icon went through three iterations post-ship; final version: stroke outline + `color-mix(in srgb, var(--bubble-accent) 12%, var(--surface-card))` fill matching the nameplate background tint.

**#323 (Aria)** — Closed prior wave. ModelVisibilityBar unconditional render fix.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities.
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data.
- `Attachment.base64` stored raw; prefix added only at `<img src>` and API boundaries.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception.
- `includeAttachments` on Vault export defaults false; metadata only.
- Attach button icon: `PhotoIcon` (mountain-in-frame) — not paperclip. Image-only affordance is intentional.
- VisionWarningModal backdrop: remove `aria-hidden` entirely — `aria-modal="true"` on inner panel is the correct suppression mechanism.
- Bubble nameplate: Proposal B selected and shipped. Left-border system fully removed.
- Copy icon: stroke outline + nameplate-matched fill (`color-mix` with `--bubble-accent` 12%) — silhouette/solid approaches were fragile or visually wrong on tinted nameplates.

## Open bugs / known issues

None currently tracked.

## What's next

No queued issues. User to identify next priority.

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
- Scout test setup: `runAutoChain` with `appendToContext` requires `messages: [makeUserMessage(...)]` in the conversation — empty `messages: []` produces invalid assertions
- Bubble tail must be a sibling of the wrapper div (not a child) — wrapper has `overflow-hidden` which clips children that protrude outside
- Copy icon fill: use `color-mix(in srgb, var(--bubble-accent) 12%, var(--surface-card))` — matches nameplate tint; `var(--surface-card)` alone bleeds on error-state nameplates
