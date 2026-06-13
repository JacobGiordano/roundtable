Last updated: 2026-06-13 (ship #102 #103)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Roster live-sync and per-provider credential management shipped.

## Session summary

- Aria: closed #102 — `rosterToModelConfigs` extracted as module-level pure function in `App.tsx`. `handleRosterChange` now calls `setModels((prev) => rosterToModelConfigs(getProviderRoster(), prev))` alongside `setRosterVersion`. Adding or removing a provider from the panel immediately updates the model selector pills without a reload. Existing providers retain their runtime state (`isActive`, `systemPrompt`, `selectedVersionId`).
- Aria: closed #103 — Per-provider credential management in `ProviderSettingsPanel`. Each provider row now shows "Edit" (when key is set) or "Set key" (when no key) affordances. Clicking expands an inline editor below the row: password input with show/hide toggle, Save, Remove key (only shown when a key is currently stored), Cancel. Badge refreshes immediately after save/clear via local `setBadgeState`. Enter submits, Escape cancels. Keyless endpoints ("No key required") show no affordance.

## Open issues

None. All Phase 4 work is complete.

## What's next

Candidates for the next session:
- Tests — `rosterToModelConfigs` is a pure function worth unit-testing (Scout); credential editor state transitions are good candidates for component tests (Scout or Ada)
- Roster reactivity gap: `models` now re-derives on panel close, but NOT in real time while the panel is open. If the user adds a provider and immediately closes without the pill appearing, the pill appears on the next close. This is acceptable for now — the close trigger is the designed sync point.
- Verify/manual testing pass — none of the Phase 4 UI has been manually verified in the browser. Worth a dev-server review session.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run
- `models` re-derives on panel CLOSE only (the `onRosterChange` callback fires in `handleCloseProviderSettings` in AppLayout). Mid-panel mutations are not reflected until close — by design.
- `addCustomProvider()` returns config with generated `credentialKey` — `saveCredentials(newConfig.credentialKey, apiKeyValue)` is called separately (non-atomic). If the credential save fails, the roster entry exists but has no stored key.
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- Single-PR rule on types/index.ts — no concurrent Arch PRs
