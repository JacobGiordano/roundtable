Last updated: 2026-06-21 (ship: wave — Vault #154 + Aria #149 tests + Gate #156 + Scout key updates)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Vault #154 + Aria #136/#149/#150 + Gate #156 + Scout**

- **#144 (Arch)** — Closed pre-wave: `SessionTokenUsage = { modelId: ModelId } & TokenUsage` was already in place.
- **#136 (Aria)** — Closed pre-wave: `Sidebar.tsx` already imports `filterByArchiveStatus`/`deriveExistingGroups` from `sidebarUtils.ts`.
- **#150 (Aria)** — Closed pre-wave: `ChevronIcon` already lives at `/src/ui/components/ChevronIcon.tsx` and both consumers import from there.
- **#149 (Aria)** — `useClickOutside` hook existed but lacked unit tests. Added `/src/ui/hooks/useClickOutside.test.ts` (10 tests). ThreadActionMenu intentionally uses backdrop pattern instead of the hook — documented.
- **#154 (Vault)** — `migrateLocalToServer` parameters widened from concrete classes to `StorageProvider` interface.
- **#156 (Gate + Scout)** — Canonical localStorage prefix `roundtable:` applied to all 3 legacy key formats:
  - `rt_key_<cred>` → `roundtable:key:<cred>` (credentials.ts)
  - `roundtable_user_preferences` → `roundtable:user-preferences` (preferences.ts)
  - `rt-ui-sidebar-width` → `roundtable:ui-sidebar-width` (sidebarWidth.ts)
  - Migration-on-read shims in all three files. 68 new unit tests in /src/auth/.
  - Scout updated phase4.spec.ts + auth-models.test.ts to canonical key names.
- **Flint**: PASS — 1206/1207 tests green (1 pre-existing ExportButton Escape failure).

## Key decisions

- `roundtable:` prefix (colon separator, kebab-case) is the canonical localStorage convention for all new keys.
- Migration shims live in place for one release cycle, then get removed.
- ThreadActionMenu backdrop pattern is intentional — backdrop blocks hover bleed; `useClickOutside` is for non-modal dropdowns only.

## Open advisories

- #241 (Ada/Aria) — ThreadActionMenu: role="menu" aria-required-children violation in sub-states
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

- **Gate/Atlas: #238** — Custom provider credential testing (next top priority)
- **Aria: #146** — Sidebar.tsx (1499 lines) + ModelSelectorPanel.tsx (1215 lines) splitting (big)
- **Aria: #147** — Shared icon system (~25 SVGs inlined; big)
- **Aria/Ada: #241** — ThreadActionMenu role violation (blocker-level a11y)

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
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` shims in place — remove after one release cycle
- `useClickOutside` uses `mousedown`; ThreadActionMenu uses backdrop instead — not a regression
