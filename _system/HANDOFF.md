Last updated: 2026-06-20 (ship Wave 21 — #158, #236, #237)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Three-issue Aria wave (single session):

- **#158 (Aria)**: `useStreamingMessages` hook extracted from `App.tsx`. New file
  `/src/ui/useStreamingMessages.ts`. Hook owns streaming accumulator state, `accumulatorRef`,
  and chunk-processing logic. App.tsx consumes via `handleChunk(sendingConversationId)` and
  `handleMessageComplete` callback. Pure refactor — no behavior change.

- **#236 (Aria)**: Sidebar group-input/rename sub-states: Tab/Shift+Tab now cycles within
  `[data-substate]` panel instead of exiting the menu. Escape closes and returns focus to
  trigger via double-rAF. WCAG 2.1 SC 2.1.1.

- **#237 (Aria)**: Accent color `<label htmlFor>` / `<button id>` association fixed in both
  `AddCustomForm` and the edit-provider form. Dynamic id pattern (`edit-accent-color-btn-${id}`)
  prevents collisions across multiple custom providers.

Ada audit: 1036 passing, 0 failing. Flint: READY TO ADVANCE.

## Key decisions

- `useStreamingMessages` hook is storage-agnostic — persistence/ghost-mode routing stays in
  App.tsx via `onMessageComplete` callback to avoid cross-agent boundary violations.
- `[data-substate]` as the Tab-cycling anchor (not role or class) — stable across sub-state
  type changes without a lookup table.

## Open advisories (filed, not yet addressed)

- #241 (Aria/Ada) — ThreadActionMenu `role="menu"` aria-required-children violation in sub-states (pre-existing)
- #238 (Gate/Atlas) — Custom provider credential testing (CORS/keyless edge cases)
- #237 resolved ✓
- #236 resolved ✓
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 (Vault) — StorageProvider pagination
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #159 (Atlas/Aria) — Cancel streaming
- #158 resolved ✓

## What's next

Top candidates:
- Atlas: wire `fetchLiveApiCatalog` / `fetchRemoteCatalog` into version picker (#177 follow-on)
- Aria/Atlas: #159 (Cancel streaming) — Atlas AbortController first, then Aria stop button
- Aria: #241 (ThreadActionMenu sub-state role fix) — straightforward structural change

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
