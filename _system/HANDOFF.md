Last updated: 2026-07-02

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#321 (Luma + Aria + Ada + Flint)** — Closed. PhotoIcon replaces PaperclipIcon on the attach button. Attach button reordered left of textarea. Textarea baseline aligned with buttons via `py-[3px]`. Touch target confirmed WCAG 2.5.5. Tooltip re-anchored left. Ada: PASS. Flint: PASS.

## Key decisions

- `BUILTIN_CAPABILITIES_MAP` in `providerRoster.ts` is canonical for built-in capabilities.
- `stripAttachments()` in `sendMessage.ts` — non-vision providers never see attachment data.
- `Attachment.base64` stored raw; prefix added only at `<img src>` and API boundaries.
- `getProviderRoster()` from `@/auth` in `InputBar.tsx` — documented cross-agent exception.
- `includeAttachments` on Vault export defaults false; metadata only.
- Ada advisories deferred: #318 (aria-live on chips), #319 (Safari file picker focus return), #320 (modal backdrop aria-hidden).
- Attach button icon: `PhotoIcon` (mountain-in-frame) — not paperclip. Image-only affordance is intentional.

## Open bugs / known issues

- **#316** — Scout: `appendToContext` + shuffle interaction untested (deferred)
- **#317** — Scout: abort mid-shuffle untested (deferred)
- **#318** — Aria: chips list missing `aria-live` (Ada advisory)
- **#319** — Aria: Safari file picker focus return not guaranteed (Ada advisory)
- **#320** — Aria: VisionWarningModal backdrop `aria-hidden` value incorrect (Ada advisory)

## What's next

1. **#318, #319, #320** — Aria: batch all three Ada advisories in one session (Aria + Ada fixed cost)
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
