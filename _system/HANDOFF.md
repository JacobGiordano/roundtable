Last updated: 2026-06-12 (Aria: AccentColorPicker a11y fixes #82 + #79)

## Current phase

Phase 4 — Feature-complete. 2 a11y bugs open; 5 test gap tickets open.

## Session summary

- Aria batched #82 + #79 (same component, both Serious) — authorized by user
- #82: moved `<input type="color">` outside `<button>` (nested-interactive fixed)
- #79: added focus trap (Tab/Shift+Tab wraps within dialog focusable elements)
- Ada audited both fixes — clean PASS, 1035 tests green
- 3 former `it.fails()` axe markers removed from accent-color-picker.test.tsx

## Open issues — priority order

- #78 [Gate] Moderate — TokenCountControl: `role="group"` → `role="radiogroup"`
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
