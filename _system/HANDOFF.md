Last updated: 2026-06-12 (Aria: AppLayout mobile gear aria-controls #80)

## Current phase

Phase 4 — Feature-complete. All Ada-filed a11y bugs closed. 5 test gap tickets open.

## Session summary

- All 4 Ada a11y bugs resolved this session: #82, #79, #78, #80
- Aria: #82 (nested-interactive) + #79 (focus trap) — batched, AccentColorPicker
- Gate: #78 (role="group" → role="radiogroup") — TokenCountControl
- Aria: #80 (aria-controls on mobile gear) — AppLayout

## Open issues — priority order

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
