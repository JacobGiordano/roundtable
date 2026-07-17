Last updated: 2026-07-17 (ship: wave 5)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 5 shipped. Six issues closed (#423 #424 #425 #441 #442 #444):
- **Atlas**: DeepSeek deprecation signals in registry (`deprecated: true`, `deprecationDate: '2026-07-24'`)
- **Aria**: Panel banner + persistent inline notice in ModelSelectorPanel; reads `entry.deprecated` from MODEL_REGISTRY
- **Ada**: Fixed stale copy-button a11y assertion (#425 test 2); found text-warning/80 contrast blocker in linen/chalk — fixed same wave
- **Scout**: #425 test 1 already done in wave 4 — no action needed
- **Quill**: Fixed README image gen claim (#424); added `docs/providers.md` (DeepSeek deprecation); updated `docs/deployment.md` (CORS_ORIGIN required)
- **Forge**: Login rate limit 5/15min (#444); CORS wildcard removed, startup warn added (#442); proxy route requireAuth + 60/60s limit (#441)

## Key decisions

- `text-warning/80` on `bg-warning/10` fails WCAG AA in linen (3.34:1) and chalk (3.59:1) — always use full-opacity `text-warning` for body text on tinted warning backgrounds
- Forge owns backend security middleware (this wave); CLAUDE.md shows `/backend/src/**` as off-limits for Forge — ambiguity to resolve
- Ada's `model-selector-deprecation-warning.test.tsx` was NOT committed — two `it.fails()` contrast tests must become `it()` after the fix (#517)
- `backend/README.md` has stale CORS_ORIGIN default docs — tracked in #518 (Atlas)

## Open issues (priority order)

- **#421** — imageGenerationEnabled toggle never wired (needs Arch types PR + Atlas + Aria — wave 6)
- **#517** — Ada's deprecation warning contrast tests: promote it.fails() → it() (Ada, quick)
- **#518** — backend/README.md stale CORS_ORIGIN docs (Atlas, quick)
- **#425 gpt-image-gen.test.ts** — pre-existing failure, not in any filed issue; Atlas scope

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Agents installing new npm deps in worktrees must commit package-lock.json + run `npm ci` (not `npm install`) in fresh worktrees
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags already in place; entries stay until date passes
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: between agent spawns, pwd can drift to last agent worktree — always `cd /workspace` before git operations
- Backend ownership gap: CLAUDE.md lists `/backend/src/**` as off-limits for Forge, but backend security fixes (#441 #442 #444) were assigned to Forge and landed cleanly; resolve in CLAUDE.md
