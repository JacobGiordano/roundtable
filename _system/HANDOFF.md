Last updated: 2026-06-12 (phase review + test coverage + a11y audit + agent roster expansion)

## Current phase

Phase 4 — Feature-complete. 4 a11y bugs open; 5 test gap tickets open.

## Session summary

- Phase review: build/lint/test all clean, 0 open issues before this session
- Scout: 94 new tests (modelVersion sync guard, sendMessage error paths, AccentColorPicker, ExportButton)
- Ada: 59 new a11y tests; 4 bugs found — #78 #79 #80 #82
- Agent roster: Forge (CI/DevOps ⚙️) and Bastion (backend test 🛡️) added
- Methodology: all new agents must start from https://github.com/msitarzewski/agency-agents/ base

## Open issues — priority order

- #82 [Aria] Serious — AccentColorPicker: `<input>` nested inside `<button>` (axe: nested-interactive)
- #79 [Aria] Serious — AccentColorPicker: no focus trap in dialog (WCAG 2.1.2)
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
- AccentColorPicker #82/#79 open — axe tests for #82 are marked it.fails() until Aria fixes it

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
