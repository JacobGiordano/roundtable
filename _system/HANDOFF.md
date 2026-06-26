Last updated: 2026-06-26 (ship — #279 and #280 closed)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#279 (Luma/Gate/Aria/Ada/Flint)** — Closed. User message bubbles now have a distinct periwinkle/indigo `accents.user` left border. Gate added `getUserAccentColor`/`setUserAccentColor`/`clearUserAccentColor` API + custom theme validator updated to require `accents.user`. Aria added Pass 2 CSS override, bubble border fix, and "Your messages" swatch + `UserAccentColorPicker` in Settings → Appearance. Hotfix required: `applyUserMessageColor(null)` was stripping Pass 1's `--accent-user` inline style; fix: null branch is now a no-op, reset handler re-applies `applyTheme()` first.

**#280 (Gate/Aria/Ada/Flint)** — Closed. Desktop sidebar now has collapse/expand toggle. State persists via `roundtable:sidebar-open` localStorage key. Mobile sidebar unaffected.

## Open bugs / known issues

- **#277** — Linen `text.muted` on `interactive.hover`: 4.44:1, just below 4.5:1 threshold. Advisory; filed.
- **#282** — a11y advisory: collapse button missing `aria-expanded={true}`. Low effort fix.
- **#283** — a11y advisory: sidebar toggle buttons missing `aria-controls`.
- **#284** — a11y advisory: hex input in `UserAccentColorPicker` uses `focus:` border instead of `focus-visible:ring`.
- **#286** — Bug: custom endpoint accent colors not applied to message bubbles. #278 did not fully resolve this. Investigation needed — Atlas + Aria.

## Key decisions

- `applyUserMessageColor(null)` is intentionally a no-op. Any caller that needs to restore the theme default must call `applyTheme(currentTheme)` first. This is documented in JSDoc.
- `handleReset` in `UserAccentColorPicker`: order is `applyTheme(THEME_MAP[themeId])` → `clearUserAccentColor()` → `applyUserMessageColor(null)`.
- `accents.user` token family: `#A5B4FC` (dark themes), `#4338CA` (light themes), `#B4BCFF` (Outrun). All pass 4.5:1 as text against their card surfaces.
- Sidebar toggle: `md:hidden` on `<aside>` when `!isDesktopOpen`. Mobile sidebar (`isMobileMenuOpen`) is separate state — never touch both in the same handler.

## What's next

1. **#286 (Atlas/Aria)** — Custom endpoint colors bug — user green-lit this
2. **#285 (multi-agent)** — File attachments — future, no green light yet
3. **#282/#283/#284** — Ada advisories — low priority, can batch into a future Aria session
4. **Phase 5 assessment** — after #286 and any remaining Phase 4 bugs land

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- `tabIndex={-1}` elements: `focus:outline-none focus:bg-hover` only — no ring
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
- `focus-trap-browser.spec.ts` in `/src/tests/a11y/keyboard/` is a Playwright spec collected by Vitest due to naming — pre-existing suite-level error, not a real test failure
- `accents.user` custom theme validator: key is now required in `accents` object — custom themes pre-dating #279 need `"user": "<hex>"` added
- `applyUserMessageColor(null)` is a no-op — callers restoring theme default must call `applyTheme()` first
- Sidebar toggle: `getSidebarOpen()` default is `true` (absent key = open); `setSidebarOpen(bool)` persists to `roundtable:sidebar-open`
