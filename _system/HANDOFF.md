Last updated: 2026-06-13 (Atlas #90)

## Current phase

Phase 4 — Feature-complete. CI live. No open issues.

## Session summary

- Atlas: closed #90 — default DATABASE_PATH changed to `./data/roundtable.db`; `data/` dir created at runtime via mkdirSync; `data/` added to .gitignore; `:memory:` sentinel in tests unaffected. 63/63 backend tests passing.

## Open issues

None.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — update both when adding models
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- ModelRegistryEntry fields are top-level (modelId, name, color) — NOT nested under .config
- MODEL_REGISTRY is an array — use .length, not Object.keys().length

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
