Last updated: 2026-07-22 (ship: wave 17)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 17 shipped. Issue closed: #530

- **Scout**: added `src/tests/e2e/scenarios.spec.ts` — 7 tests across 5 describe blocks covering all 5 acceptance-criteria scenarios (copy dropdown overflow, markdown table shading, model selector first-load, error bubbles via route interception, empty state recovery)
- **Flint**: CONDITIONAL — ships as-is; Caveat 1 (no webServer auto-start) is pre-existing design; Caveats 2–3 are watch-at-CI items

## Key decisions

- `playwright.config.ts` intentionally omits `webServer` — dev must run `npm run dev` first; CI starts the server explicitly
- `[role="alert"]` selector in Scenario 4 is broad but `ContainText('Error:')` guard is sufficient in practice
- Scenario 5a assumes `isVisible: false` roster entries count as "not empty" for `isRosterEmpty` — verify at first CI run

## Open issues (priority order)

- **#463** — Aria: error state tone — auth vs rate-limit vs network
- **#495** — Vault/Aria: storage usage reporting UI (`getStorageUsage()` ready in `@/storage`)
- **#496/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#527** — Luma → Aria: empty state visual polish

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
