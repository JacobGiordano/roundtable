Last updated: 2026-06-13 (Arch #92)

## Current phase

Phase 4+ — Custom provider infrastructure in progress.

## Session summary

- Aria: closed #91 — AddModelButton dropdown portal-rendered to escape overflow-y:auto clipping. Lint/build clean.
- Arch: closed #92 — open-union ModelId/CredentialKey, BuiltInModelId/BuiltInCredentialKey extracted, ProviderConfig discriminated union, ProviderRoster, ModelCatalogEntry added to /src/types/index.ts. Zero breaking changes to existing consumers.

## Open issues

- #93 [Gate] ProviderRoster storage + BuiltInModelId type alignment
- #94 [Atlas] GenericOpenAIProvider for custom endpoints
- #95 [Atlas] Wire custom provider dispatch into sendMessage.ts
- #96 [Luma] Outrun theme revision — neon blues, cyans, teals
- #97 [Luma] Settings panel + onboarding spec
- #98 [Aria] Update model selector to load from ProviderRoster
- #99 [Aria] Provider settings panel UI
- #100 [Aria] Onboarding empty state — first-run experience

## Parallelization waves

Wave 1 (all independent, can run in parallel): #93 Gate, #94 Atlas, #96 Luma
Wave 2 (after Gate ships): #95 Atlas wiring, #97 Luma spec, #98 Aria model selector
Wave 3 (after Luma spec + Gate): #99 Aria settings panel, #100 Aria onboarding

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — Gate must update both to ReadonlySet<BuiltInModelId>
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- ModelRegistryEntry fields are top-level (modelId, name, color) — NOT nested under .config
- MODEL_REGISTRY is an array — use .length, not Object.keys().length
- Gate: getRequiredCredentialKeys iterates ModelConfig[] and calls MODEL_CREDENTIAL_MAP[model.modelId] — needs a guard for custom model IDs not in the map
- Custom provider credential keys follow pattern "custom:<providerId>" — Gate generates them

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
