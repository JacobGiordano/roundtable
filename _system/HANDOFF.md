Last updated: 2026-06-25 (ship — #264, #266, #267, #270 closed)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#264 (Atlas)** — Models now responsive. Three-part fix:
1. Vite dev proxy routes `/anthropic-proxy` → `https://api.anthropic.com` server-side (bypasses CORS)
2. `anthropic-dangerous-direct-browser-access: true` header satisfies Anthropic's browser-origin check
3. `generic.ts` no-auth fix: removed pre-flight auth block silencing Ollama/no-key providers

**#270 (Aria)** — User messages no longer disappear during streaming. Root cause: `handleMessageComplete` was reading from store before React flushed the `updateConversation` write, permanently dropping the user message. Fix: `sentConversationRef` set synchronously before `sendMessage()` fires.

**#266/#267 (Aria)** — Error-first chunks now surface in UI. `useStreamingMessages` synthesizes a minimal error Message when done+error arrives with no prior accumulator entry.

## Open bugs / known issues

- **Gate credential Test button** — still hits `api.anthropic.com` directly (CORS error). Tracked as next Gate issue to open.
- **Llama silence** — local Ollama endpoint still non-responsive; `generic.ts` no-auth fix was supposed to help but unconfirmed. Needs re-test.
- **#271** — Live region announces empty snippet for synthesized error messages (Ada advisory, Aria).
- **ExportButton Escape** — pre-existing WAI-ARIA menu ArrowDown/Up wiring absent.

## Key decisions

- `anthropic-dangerous-direct-browser-access: true` is the required header for all browser-origin Anthropic requests going through the Vite proxy
- `sentConversationRef` pattern: set synchronously before `sendMessage()`, advance after each `handleMessageComplete` — do not revert to `store.getActiveConversation()` in that callback
- `emitErrorChunk` + belt-and-suspenders guard in `useStreamingMessages` is the permanent error pattern — both stay
- Backend proxy at `/api/proxy/anthropic` is the production self-host path; set `VITE_ANTHROPIC_PROXY_URL` in frontend env

## What's next

1. **Gate** — Fix credential Test button to use proxy URL (new issue to open)
2. **Atlas** — Re-test Ollama with the no-auth fix; confirm or file new issue
3. **#271 (Aria)** — Live region empty snippet; minor, future session
4. **Phase 5 assessment** — after Ollama confirmed + Test button fixed

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
- **Never rebuild container while agents are running** — kills them mid-session with no commits
- `emitErrorChunk` is mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks are silently dropped by `useStreamingMessages` (belt-and-suspenders guard now in hook too)
- `sentConversationRef` in App.tsx: set synchronously before `sendMessage()`, read in `handleMessageComplete` — never replace with `store.getActiveConversation()` in that callback
- Vite dev proxy `/anthropic-proxy` → `https://api.anthropic.com` handles CORS; `anthropic-dangerous-direct-browser-access: true` header required on the fetch
