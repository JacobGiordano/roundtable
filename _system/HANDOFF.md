Last updated: 2026-06-13 (Wave 2+3 ship — #95 #97 #98 #99 #100)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Provider settings panel and onboarding shipped.

## Session summary

- Atlas: closed #95 — `sendMessage.ts` now resolves active providers from `ProviderRoster`. Built-ins fall back to static `PROVIDERS`; custom providers instantiated via `createCustomProvider()` on each call. Missing roster entries emit `auth_failure` StreamChunk.
- Luma: closed #97 — Full design spec at `/_design/specs/provider-settings.md` (759 lines) covering provider settings panel, onboarding empty state, and model selector roster-awareness.
- Aria: closed #98 — `App.tsx` seeds `ModelConfig[]` from `getProviderRoster()` instead of `buildDefaultModelConfigs()`. Empty roster → `models = []` with no fallback.
- Aria: closed #99 — `ProviderSettingsPanel` component: slide-in from right, configured list with key-status badges, add built-in chips, custom endpoint form with validation, remove confirmation with last-provider guard, row add/remove animations.
- Aria: closed #100 — `OnboardingEmptyState` component: welcome screen when roster is empty, CTA opens ProviderSettingsPanel, dismisses on first provider add via `onRosterChange` callback.

## Roster change flow (new, affects all agents)

1. `App.tsx` owns `rosterVersion` counter + `isRosterEmpty` derived state
2. `AppLayout.tsx` receives `isRosterEmpty` and `onRosterChange` props
3. Panel close triggers `onRosterChange()` → `rosterVersion` bumps → `isRosterEmpty` recomputes
4. `models` state in `App.tsx` is NOT automatically re-derived on roster change — only `isRosterEmpty` is. If a future issue needs `models` to live-update after a panel action, that wiring needs to be added to App.tsx.

## Open issues

None from Wave 2+3. No new issues filed yet.

## What's next

No issues are currently defined for the next wave. Likely candidates:
- Model selector "Add providers" trigger chip for empty-roster state (from Luma spec section 3.4 — partially deferred from #98)
- Zero-active state placeholder chip in model selector (from Luma spec section 3.3 — deferred from #98)
- Per-provider credential management in ProviderSettingsPanel (currently shows key status but doesn't let user edit/clear existing key values — click-to-edit or inline key field)
- Tests for ProviderSettingsPanel and OnboardingEmptyState (Aria noted these as good candidates; Ada noted axe-violations tests would be valuable)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees can cause Vitest to discover test files twice — always `git worktree remove --force` before running the final test suite
- `isRosterEmpty` recomputes on panel close only (not on open or mid-panel mutations) — sufficient for the current flow but brittle if roster mutations need to reflect in real time elsewhere
- `addCustomProvider()` returns the config with generated `credentialKey` — Aria then calls `saveCredentials(newConfig.credentialKey, apiKeyValue)` separately. The credential is stored after the roster entry; they are not atomic.
- Gate: `getRequiredCredentialKeys` iterates `ModelConfig[]` and calls `MODEL_CREDENTIAL_MAP[model.modelId]` — still needs a guard for custom model IDs (from Wave 1 gotcha — not yet fixed)
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — Gate updated both to ReadonlySet<BuiltInModelId>
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- Single-PR rule on types/index.ts — no concurrent Arch PRs

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | roster-driven | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | roster-driven | accent-gpt | gpt-5.5 |
| Gemini | roster-driven | accent-gemini | gemini-2.5-flash |
| Grok | roster-driven | accent-grok | grok-3 |
| DeepSeek | roster-driven | accent-deepseek | deepseek-chat |
| Mistral | roster-driven | accent-mistral | mistral-large-latest |
