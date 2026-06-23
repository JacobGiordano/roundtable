Last updated: 2026-06-23 (ship: #178 Outrun flash + #180 live keyboard audit)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#178 (Aria + Ada)**: Outrun entry flash. `OutrunFlash` component in `/src/ui/OutrunFlash.tsx` — `createPortal` into `document.body`, `MutationObserver` on `data-theme`. Fires on theme activation, not page load. 300ms total (100ms hold + 200ms fade-out). Reduced-motion guard: observer never registers. Ada: 4/4. Flint PASS.

**#180 (Ada)**: Live browser Playwright keyboard audit of focus traps. 21 tests, new `playwright.a11y.config.ts`, audit report at `/src/tests/a11y/audit-reports/keyboard-focus-trap-audit-2026-06-22.md`. Found: AccentColorPicker Tab containment broken in Chromium (WCAG 2.1.2 Level A) → filed #262.

## Open bugs / known issues

- **#262 (Aria)** — AccentColorPicker Tab trap broken in Chromium. ACP renders inside `#model-selector-panel` DOM; MSP's `document.addEventListener` intercepts Tab before ACP's `onKeyDown`. Fix options in #262. Two `test.fail()` guards in `focus-trap-browser.spec.ts`. **Priority — fix before delight work.**
- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent.

## Key decisions

- #179 approach: **Approach 2 (Aria-only)** — MessageBubble diffs prev/next content, wraps new text in `.chunk-entering` spans. No Atlas change, no types PR.
- `OutrunFlash` MutationObserver pattern: self-contained, no prop threading, no context.
- `createPortal` into `document.body` for OutrunFlash: avoids `position: fixed` clipping inside transformed ancestors (sidebar slide animation).

## Open advisories

- #179 (Spark/Atlas) — Chunk fade-in wiring (Aria-only approach confirmed)
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #178 delight timing: 300ms total; if too long, adjust `outrunFlash` keyframe in `index.css`

## What's next

1. **Aria: #262** — Fix AccentColorPicker Tab trap (WCAG 2.1.2 Level A) — remove `test.fail()` when fixed
2. **Aria: #179** — Chunk fade-in wiring (Approach 2, Aria-only)

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
- AccentColorPicker Tab trap: ACP renders inside `#model-selector-panel` DOM — MSP document listener intercepts Tab before ACP onKeyDown; fix per #262 options (stopPropagation preferred)
- Playwright a11y tests: `npx playwright test --config playwright.a11y.config.ts` (separate from main e2e config)
- `OutrunFlash` MutationObserver: fires only on `data-theme` mutations, not initial value — page-load with Outrun active produces no flash by design
