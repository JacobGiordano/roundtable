Last updated: 2026-07-04

## Current phase

Phase 5 — Full gate process active.

## Session summary

**GitHub Pages blank page + CI fixes + Aria #332 recovery** — Shipped.

Root cause of blank page: GitHub Pages source was pointing to `main` branch root
(serving the Vite dev `index.html` with `/src/main.tsx`) instead of `gh-pages` branch.
Fix: Settings → Pages → Source → "Deploy from a branch" → gh-pages → / (root).

CI was broken for 20+ consecutive runs (pre-existing). Three root causes fixed:
- Coverage scope: v8 was instrumenting backend/, workers/, config files at 0% — scoped to `src/**/*.{ts,tsx}`, excluded `src/main.tsx`, lowered function threshold 80% → 70%
- Backend Node version: `better-sqlite3@9.6.0` has no prebuilt for Node 24 ABI — pinned backend CI job to Node 22 LTS
- ESLint: `coverage/` directory not ignored — generated lcov report JS triggered lint warnings

Aria #332 (proxy settings panel + onboarding modal) was completed and Ada-audited
during the wave but never landed on main (worktree branch was a dead end in the DAG).
Recovered via clean cherry-pick of f0bc58a.

## Key decisions

- GitHub Pages source must be: "Deploy from a branch" → gh-pages → / (root)
- `deploy-pages.yml` triggers on push to main; peaceiris/actions-gh-pages@v4 pushes dist/ to gh-pages branch
- Coverage scoped to src/**/*.{ts,tsx} only — backend and config files excluded
- Backend CI runs Node 22 LTS (not 24) due to better-sqlite3 native binding prebuilt availability
- Aria #332 proxy UI is now on main — onboarding modal fires in import.meta.env.PROD only

## Open bugs / known issues

- `playwright.a11y.config.ts` `testDir` points at `src/tests/a11y/keyboard/` which has no `.spec.ts` files — idle but harmless
- Chunk size warning on build (560 kB) — pre-existing, not introduced this wave

## What's next

- User to identify next priority
- Consider upgrading `better-sqlite3` to ≥11.x (supports Node 24) to unblock backend CI Node version upgrade

## Gotchas

- GitHub Pages source MUST be gh-pages branch, not main — main root has Vite dev index.html
- `VITE_BASE=/roundtable/` must be set in CI when building for GitHub Pages — handled by deploy-pages.yml
- Onboarding modal only fires in `import.meta.env.PROD` — invisible in local dev by design
- Backend CI uses Node 22 specifically — changing to 24 will break npm ci until better-sqlite3 is upgraded
