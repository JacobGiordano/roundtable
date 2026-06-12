Last updated: 2026-06-12 (Forge CI + Bastion backend tests + Scout #85)

## Current phase

Phase 4 — Feature-complete. CI live. Backend test infrastructure live. 4 Scout test gap tickets remain.

## Session summary

- Forge: `.github/workflows/ci.yml` — 4-job pipeline (lint → build + test + backend-lint-build in parallel). Uses `npm run test:run` not `npm test` (watch mode would hang CI).
- Bastion: bootstrapped `/backend/tests/` — 63 tests across health, auth, conversations, export routes.
- Scout: closed #85 — `getSessionTokenUsage` edge case tests (5 tests, zero regressions).
- Opened #88 for Atlas: `db.ts path.resolve()` prevents true `:memory:` test isolation (not a blocker — Bastion worked around it with unique tmp paths).

## Open issues — priority order

- Scout #84: ghost mode storage isolation (extend existing integration test)
- Scout #83: accentColors VALID_MODEL_IDS sync guard ⚠️ test file lives in `/src/auth/` — Scout boundary issue, needs resolution
- Scout #86: AccentColorPicker hex field validation (requires `vi.useFakeTimers()`)
- Scout #87: MODEL_REGISTRY completeness guard
- Atlas #88: `db.ts path.resolve()` mangles `:memory:` — quality-of-life, not a blocker

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- New agent SOP: fetch base from agency-agents repo first, then expand with Roundtable layers
- VALID_MODEL_IDS in BOTH accentColors.ts AND modelVersion.ts — update both when adding models
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and in handleThemeChange
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry (documented, tested)
- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Scout #83 boundary issue: proposed test file is in `/src/auth/accentColors.test.ts` — Scout can't write there (Gate territory). Resolve before activating Scout on this ticket.

## Model providers (all on main)

| Model | Default active | Accent token | Default version |
|-------|---------------|--------------|-----------------|
| Claude | yes | accent-claude | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | gpt-5.5 |
| Gemini | no | accent-gemini | gemini-2.5-flash |
| Grok | no | accent-grok | grok-3 |
| DeepSeek | no | accent-deepseek | deepseek-chat |
| Mistral | no | accent-mistral | mistral-large-latest |
