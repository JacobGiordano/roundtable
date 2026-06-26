Last updated: 2026-06-26 (ship — #293 closed)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#290 (Atlas + Aria / Flint)** — Closed. Generic `/dev-proxy/<url>` Vite middleware + `DevProxyHint` in ProviderSettingsPanel.

**#293 (Atlas / Flint)** — Closed. `stream_options: { include_usage: true }` auto-retry in `generic.ts`. Module-level `streamOptionsIncompatibleEndpoints: Set<string>` — first request sends with `stream_options`; if non-ok response, endpoint is cached and request is retried without it. Abort-safe. Fixes 502s on OpenRouter free-tier models.

## Open bugs / known issues

- **#285** — File attachments — future, no green light yet.
- **#291** — Pre-existing `aria-describedby` gap on ProviderSettingsPanel form inputs (advisory).
- **#292** — Retry button is a stub (`App.tsx:777`) — not yet wired. Atlas.
- **#294** — Reply link text not using custom provider accent color in MessageBubble. Aria.
- **#295** — Provider capabilities model design. Arch. Phase 5.

## Key decisions

- `var(--error)` does NOT exist as a CSS custom property — only as a Tailwind utility alias. Inline styles must use `var(--semantic-error)` directly.
- `isValidModelId` in `accentColors.ts` accepts `custom:*` IDs (pattern: `/^custom:[^\s]+$/`).
- Custom endpoint `endpointUrl` in `generic.ts` is the **full URL** including path (e.g. `/chat/completions`) — the provider does not append it.
- `stream_options` incompatibility handled via Option B (try/retry/remember) not a per-provider flag. #295 is the long-term capabilities model.

## What's next

1. **#292** (Atlas) — Wire up Retry button.
2. **#294** (Aria) — Reply link accent color for custom providers.
3. **#285** — File attachments — awaiting green light.
4. **#295** — Capabilities model — Phase 5, Arch-led design.

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
- `MessageBubble.resolveAccentCssColor(token, modelId?)`: custom providers → `var(--accent-custom-{sanitizeCustomAccentId(modelId)})`; built-ins → `var(--accent-{token})`
- `sanitizeCustomAccentId(id)` in `src/ui/utils/modelColor.ts`: single source of truth for `custom:*` → CSS ident. Do not inline this logic anywhere else.
- `applyRosterAccentColors(roster)` must be called at boot, theme switch, and roster change — see `main.tsx`, `Sidebar.tsx handleThemeChange`, `App.tsx handleRosterChange`
- Gate's `readStoredColors()` now returns custom IDs (post-#287) — `getModelAccentColors()` returns custom accent overrides correctly
- Contrast-token fixes: route through Luma (values in `/_design/themes/`), not Gate — Gate has no representation of built-in theme token values
- `var(--error)` does not exist — use `var(--semantic-error)` in inline styles; Tailwind `bg-error`/`text-error` work via config alias only
- Custom endpoint `endpointUrl` in `generic.ts` is the full URL including path (e.g. `/chat/completions`) — provider posts directly to it, does not append
- `/dev-proxy/<url>` middleware is dev-only (`configureServer` hook) — Vite strips it from production builds entirely
- `streamOptionsIncompatibleEndpoints` Set in `generic.ts` is module-level (page-lifetime cache) — resets on reload; one extra 502 per session per incompatible endpoint is acceptable
