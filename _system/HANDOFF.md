Last updated: 2026-06-21 (ship: hotfix — Aria #251 model selection persistence)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Hotfix: Aria #251 — model selections not persisted across page reload**

- **Root cause (Vault)**: Two gaps in `App.tsx` — `handleToggleModel`/`handleAddModel` never called `store.updateConversation()` (toggles lived only in React memory), and startup always initialized models with `isActive: false` from the roster (never seeding from the stored conversation).
- **Fix (Aria)**: Both handlers now persist via `store.updateConversation()` with ghost-mode guard. New `useEffect([store.isLoading, activeConversation?.id])` seeds `isActive` from the active conversation on load and conversation switch.
- Pre-existing bug — made visible when container rebuild cleared localStorage.
- **Flint**: PASS — 1335/1336 green (pre-existing ExportButton Escape only).

**Also shipped this session:**
- #249 (Aria) — ProviderSettingsPanel TestButton wired to testCredential/testCustomCredential
- #250 (Aria) — Test/Edit/Clear buttons consolidated into one row in ProviderRow
- #246 (Ada) — ThreadActionMenu group-input aria-label regression tests
- #146/#147 (Aria) — Sidebar + ModelSelectorPanel file splits + shared icon system
- #238 (Gate) — Custom credential testing (testCustomCredential, cors-or-network status)
- #241 (Aria) — ThreadActionMenu aria-required-children fix

## Open bugs / known issues

- **Claude credential test "Network Error"** (Gate) — `api.anthropic.com/v1/models` may not return CORS headers on error responses; browser sees network error instead of "Invalid key". Built-in providers should return `cors-or-network` on fetch throw. File a Gate issue before next wave.
- **Claude messages not working for user** — may be related to CORS bug above, or invalid key. User to verify key on platform.anthropic.com.

## Key decisions

- `roundtable:` prefix (colon separator, kebab-case) is canonical localStorage convention.
- Migration shims (`rt_key_`, `roundtable_user_preferences`, `rt-ui-sidebar-width`) in place for one release cycle — remove after.
- ThreadActionMenu backdrop pattern is intentional.
- `cors-or-network` is a distinct TestResult status — built-in providers incorrectly return `error` on fetch throw (fix pending via Gate).
- `MODEL_REGISTRY` from `@/models` and `BUILTIN_MODEL_IDS`/`getModelAccentCssValue` from `@/auth` are permitted Aria cross-agent imports — document with comment.
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (#248 to document SearchBar).
- `TESTABLE_CREDENTIAL_KEYS` in ProviderSettingsPanel must stay in sync with Gate's `PROVIDER_TEST_CONFIGS`.

## Open advisories

- #248 (Aria) — Document SearchBar magnifying glass as inline exception in icons/index.tsx
- #247 (Aria) — Focus-return on group-suggestion buttons; UX decision needed
- #245 (Ada/Aria) — SystemPromptRow: aria-controls references conditionally rendered element
- #244 (Aria) — SystemPromptRow: requestAnimationFrame in setState callback
- #243 (Ada/Aria) — AddModelButton: role="menu" lacks ArrowDown/Up keyboard navigation
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

1. **Verify #251 fix**: page reload should now restore selected models — confirm in dev server
2. **Gate: file + fix credential test CORS** — built-in providers returning `error` instead of `cors-or-network` on fetch throw
3. **Aria: #243** — AddModelButton ArrowDown/Up keyboard nav (a11y blocker-adjacent)
4. **Aria: #245** — SystemPromptRow aria-controls fix

## Visual checks still pending

- ProviderSettingsPanel: Test | Edit | Clear on one row with working test (#249/#250)
- Model persistence: select models, reload page — they should survive (#251)
- ApiKeyPanel custom provider UI (Gate #238)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
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
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring — pre-existing test failure in ExportButton Escape
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` — remove after one release cycle
- `testCustomCredential` (Gate): `cors-or-network` = CORS blocked or network error — built-in providers still return `error` on fetch throw (fix pending)
- `TestResult` lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
- Sub-component directories: sidebar/ and model-selector/ under /src/ui/components/
- Model persistence: `handleToggleModel`/`handleAddModel` now persist to storage; `useEffect([store.isLoading, activeConversation?.id])` seeds `isActive` on load — do not remove these
