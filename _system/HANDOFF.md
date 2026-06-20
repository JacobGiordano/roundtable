Last updated: 2026-06-20 (ship Wave 20 — #239, #240)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Two-issue wave (Aria, single session):

- **#239 (Aria)**: API key input now full-width in `ProviderSettingsPanel.tsx`. Save/Cancel/Remove-key
  buttons moved to their own row below the input. Eye toggle stays overlaid inside the input.

- **#240 (Aria)**: New `TestButton` component. Custom providers: `aria-disabled` (not `disabled` —
  keeps button in tab order) with tooltip "Key testing isn't available for this provider. Start a
  conversation to verify your connection." Tooltip shows on hover (600ms delay) and immediately on
  focus. Built-in supported providers: button enabled (actual `testCredential()` call wiring deferred
  to #238). Edit/Clear buttons now have `aria-label`; position stable regardless of Test state.

  Side effect: 6 pre-existing `provider-settings-panel.test.tsx` failures now resolved — Edit button
  `aria-label` additions fixed the missing-label assertions. Suite: 1019 passing, 0 failing.

## Key decisions

- `aria-disabled` instead of `disabled` on TestButton — Ada blocker caught in-session. `disabled`
  removes the element from tab order, preventing keyboard users from discovering the tooltip.
- Actual `testCredential()` wiring for built-in providers deferred — tracked as #238 (Gate/Atlas).
- Custom endpoint testing (#238) requires CORS + keyless edge case work before it's trustworthy.
- Coda scope rule: coordination-layer reads only; deep component reads are the agent's job.

## Open advisories (filed, not yet addressed)

- #238 (Gate/Atlas) — Custom provider credential testing (CORS/keyless edge cases)
- #237 (Aria/Ada) — AccentColor `<label>` not associated with form control (pre-existing in AddCustomForm)
- #236 (Aria/Ada) — Sidebar group-input Tab key exits menu instead of cycling controls
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
- Aria/Atlas: #159 (Cancel streaming) — Atlas AbortController first, then Aria stop button

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
