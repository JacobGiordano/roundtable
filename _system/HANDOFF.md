Last updated: 2026-06-23 (ship: #170 + #169 + #170 empty-field validation fix)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#170 (Gate → Aria)**: Backend server panel. Gate exposed `getBackendConfig`, `saveBackendConfig`, `clearBackendConfig` in `backendConfig.ts`. Aria built `BackendServerPanel.tsx` (URL input, login/logout form, connection status badge) mounted in `Sidebar.tsx`. Ada clean. Follow-up: empty username/password validation added post-dev-server review — inline required-field errors, `aria-invalid`/`aria-describedby`, focus on offending field. Ada clean.

**#169 (Gate + Luma + Arch + Aria)**: Custom theme import UI. Gate implemented `validateCustomTheme` (themeValidation.ts), `saveCustomTheme` + `getActiveTheme` (theme.ts). Arch expanded `CustomThemeJSON.prose` to all 7 schema fields and added `ActiveTheme` to `/src/types/index.ts`. Luma specced the component (`/_design/specs/custom-theme-import.md`). Aria built `CustomThemeImport.tsx` (4-state machine: Idle/Validating/Rejected/Applied) as Section 4 in `ProviderSettingsPanel.tsx`. Also wired 5 missing prose CSS vars in `applyTheme()`. Ada clean.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent.
- **#264** — No model replies in dev app. Deferred diagnostic; investigate when usage resets.

## Key decisions

- `BackendConfig` type lives in `/src/auth/backendConfig.ts` — promote to `/src/types/index.ts` via Arch if a third agent ever needs it directly.
- `ValidationResult` exported from `@/auth` (same promotion note as above).
- `ActiveTheme` and expanded `CustomThemeJSON.prose` are in `/src/types/index.ts`.
- Gate's `customThemeActive` flag is a Gate-internal field in `roundtable:theme` localStorage key — opaque to other agents.
- `applyTheme()` is in `/src/ui/theme.ts` (Aria's directory) — confirmed by Arch during #169.

## What's next

1. **#264** — Investigate silently non-responsive models in dev app (Atlas/Gate). Low-cost diagnostic; good first issue after usage reset.
2. **Follow-up (filed)** — `onBackendConnectionChange` not wired in `App.tsx`; live storage provider switching deferred to next page load. File as a new issue.
3. **Phase transition** — #169 and #170 were the last planned Phase 4+ features. Assess whether Phase 5 kickoff is warranted or if #264 + follow-ups close out Phase 4+.

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
- `inert` attribute: `isClosed ? '' : undefined`
- `inert` and `aria-hidden` must always be controlled by the same boolean — keep in sync
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131)
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `openrouter.ai` not on container firewall allowlist — live-API catalog fetch degrades to `[]` in dev
- App integration tests read from `lastContextValue` (RoundtableContext), not `lastAppLayoutProps`
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
- `aria-disabled` not `disabled` for buttons that need tooltip discoverability via keyboard
- jsdom `DOMException` does not extend `Error` — always duck-type AbortError: `err?.name === 'AbortError'`
- Vault cache is in `LocalStorageProvider` instance scope — tests that create fresh instances always start cold
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring — pre-existing test failure
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` — remove after one release cycle
- `TestResult` lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
- Sub-component directories: sidebar/ and model-selector/ under /src/ui/components/
- Model persistence: `handleToggleModel`/`handleAddModel` now persist to storage; `useEffect([store.isLoading, activeConversation?.id])` seeds `isActive` on load — do not remove these
- `cors-or-network` is now consistent: both `testCredential` and `testCustomCredential` return it on fetch throw
- `hidden` attribute (not `aria-hidden`) is the correct pattern for `aria-controls` progressive disclosure targets
- Absolutely-positioned children inside a `hidden` parent can go invisible on reveal due to GPU compositing — fix with `isolate` on the wrapper + `z-10` on the child
- `TESTABLE_CREDENTIAL_KEYS` in ProviderSettingsPanel must stay in sync with Gate's `PROVIDER_TEST_CONFIGS`
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (SearchBar documented as named exception in icons/index.tsx)
- AddModelButton dropdown: uses `createPortal` into `document.body` with fixed positioning from `getBoundingClientRect()`
- `activeFocusIndexRef` (useRef) for menu keyboard nav — not useState; avoids re-render per keypress
- `aria-owns` cannot remove DOM children from ARIA ownership tree — do not use as exclusion mechanism
- WCAG 2.5.8 blockers resolved in #257; WCAG 2.4.11 focus-not-obscured resolved in #258/#259
- MSP focus trap Escape handler is in `handleFocusTrap` useEffect listener — cleanup removes it; `triggerRef` on trigger chip for focus return
- Sidebar closed-inert: `isMobile` reactive state (matchMedia listener) guards `inert` so desktop sidebar is never inert
- ACP Tab trap: capture-phase document listener + MSP `openPickerModelIdRef` yield — do not revert to bubble-phase onKeyDown
- Playwright a11y tests: `npx playwright test --config playwright.a11y.config.ts` (separate from main e2e config)
- `OutrunFlash` MutationObserver: fires only on `data-theme` mutations, not initial value — page-load with Outrun active produces no flash by design
- `chunk-entering` / `chunkFadeIn`: animation fires on new-text spans only; `prevLengthRef` tracks stable offset — do not convert to useState
- `CustomThemeImport` 4-state machine: rAF deferral before validation so spinner renders; error list scrolls at 17+; `saveCustomTheme` called only on valid path — never on rejection
- `customThemeActive` in `roundtable:theme` localStorage is Gate-internal; `setActiveTheme(id)` clears it when switching back to built-in
