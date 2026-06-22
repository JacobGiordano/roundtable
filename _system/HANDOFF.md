Last updated: 2026-06-22 (ship: #199 InteractionModeSwitcher radiogroup + #181 WCAG 2.2 upgrade plan)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#199 (Aria)**: InteractionModeSwitcher coming-soon spans promoted to `role="radio" aria-disabled="true" tabIndex={0}`. `aria-owns` removed from radiogroup container. WCAG 2.4.3 and ARIA required-children satisfied. Ada PASS (12/12 component tests). Flint PASS.

**#181 (Ada)**: WCAG 2.2 upgrade path plan written to `/src/tests/a11y/wcag22-upgrade-plan.md`. 4 confirmed blockers (2.5.8 target size) and 3 moderate risks (2.4.11 focus not obscured) identified with file/line references and actionable Tailwind fixes. Flint PASS.

**Ada profile update**: Stopping protocol added — baseline run is now conditional on writing new tests; explicit "run once, evaluate, report, stop" rule added to prevent looping.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent.

## Key decisions

- `role="radio" aria-disabled="true" tabIndex={0}` is the correct pattern for disabled radiogroup members — they must be valid radio children, not unstyled spans.
- `aria-owns` cannot remove DOM children from ARIA ownership tree (ARIA 1.2) — do not use it as an exclusion mechanism.

## Open advisories

- #181 blockers (Aria): 4 WCAG 2.5.8 target-size failures need Tailwind sizing fixes — directed-reply clear button, thread row checkbox, bulk action checkbox, archive toggle
- #181 moderate risks (Aria): mobile sidebar + ModelSelectorPanel focus traps missing (2.4.11)
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

1. **Aria: #181 blockers** — WCAG 2.5.8 target-size fixes (4 confirmed + 4 serious; see `/src/tests/a11y/wcag22-upgrade-plan.md`)
2. **Aria: #181 moderate** — mobile sidebar + MSP focus trap fixes (2.4.11)
3. **Ada: #180** — Live browser keyboard audit

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
- WCAG 2.5.8 blockers documented in `/src/tests/a11y/wcag22-upgrade-plan.md` — 4 confirmed, 4 serious
