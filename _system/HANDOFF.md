Last updated: 2026-06-22 (ship: #253 AddModelButton WAI-ARIA keyboard nav)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#253 (Aria)**: AddModelButton now implements the full WAI-ARIA Menu Button keyboard contract. Open → focus first menuitem (single rAF via useEffect([isOpen])). ArrowDown/Up with end-to-end wrap. Home/End to first/last. Escape: closeAndReturn() returns focus to trigger. Tab: no trap. Trigger re-click while open: closeAndReturn() (was bare closeDropdown()). Menuitems: tabIndex={-1}. 28 new Ada tests pass. 1370/1370 + 7 skipped + 1 pre-existing ExportButton Escape.

**Flint**: PASS — all acceptance criteria verified.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent. Related to #253 scope (AddModelButton is now fixed; ExportButton is a separate component).

## Key decisions

- `activeFocusIndexRef` (useRef, not useState) is the correct way to track keyboard focus index in menus — avoids re-render per keypress.
- Single rAF in `useEffect([isOpen])` is sufficient for focus-on-open — items already in DOM, no double-rAF needed.
- `closeAndReturn()` is the correct pattern for both Escape and trigger re-click (not bare closeDropdown()).
- `tabIndex={-1}` + `focus:outline-none` on menuitems is correct for programmatic-only focus targets.

## Open advisories

- #247 (Aria) — ThreadActionMenu: group-suggestion and confirm-delete buttons skip closeAndReturnFocus (WCAG 2.4.3)
- #248 (Aria) — Document SearchBar magnifying glass as inline exception in icons/index.tsx
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

1. **Aria: #247** — ThreadActionMenu closeAndReturnFocus (WCAG 2.4.3)
2. **Aria: #248** — SearchBar inline SVG exception comment (tiny, batch with #247)

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
- `activeFocusIndexRef` (useRef) for menu keyboard nav — not useState; avoids re-render per keypress
