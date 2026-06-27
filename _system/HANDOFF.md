Last updated: 2026-06-27 (ship — #299, #302, #303, #304 closed)

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#299 (Aria / Ada)** — Closed. Auto-chain mode wired end-to-end. Removed `comingSoon` flag from `InteractionModeSwitcher`. `handleSend` in `App.tsx` builds `AutoChainConfig` from active roster (roster order, `appendToContext: true`, `maxPasses: 1`) and passes `chainConfig` to `sendMessage()`. Parallel unchanged. Confirmed working in the wild.

**#302 (Atlas + Aria)** — Closed. OpenAI provider display name renamed from `'GPT-5.5'` to `'ChatGPT'` in two places: `gpt.ts` (registry name) and `ProviderSettingsPanel.tsx` (hardcoded `BUILTIN_META` map). `BUILTIN_META` is an intentional local copy — importing from `@/models` would cross the agent boundary.

**#303 (Atlas + Gate)** — Closed. OpenAI CORS proxy fix. Credential test now uses `OPENAI_TEST_BASE` via `proxyBase()` (Gate). Chat completions URL routes through `/openai-proxy` in dev (Atlas). `/openai-proxy` → `https://api.openai.com` Vite route added. Confirmed: key test passes, conversations work.

**#304 (Atlas + Scout)** — Closed. `BaseOpenAIProvider` now sends `max_completion_tokens` for `gpt-5.5`, `o3`, `o1`, `o1-mini` and `max_tokens` for `gpt-4o`, `gpt-4o-mini`. Uses module-level `MAX_COMPLETION_TOKENS_MODELS` Set checked against resolved model string post-version-selection. Scout added 6-test regression suite in `src/tests/integration/base-openai-provider-token-key.test.ts`.

## Open bugs / known issues

- **#285** — File attachments — deferred. Not core; revisit after Phase 5 design work.
- **#291** — Pre-existing `aria-describedby` gap on ProviderSettingsPanel form inputs (advisory).
- **#300** — `InteractionModeSwitcher`: arrow-key navigation for radiogroup (WAI-ARIA APG gap, now more impactful with two active radio buttons). Filed by Ada in #299 session.
- **#301** — `InteractionModeSwitcher`: `aria-describedby` on enabled `ModeButton` repeats description already in `aria-label` (verbose double-read). Filed by Ada in #299 session.

## Key decisions

- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy — do not import from `@/models` to avoid crossing agent boundary.
- `MAX_COMPLETION_TOKENS_MODELS` Set in `BaseOpenAIProvider` uses resolved model string (post-version-selection) — not provider class — because `GPT55ModelProvider` serves both `max_tokens` and `max_completion_tokens` models.
- Export/import feature (#305) captured for Phase 6+; requires passphrase-based encryption — never plaintext key export.
- Flint coordination: agents run Flint internally; Coda should not spawn a separate Flint if the agent's summary includes a Flint verdict. Direct file/git verification + user confirmation is the fallback. File Arch ticket to document the Coda-coordinated wave exception for Flint (same pattern as Ada exception).

## What's next

1. **#300** — Arrow-key nav for `InteractionModeSwitcher` radiogroup (Aria, a11y, medium urgency).
2. **#301** — `aria-describedby` redundancy on `ModeButton` (Aria, advisory).
3. **#291** — Advisory a11y gap on ProviderSettingsPanel (Aria, low urgency).
4. **Gate + Aria** — Persist and expose `capabilities` toggles in ProviderSettingsPanel.
5. **#285** — File attachments (deferred).
6. **#305** — Cross-device export/import (Phase 6+).

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- `tabIndex={-1}` elements: `focus:outline-none focus:bg-hover` only — no ring
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
- `inert` attribute: `isClosed ? '' : undefined`
- `inert` and `aria-hidden` must always be controlled by the same boolean — keep in sync
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
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
- `resolveAccentCssColor(token, modelId?)` exported from `src/ui/utils/modelColor.ts` — custom providers → `var(--accent-custom-{sanitizeCustomAccentId(modelId)})`; built-ins → `var(--accent-{token})`
- `sanitizeCustomAccentId(id)` in `src/ui/utils/modelColor.ts` — single source of truth for `custom:*` → CSS ident. Do not inline.
- `applyRosterAccentColors(roster)` must be called at boot, theme switch, and roster change — see `main.tsx`, `Sidebar.tsx handleThemeChange`, `App.tsx handleRosterChange`
- Gate's `readStoredColors()` now returns custom IDs (post-#287) — `getModelAccentColors()` returns custom accent overrides correctly
- `var(--error)` does not exist — use `var(--semantic-error)` in inline styles; Tailwind `bg-error`/`text-error` work via config alias only
- Custom endpoint `endpointUrl` in `generic.ts` is the full URL including path (e.g. `/chat/completions`) — provider posts directly to it, does not append
- `/dev-proxy/<url>` middleware is dev-only (`configureServer` hook) — Vite strips it from production builds entirely
- Chip accent pattern: border (40%) + background tint (15%) only — never apply accent as text `color:` on tinted background (contrast failure across 7 themes)
- `var(--#hex)` is invalid CSS — never interpolate raw hex into a `var()` call; always route through `resolveAccentCssColor`
- Retry orphans the previous AbortController if a stream is already active — same pre-existing gap as `handleSend`; deactivated-model retry emits a synthetic error bubble (benign)
- Attribution transform (`buildAttributedMessages`) skips `isStreaming` and error-sentinel messages — these must never reach providers. Consecutive other-model turns produce consecutive `role:'user'` turns on the wire; modern providers handle non-alternating sequences correctly.
- `buildAttributionSystemPrompt` no-ops for single-model sessions (otherActiveModels.length === 0) — framing is never injected into solo conversations
- `ProviderCapabilities` all fields optional — absence of `capabilities` on `CustomProviderConfig` means Atlas uses per-capability defaults; existing persisted configs valid without migration
- OpenAI proxy: `/openai-proxy` → `https://api.openai.com` in vite.config.ts; `OPENAI_TEST_BASE` in credentialTest.ts; `apiUrl` getter in `gpt.ts` uses three-tier fallback matching claude.ts pattern
- `MAX_COMPLETION_TOKENS_MODELS` Set in `BaseOpenAIProvider` — checked against resolved model string post-version-selection; `gpt-5.5`, `o3`, `o1`, `o1-mini` use `max_completion_tokens`; `gpt-4o`, `gpt-4o-mini` use `max_tokens`
- `BUILTIN_META` in `ProviderSettingsPanel` is an intentional local copy of provider display names — do not import from `@/models` to avoid crossing agent boundary
