Last updated: 2026-06-25 (ship — #269 closed)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#269 (Arch/Gate/Atlas/Aria/Scout)** — Closed. No-auth custom providers (Ollama, LM Studio, etc.) no longer hit `auth_failure`. Five-agent wave:
- Arch: `requiresApiKey?: boolean` on `CustomProviderConfig` — absent = `true`, no migration
- Gate: `isCustomProviderReady()` exported; `testCustomCredential()` short-circuits; `addCustomProvider`/`updateCustomProvider` store the flag
- Atlas: credential lookup and `Authorization` header skipped when `requiresApiKey === false` in `generic.ts`
- Aria: "No API key required" checkbox in Add and Edit forms; API key field removed from DOM when checked; badge shows "No key required"; Ada: 0 blockers
- Scout: 40 new tests, all passing

Final merge: `f94ba92`.

## Open bugs / known issues

- **#275 (Aria)** — Custom provider accent color not applied in chat bubbles. Color shows in settings list but not in message bubbles.
- **#276 (Aria/Luma/Ada)** — Dark theme text contrast failure. Body text and secondary text near-invisible in dark themes. WCAG AA fail.
- **ExportButton Escape** — pre-existing WAI-ARIA menu ArrowDown/Up wiring absent.

## Key decisions

- `requiresApiKey?: boolean` lives on `CustomProviderConfig` only — not `BuiltInProviderConfig`, not `ModelProviderConfig`. Built-ins always require credentials.
- Absent-means-`true` semantics at every layer — Gate, Atlas, Aria all check `=== false` with strict equality.
- `isCustomProviderReady(config)` is the correct function for any readiness check; `hasCredential` is for value-presence only.
- `content: 'Error'` sentinel on synthesized error Messages is load-bearing for live region — do not revert.

## What's next

1. **#275 (Aria)** — Accent color not reaching chat bubbles; trace `accentColor` from roster → MessageBubble
2. **#276 (Aria/Luma/Ada)** — Dark theme contrast; check `text-foreground` token resolution in dark theme scope
3. **ExportButton Escape** — WAI-ARIA menu ArrowDown/Up; file if not already open
4. **Phase 5 assessment** — after contrast issues resolved

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
- `emitErrorChunk` is mandatory for all error paths in `/src/models/` — bare `{ isDone: true, error }` chunks are silently dropped by `useStreamingMessages`
- `FakeErrorProvider` must use `emitErrorChunk` (priming non-done chunk required) — bare error chunks don't create an accumulator entry and get dropped
- `sentConversationRef` in App.tsx: set synchronously before `sendMessage()`, read in `handleMessageComplete` — never replace with `store.getActiveConversation()` in that callback
- Vite dev proxy `/anthropic-proxy` → `https://api.anthropic.com` handles CORS; `anthropic-dangerous-direct-browser-access: true` header required on the fetch
- `credentialTest.ts` `ANTHROPIC_TEST_BASE` must mirror `ANTHROPIC_API_BASE` in `claude.ts` — same three-tier fallback (`VITE_ANTHROPIC_PROXY_URL` → `/anthropic-proxy` → direct)
- `content: 'Error'` sentinel on synthesized error Messages feeds the live region — do not revert; MessageBubble guards suppress the visual rendering when `hasError && content === 'Error'`
- `isCustomProviderReady(config)` is the correct readiness check for custom providers — `hasCredential` alone returns false for intentionally keyless providers
