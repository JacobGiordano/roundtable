Last updated: 2026-06-20 (ship Wave 19 — #232, #230, #142)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Three-issue wave (Gate + Aria parallel, then Aria #232 UI follow-up):

- **#232 (Gate)**: `updateCustomProvider(id, { displayName, endpointUrl, modelString, color? }): void`
  added to `providerRoster.ts`, exported from `index.ts`. `credentialKey` is structurally
  immutable (not in input type). 10 new tests, suite 1013 passing.

- **#232 (Aria)**: Pencil icon button on custom provider rows in `ProviderSettingsPanel.tsx`.
  Inline edit form (displayName, endpointUrl, modelString, accent color) expands below row.
  Save calls `updateCustomProvider` then `onUpdated` (→ `refreshRoster`). Cancel/Escape returns
  focus to pencil via double-rAF. Ada: PASS, no blockers.

- **#230 (Aria)**: `Sidebar.tsx:523` group-input Cancel changed from `onClose` to
  `closeAndReturnFocus`. Focus now returns to three-dot trigger after cancelling group assignment.

- **#142 (Aria)**: `InputBar.tsx` `handleKeyDown` — Escape clears directed-reply pill when
  `directedReplyTarget` is set and `!editingMessage`. `e.stopPropagation()` prevents dropdown
  side effects. Focus stays in textarea.

## Key decisions

- Aria's #232 UI was sequenced after Gate (not truly parallel) because Aria can't compile
  against a function that doesn't exist in her worktree. Gate merged first; Aria pulled main.
- `credentialKey` is NOT editable in the provider edit form — structurally enforced by the
  input type. This was an explicit Gate design decision to protect saved API keys.
- Coda scope rule saved: Coda reads coordination-layer facts only (git log, issue bodies,
  exported symbols via grep). Deep component reads are the agent's job.

## Open advisories (filed, not yet addressed)

- #237 (Aria/Ada) — AccentColor `<label>` not associated with form control (pre-existing in AddCustomForm too)
- #236 (Aria/Ada) — Sidebar group-input Tab key exits menu instead of cycling controls
- #232 (Gate/Aria) — Custom provider endpoints not editable; must delete/recreate — **CLOSED this wave**
- #230 (Aria) — Sidebar group-input Cancel focus return — **CLOSED this wave**
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

Top candidates:
- Atlas: wire `fetchLiveApiCatalog` / `fetchRemoteCatalog` into version picker (#177 follow-on)
- Aria: #158 (useStreamingMessages hook extraction) — App.tsx god component
- Aria: #159 (Cancel streaming) — needs Atlas AbortController first

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
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
