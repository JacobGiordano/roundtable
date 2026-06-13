Last updated: 2026-06-13 (ship #101)

## Current phase

Phase 4+ — Custom provider infrastructure complete. All model selector edge states implemented.

## Session summary

- Aria: closed #101 — Model selector edge states. §3.4: "Add providers" chip (with `+` icon, no chevron) replaces the old plain-text placeholder when roster is empty; clicking opens ProviderSettingsPanel directly. §3.3: "No models active" dashed placeholder chip renders in the pill row when `activeCount === 0` and `models.length > 0`. InputBar gains `activeModelCount` prop — when 0, send button disabled and textarea placeholder reads "Add a model to start chatting".

## Open issues

None. All Phase 4 work is complete.

## What's next

Candidates for the next session:
- Per-provider credential management in ProviderSettingsPanel — currently shows "Key set" / "No key" status badges but provides no way to edit or clear an existing key value. Likely a Gate + Aria issue pair.
- Tests for ProviderSettingsPanel and OnboardingEmptyState — Aria flagged these as good candidates; Ada flagged axe-violations tests as high value.
- Gate guard: `getRequiredCredentialKeys` iterates `ModelConfig[]` and calls `MODEL_CREDENTIAL_MAP[model.modelId]` with no guard for custom model IDs — will throw/return undefined for custom providers. Small Gate fix.
- Roster live-update: `models` state in `App.tsx` is NOT re-derived on roster change (only `isRosterEmpty` is). If a user adds/removes a provider from the panel, the model selector pills don't update until reload. This will surface as a UX bug once users interact with the panel.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees can cause Vitest to discover test files twice — always `git worktree remove --force` before running the final test suite
- `isRosterEmpty` recomputes on panel close only; `models` state does NOT re-derive on roster change — both are gotchas for any future work touching panel → selector reactivity
- `addCustomProvider()` returns the config with generated `credentialKey` — `saveCredentials(newConfig.credentialKey, apiKeyValue)` is called separately (non-atomic)
- Gate: `getRequiredCredentialKeys` needs a guard for custom model IDs (not yet fixed)
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- Single-PR rule on types/index.ts — no concurrent Arch PRs
