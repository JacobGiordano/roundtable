Last updated: 2026-06-21 (ship: wave — Gate #151 canonical BUILTIN_MODEL_IDS + Aria #151 consumer + #160 conversation search)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Gate #151 + Aria #151 consumer + Aria #160**

- **Gate #151** — `/src/auth/builtinModelIds.ts` created; exports `BUILTIN_MODEL_IDS: ReadonlySet<BuiltInModelId>`. `modelVersion.ts`, `providerRoster.ts`, `accentColors.ts` updated to import from it. `src/auth/index.ts` re-exports for cross-agent consumption.
- **Aria #151 consumer** — `ProviderSettingsPanel.tsx`: local `ALL_BUILTIN_IDS` array removed; replaced with `[...BUILTIN_MODEL_IDS].filter(...)` imported from `@/auth` (documented cross-agent exception).
- **Aria #160 — Conversation search/filter** — `SearchBar` added to `Sidebar.tsx` between archive toggle and conversation list. `filterBySearchQuery()` in `sidebarUtils.ts`: case-insensitive match on title + first-user-message. Escape clears + stops propagation; clear (×) button returns focus via rAF. Empty state: "No conversations match your search." Archive tab change clears query.
- **Ada**: PASS (one inline fix: removed redundant `role="searchbox"` from `<input type="search">`).
- **Flint**: PASS — all criteria met, 1128/1129 tests green (1 pre-existing ExportButton Escape failure).

## Key decisions

- `BUILTIN_MODEL_IDS` is the single runtime source for all builtin model ID enumeration; Gate owns it, Aria imports from `@/auth` (exception documented with comment).
- `filterBySearchQuery` chains after `filterByArchiveStatus` — archive tab change clears search query to prevent cross-tab stale state.

## Open advisories

- #238 (Gate/Atlas) — Custom provider credential testing
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #156 (Gate/Arch) — localStorage key naming conventions
- #154 (Vault) — migrateLocalToServer interface misuse

## What's next

- **Gate/Arch: #156** — localStorage key naming conventions (Gate + Arch, no Aria dependency)
- **Gate/Atlas: #238** — Custom provider credential testing
- **Aria: #160 is done** — next Aria issue is #170 (Backend auth UI) or pick from backlog

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
- ThreadActionMenu sub-states: `role="dialog" aria-modal="true"` not `role="menu"` (aria-required-children violation)
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring alongside `tabIndex={-1}` — pre-existing test failure in ExportButton Escape (unrelated to recent waves)
- `BUILTIN_MODEL_IDS` from `@/auth` is the only Gate import Aria is permitted — document with comment at import site
