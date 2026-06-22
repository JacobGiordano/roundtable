Last updated: 2026-06-22 (ship: wave #252 Gate CORS fix + #254/#255 Aria SystemPromptRow fixes)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Gate #252 — testCredential cors-or-network**
- `testCredential` catch block now returns `cors-or-network` instead of `error` on fetch throw.
- HTTP error paths (through `interpretHttpStatus()`) still return `error` — only the throw path changed.
- 42/42 tests pass; stale jsdoc comment on `TestResult` corrected.

**Aria #254 — SystemPromptRow: rAF out of setState updater**
- `handleToggle` is now a pure updater. rAF focus call moved to `useEffect([isExpanded])`.
- Eliminates Strict Mode double-invocation hazard.

**Aria #255 — SystemPromptRow: aria-controls always resolves**
- Expandable body div always rendered; `hidden={!isExpanded}` controls AT visibility.
- `aria-controls` on toggle button now always points at a live DOM node.

**Ada + Flint**: PASS — 1342/1342 + 7 skipped + 1 pre-existing ExportButton Escape.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu pattern ArrowDown/Up wiring absent. Tracked as part of #253 scope.

## Key decisions

- `cors-or-network` is now consistent across both `testCredential` (built-in) and `testCustomCredential` (custom) — both return it on fetch throw.
- `hidden` attribute (not `aria-hidden`, not CSS `hidden` class) is the correct pattern for progressive disclosure bodies that use `aria-controls`.
- `useEffect([isExpanded])` is the correct place for post-mount focus side effects — not inside setState updaters.

## Open advisories

- #253 (Ada/Aria) — AddModelButton: role="menu" lacks ArrowDown/Up keyboard navigation
- #254 (Aria) — CLOSED this wave
- #255 (Ada/Aria) — CLOSED this wave
- #248 (Aria) — Document SearchBar magnifying glass as inline exception in icons/index.tsx
- #247 (Aria) — ThreadActionMenu: group-suggestion and confirm-delete buttons skip closeAndReturnFocus (WCAG 2.4.3)
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

1. **Aria: #253** — AddModelButton ArrowDown/Up/Home/End keyboard nav (a11y, deferred from this wave)
2. **Aria: #247** — ThreadActionMenu closeAndReturnFocus (WCAG 2.4.3)
3. **Aria: #248** — SearchBar inline SVG exception comment (tiny, batch with next Aria wave)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount; single rAF for conditional mount
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
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring — pre-existing test failure
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` — remove after one release cycle
- `TestResult` lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
- Sub-component directories: sidebar/ and model-selector/ under /src/ui/components/
- Model persistence: `handleToggleModel`/`handleAddModel` now persist to storage; `useEffect([store.isLoading, activeConversation?.id])` seeds `isActive` on load — do not remove these
- `cors-or-network` is now consistent: both `testCredential` and `testCustomCredential` return it on fetch throw
- `hidden` attribute (not `aria-hidden`) is the correct pattern for `aria-controls` progressive disclosure targets
- `TESTABLE_CREDENTIAL_KEYS` in ProviderSettingsPanel must stay in sync with Gate's `PROVIDER_TEST_CONFIGS`
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (#248 to document SearchBar)
- AddModelButton dropdown: uses `createPortal` into `document.body` with fixed positioning from `getBoundingClientRect()`
