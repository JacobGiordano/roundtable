Last updated: 2026-06-20 (ship #174 #145 #140 + Wave 18 polish)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Three-issue wave (Aria + Scout + Quill, parallel worktrees) + Coda post-merge polish:

- **#174 (Aria)**: AppLayoutProps prop drilling eliminated. New `RoundtableContext.tsx`
  exposes `useRoundtable()` with a 35-field value shape. `App.tsx` is the Provider;
  `AppLayout.tsx` reduced to one prop (`onSend`). `onSend` kept as a prop because
  `handleSend` closes over `accumulatorRef` (mutable ref) — putting it in context
  creates staleness risk. Ada: PASS, no blockers.

- **#145 (Scout)**: 94 Vitest unit tests for `providerRoster.ts` in
  `/src/tests/auth/providerRoster.test.ts`. Full lifecycle coverage + `MODEL_CREDENTIAL_MAP`
  sync guard. No bugs found. Suite: 909 → 1003 passing.

- **#140 (Quill)**: Forge and Bastion added to two tables in `CONTRIBUTING.md`.

- **Coda polish**: Integration tests updated to capture from `RoundtableContext`
  (old spy read props that no longer exist post-#174). `eslint.config.js` now ignores
  `.claude/worktrees/**`. Scout's test lint errors fixed (as-unknown-as casts, delete
  on optional props). Duplicate JSDoc on `handleRenameConversation` in `App.tsx` removed.

## Key decisions

- `onSend` stays as a prop (not in context) — closes over `accumulatorRef`, a mutable
  ref React can't track. Direct prop keeps the contract explicit.
- Context shape is UI-internal (`RoundtableContext.tsx`), not in `/src/types/index.ts`
- `.claude/worktrees/**` added to eslint ignores — prevents parallel agent worktrees
  from polluting lint output during wave sessions.

## Open advisories (filed, not yet addressed)

- #232 (Gate/Aria) — Custom provider endpoints not editable; must delete/recreate
- #230 (Aria) — Sidebar group-input Cancel doesn't return focus to trigger
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 (Vault) — StorageProvider pagination
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #159 (Atlas/Aria) — Cancel streaming
- #158 (Aria) — useStreamingMessages hook extraction (App.tsx god component)

## What's next

Top priority:
- Aria: **#232** (custom provider endpoint editing) — now unblocked; #174 cleared the
  prop-drilling that would have conflicted
- Aria: **#230** (Sidebar group-input Cancel focus return) — small, can batch with #232
- Atlas: wire `fetchLiveApiCatalog` / `fetchRemoteCatalog` into version picker (follow-on #177)

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
- 6 pre-existing test failures in `provider-settings-panel.test.tsx` — not regressions
- App integration tests (app-chunk-handler, app-handler-paths) now read from `lastContextValue`
  (RoundtableContext), not `lastAppLayoutProps` — future Scout work must follow this pattern
