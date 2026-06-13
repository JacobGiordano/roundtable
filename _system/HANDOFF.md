Last updated: 2026-06-13 (Wave 1 ship — #93, #94, #96)

## Current phase

Phase 4+ — Custom provider infrastructure in progress.

## Session summary

- Gate: closed #93 — ProviderRoster CRUD (`getProviderRoster`, `saveProviderRoster`, `addBuiltInProvider`, `addCustomProvider`, `removeProvider`, `getProviderById`). MODEL_CREDENTIAL_MAP typed to `Record<BuiltInModelId, BuiltInCredentialKey>`. 401/401 tests pass.
- Atlas: closed #94 — `GenericOpenAIProvider` in `src/models/generic.ts`. Full `ModelProvider` impl with SSE streaming, all `ModelErrorCode` variants, keyless-endpoint support (Ollama/LM Studio), `createCustomProvider()` factory ready for #95.
- Luma: closed #96 — Outrun theme final palette: dark purple-near-black surfaces (sidebar/card shifted to dark blue), hot pink `#FF2070` dominant chrome, electric blue `#3DC8FF` secondary text/shadows, teal `#2EE4B9` focus/strong borders/active states/shadow layers. Inspired by Night Drive VS Code theme. Full WCAG AA.

## Open issues

- #95 [Atlas] Wire custom provider dispatch into sendMessage.ts
- #97 [Luma] Settings panel + onboarding spec
- #98 [Aria] Update model selector to load from ProviderRoster
- #99 [Aria] Provider settings panel UI
- #100 [Aria] Onboarding empty state — first-run experience

## Parallelization waves

Wave 2 (now unblocked): #95 Atlas, #97 Luma, #98 Aria — all can run in parallel
Wave 3 (after Luma spec + Gate): #99 Aria settings panel, #100 Aria onboarding

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — Gate updated both to ReadonlySet<BuiltInModelId>
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- ModelRegistryEntry fields are top-level (modelId, name, color) — NOT nested under .config
- MODEL_REGISTRY is an array — use .length, not Object.keys().length
- Gate: getRequiredCredentialKeys iterates ModelConfig[] and calls MODEL_CREDENTIAL_MAP[model.modelId] — needs a guard for custom model IDs not in the map
- Custom provider credential keys follow pattern "custom:<providerId>" — Gate generates them
- addCustomProvider generates credentialKey = "custom:<id>" where id is already "custom:<slug>", yielding "custom:custom:<slug>" — this is per-spec

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
