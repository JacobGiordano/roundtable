Last updated: 2026-07-23 (ship: wave 22 — #456 + #548)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 22 shipped. Issues closed: #456 #548

- **Aria**: logoutOnClose toggle in `BackendServerPanel` — connected state only; `role="switch"` pill, WCAG 2.5.8 compliant (`h-6 w-11`)
- **Ada**: PASS
- **Scout**: 15 targeted tests for logoutOnClose toggle — presence, aria-checked state, Space/Enter/click activation, save contract, disconnected-state absence. 2361 passing, 1 pre-existing failure (#425)

## Key decisions

- Toggle renders only in connected state — meaningless without a backend session
- `h-6 w-11` (24px) required by WCAG 2.5.8 minimum target size
- Mock pattern for `getLogoutOnClose`/`saveLogoutOnClose` established in `logout-on-close-toggle.test.tsx`

## Open issues (priority order)

- **#425** — Atlas: gpt-image-gen.test.ts pre-existing failure

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
