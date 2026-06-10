Last updated: 2026-06-09

## Current phase

Phase 4 — in progress.

## Active agents for next session

- Gate: add 'google'/'xai' entries to MODEL_CREDENTIAL_MAP and CREDENTIAL_LABELS
  in src/auth/credentials.ts — required to clear the two tsc errors and unblock build

## Last closed

- Aria (phase4-aria-registry-wiring): MOCK_MODELS removed from App.tsx; replaced
  with buildDefaultModelConfigs() (lazy useState initializer) from @/models.
  The model selector now reflects the live MODEL_REGISTRY maintained by Atlas.

## Decisions made this session

- buildDefaultModelConfigs passed as a lazy initializer (no `()`) to useState to
  avoid calling on every render — idiomatic React pattern.
- MOCK_MODELS block and its comment header removed entirely; no dead code remains.
- Cross-agent import comment updated to include buildDefaultModelConfigs.

## Build status

Two pre-existing tsc errors in src/auth/credentials.ts (missing 'gemini'/'grok'
and 'google'/'xai' entries introduced by Arch's types PR). Gate must fix before
build is fully green. Aria's changes are lint-clean and do not contribute to
these errors.

## Next issues in priority order (Phase 4 — Expansion)

1. [Gate] Add MODEL_CREDENTIAL_MAP entries and CREDENTIAL_LABELS for google + xai
2. [Atlas] Remove casts and activate Gemini/Grok in registry.ts + index.ts
3. [Vault] ServerStorageProvider (REST client for self-hosted backend)
4. [Gate] Backend auth support (session tokens, login/logout)
5. Self-hosted backend service (Node/Express, Docker Compose)
6. Open source launch prep

## Gotchas

- firewall allowlist does NOT include generativelanguage.googleapis.com or api.x.ai —
  must be added before Gemini/Grok can be tested in dev container (user auth required)
- Single-PR rule on types/index.ts — no new types PRs until current Arch PR is closed
- getSessionTokenUsage(), buildDefaultModelConfigs() exported from @/models —
  documented cross-agent exception for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
