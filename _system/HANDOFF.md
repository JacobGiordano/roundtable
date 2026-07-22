Last updated: 2026-07-22 (ship: wave 18)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 18 shipped. Issues closed: #463 #462 #465 #467 #468 #469 #470 #527 #457 #458 #459 #460 #461

- **Aria**: error tone differentiation (#463), sticky export button (#468), click-to-rename (#469), ghost mode InputBar toggle (#470), plus 6 issues already implemented in prior waves
- **Scout**: 21 error-tone unit tests (#463), stale `aria-a11y-fixes.test.tsx` queries fixed after wave 18 title→sr-only migration (#458)
- **Ada**: PASS — updated 3 pre-existing a11y test assertions for new error rendering
- **Flint**: PASS — 17/17 checks; one behavioral finding → ticket #545

## Key decisions

- `auth_failure` "Go to Settings" CTA currently calls `onRetry` — label/action mismatch; deferred to #545
- Worktrees created during this wave pulled from remote main, not local — agents must check base commit if counting tests

## Open issues (priority order)

- **#545** — Aria: wire "Go to Settings" CTA to open settings panel on auth_failure (#463 follow-up)
- **#495** — Vault/Aria: storage usage reporting UI (`getStorageUsage()` ready in `@/storage`)
- **#496/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#544** — Atlas: classify provider HTTP 400/401/429 into ModelErrorCode (Grok 400 confirmed gap)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
- Worktrees may pull from remote main (not local) — verify base commit when test counts matter
