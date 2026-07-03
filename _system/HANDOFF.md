Last updated: 2026-07-03

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#325 (Forge)** — Closed. Bumped `node-version: '20'` → `'24'` in `ci.yml` and `release.yml` (9 occurrences total). Eliminates GitHub Actions deprecation warnings.

**#326 (Scout)** — Closed. Moved `focus-trap-browser.spec.ts` from `src/tests/a11y/keyboard/` to `src/tests/e2e/` and added a belt-and-suspenders exclude rule to `vite.config.ts`. Fixes CI `Test` job that had been failing on every push to main for weeks. Focus-trap tests now run under Playwright (correct runner) instead of crashing Vitest. Side note: `playwright.a11y.config.ts` now has no `.spec.ts` files in its `testDir` — effectively idle, minor cleanup candidate.

**#327 (Aria + Ada)** — Closed. Nameplate tint bumped from 12% → 16% uniformly. Superseded immediately by #328 but the commits landed and the approach was correct.

**#328 (Aria + Ada)** — Closed. Nameplate tint made per-theme via `--nameplate-tint` CSS variable set in `applyTheme()` based on `theme.mode`: dark themes (ash, ember, midnight, outrun, slate) → 18%, light themes (chalk, linen) → 16%. Copy icon fill and both nameplate backgrounds all use `var(--nameplate-tint)`. Error-state nameplate (12% with `--semantic-error`) intentionally untouched.

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
