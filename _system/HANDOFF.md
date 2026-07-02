Last updated: 2026-07-02

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#318, #319, #320 (Aria + Ada + Flint)** — Closed. Three Ada advisories from Wave 3 batched in one session. aria-live on chips list, Safari focus return after file picker, VisionWarningModal backdrop aria-hidden removed. Ada: PASS (caught #320 naive fix — aria-hidden="true" would hide dialog subtree; correct fix is attribute removal). Flint: PASS.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities.
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data.
- `Attachment.base64` stored raw; prefix added only at `<img src>` and API boundaries.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception.
- `includeAttachments` on Vault export defaults false; metadata only.
- Attach button icon: `PhotoIcon` (mountain-in-frame) — not paperclip. Image-only affordance is intentional.
- VisionWarningModal backdrop: remove `aria-hidden` entirely — do not set to `"true"`. `aria-modal="true"` on the inner panel is the correct suppression mechanism.
- Bubble presentation redesign: Luma exploring alternatives to 3px left-border pattern. Three proposals (Tinted Field, Nameplate, Chromatic Label) under review. No spec changes yet — awaiting user direction after mockups.

## Open bugs / known issues

- **#316** — Scout: `appendToContext` + shuffle interaction untested (deferred)
- **#317** — Scout: abort mid-shuffle untested (deferred)
- **Model row on new chat** — ModelVisibilityBar only renders with 2+ active models; may not appear on fresh conversation. Pre-existing, unconfirmed regression. Investigate before next Aria session.

## What's next

1. **Bubble redesign** — Luma mockups in review; user to pick direction, then Arch (if types change) + Aria to implement
2. **#316, #317** — Scout: regression tests (low priority, non-blocking)

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
