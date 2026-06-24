Last updated: 2026-06-24 (session end — #264 partially fixed, CORS root cause identified)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#264 (Atlas)**: Three fixes landed on local main — not shipped yet.
1. `0d147bd` — double-user-message bug in `sendMessage.ts` (was causing HTTP 400 from Anthropic)
2. `04c750e` — `emitErrorChunk` priming chunk across all 5 provider files (errors now surface in UI)
3. `56034ea` — `emitErrorChunk` applied to 4 bare error sites in `sendMessage.ts` itself (`emitMissingProviderErrors`, `runProviderIsolated`, `runDirected`, `runAutoChain`)

**devcontainer**: `9dcb4eb` — added `api.anthropic.com` to CDN IP refresh daemon in `init-firewall.sh`.

## Open bugs / known issues

- **#264 not fully resolved** — models still non-responsive despite the fixes. Root cause now identified: browser CORS preflight OPTIONS to `api.anthropic.com/v1/messages` returns 400 Bad Request from Anthropic's server. The actual POST never fires. Keys are correct (confirmed via localStorage and curl). This may mean direct browser-to-API calls aren't supported by Anthropic and a backend proxy is needed — Atlas to investigate.
- **Llama silence** — still radio silence after hard refresh. Not a CORS issue (local endpoint). Separate dispatch/routing bug for Atlas.
- **ExportButton Escape** — pre-existing test failure. WAI-ARIA menu ArrowDown/Up wiring absent.
- **#266** — `useStreamingMessages` silently drops done+error chunks with no prior content (Aria)
- **#267** — `useStreamingMessages` hook-level fix for same (Aria cleanup of Atlas workaround)
- **#268** — `FakeErrorProvider` mock doesn't use `emitErrorChunk` (Scout)
- **#269** — Ollama/no-auth custom providers hit `auth_failure` instead of connecting (Gate/Atlas)

## Key decisions

- `emitErrorChunk` is now the required pattern for all error emissions in `/src/models/` — never emit bare `{ isDone: true, error }` without a priming `{ isDone: false, content: '' }` first
- `filterMessagesForApi` strips empty/error assistant messages before API calls — do not remove
- `api.anthropic.com` added to CDN refresh daemon alongside `api.openai.com` and `hooks.slack.com`

## What's next

1. **#264 CORS investigation (Atlas)** — determine if `api.anthropic.com` browser-direct calls are supported or if a proxy is needed. Check `dangerouslyAllowBrowser` SDK flag, fetch configuration, or whether the backend path is required for Anthropic.
2. **Llama silence (Atlas)** — separate investigation; local endpoint, different failure mode.
3. **Flint gate + ship #264** — once both are resolved.
4. **#266/#267 (Aria)** — error display hook fix; can batch with other Aria work.
5. **#268 (Scout)** — mock update; small, can batch.
6. **#269 (Gate/Atlas)** — Ollama no-auth UX; design question before implementation.
7. **Phase transition** — assess Phase 5 after #264 ships.

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
- **CORS preflight**: browser-direct fetch to `api.anthropic.com/v1/messages` returns 400 on OPTIONS — may need backend proxy; under investigation (#264)
- **Never rebuild container while agents are running** — kills them mid-session with no commits
- `emitErrorChunk` is mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks are silently dropped by `useStreamingMessages`
