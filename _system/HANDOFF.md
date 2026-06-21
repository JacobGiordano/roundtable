Last updated: 2026-06-20 (ship wave: #243, #244, #175, #144)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: test contracts + focus fix + cache + types (#243, #244, #175, #144)**

- **Scout #243**: `sidebar-state-machines.test.tsx` sub-state queries moved from `within(menu).getBy*()` to `screen.getBy*()` — resilient to #241 DOM restructure. `within(menu)` kept for `queryAllByRole('menuitem')` only. #241 is now unblocked.
- **Aria #244**: Stop button receives focus via double-rAF on send→stop swap; focus returns to textarea on stop→send. `hasStreamedRef` guard prevents false-fire on initial render. Ada: PASS (11 a11y tests).
- **Vault #175**: In-memory `Map` cache on `LocalStorageProvider`. First `listConversations()` scans, subsequent calls serve from cache. `saveConversation()` and `deleteConversation()` keep cache in sync. Ghost-mode guard fires before any cache write. Interface unchanged.
- **Arch #144**: `SessionTokenUsage` is now `type SessionTokenUsage = { modelId: ModelId } & TokenUsage`. Eliminates 4 duplicated fields. Zero downstream breakage. PR #245 merged.
- **Flint**: cleared all 4 issues.

## Key decisions

- Vault cache is implementation-internal — `StorageProvider` interface unchanged. True cursor-based pagination (listConversations with offset/limit) still needs an Arch types PR when warranted.
- Arch used `type` alias (not `interface extends`) for the intersection — more direct, communicates intent at a glance.
- Slack notification hook fixed: `rm -f /tmp/claude-prompt-start` now inside the `[ $elapsed -gt 60 ]` branch so the start timestamp persists across quick stops during long agent waves.

## Open advisories (filed, not yet addressed)

- #241 (Aria/Ada) — ThreadActionMenu `role="menu"` aria-required-children in sub-states — **NOW UNBLOCKED, top priority**
- #244 done; next Ada a11y issue is #199 (InteractionModeSwitcher radiogroup ownership)
- #238 (Gate/Atlas) — Custom provider credential testing (CORS/keyless edge cases)
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 done; pagination follow-up still needs Arch types PR
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #160 (Aria) — Conversation search/filter
- #156 (Gate/Arch) — localStorage key naming conventions
- #154 (Vault) — migrateLocalToServer interface misuse
- #151 (Arch/Gate) — BuiltInModelId consolidation
- #150 (Aria) — ChevronIcon duplication
- #149 (Aria) — useClickOutside 4 implementations
- #147 (Aria) — No shared icon system
- #146 (Aria) — Sidebar.tsx/ModelSelectorPanel.tsx splitting
- #144 done
- #136 (Aria) — Sidebar.tsx inlining sidebarUtils

## What's next

Top candidates:
- **Aria: #241** (ThreadActionMenu role fix) — unblocked, high priority
- **Aria: #199** (InteractionModeSwitcher radiogroup) — a11y, Ada follow-up
- **Aria: refactor wave** — #136, #146, #147, #149, #150 (batch to avoid double Ada overhead)
- **Arch/Gate: #151, #156** — can run parallel with Aria if no type dependency

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
