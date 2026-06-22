Last updated: 2026-06-22 (ship: #257/#258/#259 — WCAG 2.2 upgrade blockers)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#257 (Aria)**: 12 WCAG 2.5.8 target-size fixes across 8 files — directed-reply clear button, thread row + bulk action bar checkbox 24px wrappers, ArchiveToggle h-8, Reset/Provider-settings/ModelVisibilityBar/BulkActionBar action button padding bumps, copy/edit/three-dot w-7, MSP trigger chips h-7. Lint/build/tests clean.

**#258 (Aria)**: 3 WCAG 2.4.11 focus-not-obscured fixes — `inert` on `<main>` when mobile sidebar is open, Tab/Shift+Tab focus trap in ModelSelectorPanel, ProviderSettingsPanel already had a trap (comment-only update). Lint/build/tests clean.

**#259 (Aria + Ada)**: Ada caught WCAG 2.1.2 blocker — MSP focus trap had no Escape exit. Aria added `triggerRef` + Escape handler in `handleFocusTrap`. Ada wrote 11 new a11y tests (6 MSP focus-trap, 5 mobile-sidebar-inert) — all pass. Flint PASS (inline gate).

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent.

## Key decisions

- Checkbox 24px target: wrapper div (`min-w-[24px] min-h-[24px] flex items-center justify-center`) is the correct approach for native `<input type="checkbox">` — no ARIA role on wrapper, label association intact.
- Focus trap Escape must always close the panel and return focus to trigger (WCAG 2.1.2 + 2.4.3).
- `inert=""` on `<main>` (not a child) is the canonical mobile sidebar focus guard pattern.

## Open advisories

- #180 (Ada) — Live browser keyboard audit — needs narrow viewport dev-server run
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## Visual review needed

- **Mobile sidebar inert**: open drawer on narrow viewport, Tab through sidebar, confirm focus does not escape to main content.
- **ModelSelectorPanel focus trap**: open panel, Tab to last element (Provider settings button), confirm Tab wraps to first; press Escape, confirm panel closes and focus returns to trigger chip.

## What's next

1. **Dev-server visual review** — mobile sidebar inert + MSP focus trap (see above)
2. **Ada: #180** — Live browser keyboard audit (after visual review passes)
3. **Flint reliability** — stopping protocol (mirrors Ada's — see conversation)

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
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (SearchBar documented as named exception in icons/index.tsx)
- AddModelButton dropdown: uses `createPortal` into `document.body` with fixed positioning from `getBoundingClientRect()`
- `activeFocusIndexRef` (useRef) for menu keyboard nav — not useState; avoids re-render per keypress
- `aria-owns` cannot remove DOM children from ARIA ownership tree — do not use as exclusion mechanism
- WCAG 2.5.8 blockers resolved in #257; WCAG 2.4.11 focus-not-obscured resolved in #258/#259
- MSP focus trap Escape handler is in `handleFocusTrap` useEffect listener — cleanup removes it; `triggerRef` on trigger chip for focus return
