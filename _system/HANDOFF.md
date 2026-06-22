Last updated: 2026-06-21 (ship: wave — Aria #146 file splits + #147 icon system + Ada #246 regression test)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Aria #146 + #147 (batched) + Ada #246 (parallel)**

- **#146 (Aria)** — Sidebar.tsx 1379→813 lines (41% reduction); ModelSelectorPanel.tsx 1138→402 lines (65% reduction). Sub-components extracted:
  - sidebar/: ThreadRow, BulkActionBar, SearchBar, SidebarChrome
  - model-selector/: ModelPill, AddModelButton, SystemPromptRow, ModelVersionRow, SessionTokenSection
  Pure refactor — no behavior changes.
- **#147 (Aria)** — 8 new icons in /src/ui/icons/index.tsx: MenuIcon, EyeIcon, EyeOffIcon, EditIcon, TrashIcon, StopIcon, SendIcon, SmallCloseIcon. Consumers migrated: AppLayout, InputBar, SearchBar, SystemPromptRow, ModelSelectorPanel, ProviderSettingsPanel. MessageBubble + OnboardingEmptyState remain inline (no cross-file duplication).
- **#246 (Ada)** — 4 regression tests added to thread-action-menu.test.tsx verifying group-input aria-label="Group name" persists and is not sourced from placeholder.
- **Ada audit (Aria session)**: PASS — 3 advisories filed (see below). 75 new a11y tests.
- **Flint**: PASS — 1327/1328 green (pre-existing ExportButton Escape failure only).

## Key decisions

- `roundtable:` prefix (colon separator, kebab-case) is the canonical localStorage convention for all new keys.
- Migration shims live in place for one release cycle, then get removed.
- ThreadActionMenu backdrop pattern is intentional — backdrop blocks hover bleed; `useClickOutside` is for non-modal dropdowns only.
- `cors-or-network` is a distinct TestResult status — allows UI to surface informative message for custom endpoints.
- `MODEL_REGISTRY` from `@/models` is a permitted Aria import (read-only data) — document with comment at import site.
- MessageBubble + OnboardingEmptyState SVGs remain inline — no cross-file duplication, no extraction needed.
- SearchBar magnifying glass SVG remains inline — single-use, not a duplicate; inline-exception rationale in icons/index.tsx header should document it (#248 filed).

## Open advisories

- #248 (Aria) — Document SearchBar magnifying glass as inline exception in icons/index.tsx header
- #247 (Aria) — Focus-return on group-suggestion buttons; UX decision needed for post-delete focus target
- #245 (Ada/Aria) — SystemPromptRow: aria-controls references conditionally rendered element — use hidden={!isExpanded} pattern
- #244 (Aria) — SystemPromptRow: requestAnimationFrame in setState callback — refactor to useEffect
- #243 (Ada/Aria) — AddModelButton: role="menu" lacks ArrowDown/Up keyboard navigation — use ExportButton pattern
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next (visual check pending)

**Before starting the next wave:** run dev server and verify:
1. ApiKeyPanel custom provider UI (KeylessEndpointRow, test button, `? CORS / network` warning) — from Gate #238 last wave
2. Sidebar sub-components render correctly (ThreadRow, BulkActionBar, SearchBar, SidebarChrome)
3. ModelSelectorPanel sub-components render correctly (ModelPill, AddModelButton, SystemPromptRow)
4. Icon consumer pages show correct icons (AppLayout hamburger/gear, InputBar stop/send, ProviderSettingsPanel eye/edit/trash)

**Next issues:**
- **Aria: #247** — Focus-return on group-suggestion buttons (UX decision needed first)
- **Aria: #243** — AddModelButton ArrowDown/Up keyboard nav (a11y blocker-adjacent)
- **Aria: #245** — SystemPromptRow aria-controls fix

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount (single rAF OK when no unmount involved)
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
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring alongside `tabIndex={-1}` — pre-existing test failure in ExportButton Escape (unrelated to recent waves)
- `BUILTIN_MODEL_IDS` from `@/auth` is the only Gate import Aria is normally permitted; `MODEL_REGISTRY` from `@/models` is also permitted (read-only data) — both require comment at import site
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` shims in place — remove after one release cycle
- `useClickOutside` uses `mousedown`; ThreadActionMenu uses backdrop instead — not a regression
- `testCustomCredential` (Gate): `cors-or-network` = CORS blocked or network error, not a bad key; built-in providers return `error` on network failure
- `TestResult` type lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
- Sub-component directories: sidebar/ and model-selector/ under /src/ui/components/ — new in this wave
