Last updated: 2026-06-21 (ship: advisory batch — stale comment, GhostIcon, ExportButton focus, motion-reduce)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: 4 Ada advisories (Aria)**

- **Stale comment removed** — `ThreadActionMenu.tsx:28-30`: comment claiming `getThreadTitle` is re-exported from this file was false; removed.
- **GhostIcon migrated** — `InputBar.tsx`: inline 24-line function replaced with `import { GhostIcon } from './icons'` (closes #147 follow-up).
- **ExportButton keyboard contract** — `ExportButton.tsx`: `tabIndex={-1}` on menuitems, `useEffect` focuses first item on open, `onKeyDown` on `role="menu"` implements ArrowDown/ArrowUp cycling + Tab/Escape → close + return focus. Ada caught missing arrow-key wiring as a blocker; fixed in session.
- **motion-reduce** — `ChevronIcon.tsx` and `RightChevronIcon` in `icons/index.tsx`: `motion-reduce:transition-none` added to transition classes.
- **Ada**: PASS (one blocker caught and fixed in session — ExportButton unreachable by keyboard).
- **Flint**: cleared wave.

## Key decisions

- ExportButton keyboard contract pattern: matches `ThreadActionMenu` sub-state pattern (Ada-audited). WAI-ARIA menu: ArrowDown/Up cycle with wrap, Tab/Escape close + return focus to trigger.
- All inline icon definitions now eliminated from `InputBar.tsx`; shared icon system (#147) is the single source of truth.

## Open advisories

- **Gate: #151 continuation** — create `/src/auth/builtinModelIds.ts` exporting `BUILTIN_MODEL_IDS: ReadonlySet<BuiltInModelId>`, update `modelVersion.ts`, `providerRoster.ts`, `accentColors.ts` in Gate; Aria consumes in `ProviderSettingsPanel.tsx:68`.
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

- **Gate: #151 continuation** — highest priority; no type dependency, no Arch needed
- **Aria: #160** — conversation search/filter (next real feature)
- **Gate/Arch: #156** — can parallel with Aria if #151 is done first

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
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring alongside `tabIndex={-1}` — `tabIndex` alone leaves items keyboard-unreachable
