Last updated: 2026-07-23 (ship: wave 22 — #456)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 22 shipped. Issue closed: #456

- **Aria**: logoutOnClose toggle in `BackendServerPanel` — connected state only; `role="switch"` pill, label "Log out on close", hint "Clear your session when you close this tab"; toggle height corrected to `h-6 w-11` (WCAG 2.5.8)
- **Ada**: PASS — keyboard, ARIA, focus, screen reader, placement all clear
- **#548 opened**: Scout follow-on for targeted toggle test coverage (ON state, role="switch", Space/Enter activation)

## Key decisions

- Toggle renders only in connected state — meaningless without a backend session
- `h-6 w-11` (24px height) required by WCAG 2.5.8 minimum target size
- Test coverage deferred to #548 (not a ship blocker)

## Open issues (priority order)

- **#548 (tests)** — Scout: targeted logoutOnClose toggle test coverage
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
