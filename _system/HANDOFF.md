Last updated: 2026-06-22 (ship: #247 ThreadActionMenu closeAndReturnFocus + #248 SearchBar SVG doc)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#247 (Aria)**: ThreadActionMenu confirm-delete and group-suggestion handlers now call `closeAndReturnFocus()` instead of bare `onClose()`. Focus returns to `triggerRef.current` via double-rAF pattern. WCAG 2.4.3 satisfied. Ada PASS (43/43). Flint PASS.

**#248 (Aria)**: icons/index.tsx header comment now documents SearchBar's magnifying glass SVG as the named inline exception — intentionally inline because it applies Tailwind classes directly on path elements, incompatible with the fixed-size `IconProps` contract.

## Open bugs / known issues

- **ExportButton Escape** — pre-existing test failure, 1 test. WAI-ARIA menu ArrowDown/Up wiring absent. Separate component from AddModelButton/ThreadActionMenu.

## Key decisions

- `closeAndReturnFocus()` via double-rAF is the canonical focus-restoration pattern for all menu close actions — confirm-delete, group-set, escape, trigger re-click.
- SearchBar inline SVG is documented as the one named exception to the icon system.

## Open advisories

- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

1. **Ada/Aria: #199** — InteractionModeSwitcher radiogroup ownership fix
2. **Ada: #180** — Live browser keyboard audit

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
- MessageBubble + OnboardingEmptyState + SearchBar magnifying glass SVGs remain inline (#248 documented SearchBar as named exception)
- AddModelButton dropdown: uses `createPortal` into `document.body` with fixed positioning from `getBoundingClientRect()`
- `activeFocusIndexRef` (useRef) for menu keyboard nav — not useState; avoids re-render per keypress
