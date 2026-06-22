Last updated: 2026-06-22 (ship: hotfix #256 SystemPromptRow clear button + wave #252/#254/#255)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Gate #252 + Aria #254/#255 + hotfix #256**

- **#252 (Gate)**: `testCredential` catch block now returns `cors-or-network` on fetch throw. `testCredential` and `testCustomCredential` now behave consistently. 42/42 tests pass.
- **#254 (Aria)**: `handleToggle` is a pure updater. rAF focus moved to `useEffect([isExpanded])`. Eliminates Strict Mode double-invocation hazard.
- **#255 (Aria)**: Expandable body always in DOM; `hidden={!isExpanded}` controls AT visibility. `aria-controls` always resolves.
- **#256 (Aria hotfix)**: Clear button invisible after #255 — GPU compositing stale layer on `display:none` → visible transition. Fix: `isolate` on `relative` wrapper + `z-10` on clear button.

**Flint**: PASS all four — 1342/1342 + 7 skipped + 1 pre-existing ExportButton Escape.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent. Related to #253 scope.

## Key decisions

- `cors-or-network` is now consistent across both `testCredential` and `testCustomCredential` — both return it on fetch throw.
- `hidden` attribute (not `aria-hidden`) is the correct pattern for `aria-controls` progressive disclosure targets.
- `useEffect([isExpanded])` is the correct place for post-mount focus side effects — not inside setState updaters.
- `isolate` + `z-10` is the fix for absolutely-positioned children going invisible after a `hidden` → visible transition (GPU compositing stale layer).

## Open advisories

- #253 (Ada/Aria) — AddModelButton: role="menu" lacks ArrowDown/Up keyboard navigation
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

1. **Aria: #253** — AddModelButton ArrowDown/Up/Home/End keyboard nav (a11y, save for fresh window — meaty)
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
- Absolutely-positioned children inside a `hidden` parent can go invisible on reveal due to GPU compositing — fix with `isolate` on the wrapper + `z-10` on the child
- `TESTABLE_CREDENTIAL_KEYS` in ProviderSettingsPanel must stay in sync with Gate's `PROVIDER_TEST_CONFIGS`
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (#248 to document SearchBar)
- AddModelButton dropdown: uses `createPortal` into `document.body` with fixed positioning from `getBoundingClientRect()`
