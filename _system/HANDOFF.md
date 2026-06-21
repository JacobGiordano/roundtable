Last updated: 2026-06-21 (ship wave: #241, #199, #149, #150, #136, #146, #147, #151)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Aria megabatch + Arch types (#241, #199, #149, #150, #136, #146, #147, #151)**

- **Aria #241**: ThreadActionMenu sub-states (confirm-delete, group-input, rename) now use `role="dialog" aria-modal="true"`. Ada caught `role="group"` as a blocker; fixed in session. `data-menu-container` attr for test selectors.
- **Aria #199**: InteractionModeSwitcher radiogroup gets `aria-owns` pointing to enabled radio IDs only. Coming-soon spans have no role/ID.
- **Aria #149**: `useClickOutside` consolidated from 4 impls → `/src/ui/hooks/useClickOutside.ts` (mousedown).
- **Aria #150**: `ChevronIcon` shared component at `/src/ui/components/ChevronIcon.tsx`, 3 inline defs eliminated.
- **Aria #136**: `sidebarUtils.ts` extracted from `Sidebar.tsx` (`filterByArchiveStatus`, `deriveExistingGroups`, `resolveGroupInput`, `isAllSelected`, `getThreadTitle`).
- **Aria #146**: `ThreadActionMenu` extracted to `/src/ui/components/ThreadActionMenu.tsx`.
- **Aria #147**: Shared icon system at `/src/ui/icons/index.tsx` — 8 icons, all `aria-hidden="true"`. Pre-existing `GhostIcon` in `InputBar.tsx` deferred as follow-up.
- **Arch #151**: `BuiltInModelId` JSDoc updated with runtime enumeration single-source rule. Gate follow-up required (see below).
- **Ada**: PASS on all 7 Aria issues (one blocker on #241 caught and fixed in session).
- **Flint**: cleared wave. 1108/1108 tests passing.

## Key decisions

- ThreadActionMenu sub-states: `role="dialog" aria-modal="true"` is the correct pattern — not `role="menu"` (violates aria-required-children) and not `role="group"` (insufficient, Ada-blocked).
- `useClickOutside` uses `mousedown` (not `click`) — matches all 4 original implementations and their tests.
- Shared icon system: 8 icons in `/src/ui/icons/index.tsx`. Remaining inline icons (e.g. `GhostIcon` in `InputBar.tsx`) deferred to follow-up.
- `BuiltInModelId` runtime consolidation is Gate's work: create `/src/auth/builtinModelIds.ts` exporting `BUILTIN_MODEL_IDS: ReadonlySet<BuiltInModelId>` and update `modelVersion.ts`, `providerRoster.ts`, `accentColors.ts` to import it. Arch's JSDoc documents the rule.
- Aria `ALL_BUILTIN_IDS` in `ProviderSettingsPanel.tsx:68` should consume Gate's constant (or an Arch-surfaced re-export) — part of #151 follow-up.

## Open advisories (filed this wave)

- **NEW** — Stale comment in `ThreadActionMenu.tsx:29-31` describes a re-export that doesn't exist (cleanup)
- **NEW** — `GhostIcon` inline in `InputBar.tsx:47` duplicates shared icon system (follow-up to #147)
- **NEW** — `ExportButton` menuitem buttons missing `tabIndex={-1}` + focus ring (Ada advisory, pre-existing)
- **NEW** — `ChevronIcon` / `RightChevronIcon` missing `motion-reduce:transition-none` (Ada advisory)
- #238 (Gate/Atlas) — Custom provider credential testing
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #160 (Aria) — Conversation search/filter
- #156 (Gate/Arch) — localStorage key naming conventions
- #154 (Vault) — migrateLocalToServer interface misuse

## What's next

Top candidates:
- **Gate: #151 continuation** — create `builtinModelIds.ts`, update 3 Gate files + Aria `ProviderSettingsPanel.tsx`
- **Aria: #160** — conversation search/filter (next real feature)
- **Gate/Arch: #156** — localStorage key naming (can parallel with Aria if no type dependency)
- **Ada advisory sweep** — 4 new advisories just filed, batch with next Aria session

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
- ThreadActionMenu sub-states: `role="dialog" aria-modal="true"` not `role="menu"` (aria-required-children violation)
