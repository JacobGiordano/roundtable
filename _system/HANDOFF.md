Last updated: 2026-06-13 (Scout #84 #83 #86 #87)

## Current phase

Phase 4 — Feature-complete. CI live. All Scout test gap tickets closed.

## Session summary

- Scout: closed #84, #83, #86, #87 in parallel (4 isolated worktrees, octopus merge)
  - #84: +5 tests covering hook-layer ghost guards in useConversationStore (provider layer was already tested)
  - #83: +39 tests — VALID_MODEL_IDS sync guard + full accentColors coverage, placed in /src/tests/auth/ (not /src/auth/ — Gate territory)
  - #86: +20 tests — AccentColorPicker hex field blur/Enter edge cases; established fireEvent + vi.useFakeTimers() pattern (userEvent deadlocks with fake timers)
  - #87: +21 tests — MODEL_REGISTRY completeness + PROVIDERS sync guard; issue spec had wrong field path (top-level, not .config)

## Open issues

None. All Scout test gap tickets resolved.

## Potential next ticket

- Scout: `buildDefaultModelConfigs()` in `/src/models/registry.ts` has no test — maps MODEL_REGISTRY to ModelConfig[]. Low priority; flag to user before opening.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — update both when adding models
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- ModelRegistryEntry fields are top-level (modelId, name, color) — NOT nested under .config

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
