Last updated: 2026-06-12 (Gate: TokenCountControl role fix #78)

## Current phase

Phase 4 — Feature-complete. 1 a11y bug open; 5 test gap tickets open.

## Session summary

- Gate: #78 — changed `role="group"` → `role="radiogroup"` on TokenCountControl container
- One-line fix; lint/build clean; Ada-filed issue resolved

## Open issues — priority order

- #80 [Aria] Minor — AppLayout mobile gear missing `aria-controls`
- Forge: CI workflow `.github/workflows/ci.yml` (first Forge session)
- Bastion: bootstrap `/backend/tests/` infrastructure (first Bastion session)
- Scout #83–#87: 5 test gap tickets (accentColors sync, ghost mode, getSessionTokenUsage, hex field, MODEL_REGISTRY)

## Gotchas

- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — update both when adding models
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
