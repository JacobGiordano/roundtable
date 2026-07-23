Last updated: 2026-07-22 (ship: wave 20)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 20 shipped. Issues closed: #546 #456 #490 #491 #447

- **Scout**: Grok 400 auth regression test — 2 new cases covering `classifyHttpError()` body-inspection (#546)
- **Gate**: `logoutOnClose` preference + sessionStorage token path; 20 new tests; UI toggle deferred to Aria (#456)
- **Marque**: 192×192 + 512×512 PWA PNGs generated; manifest.json updated; 1200×630 OG image + spec (#490 #491)
- **Forge**: OG/Twitter meta tags wired in index.html (#491); #447 bundle split already existed — verified 3 chunks, no chunk over 500 kB

## Key decisions

- `logoutOnClose` stored in localStorage; only the auth *token* moves to sessionStorage when pref is true
- Gate exports `getLogoutOnClose/saveLogoutOnClose/clearLogoutOnClose` — Aria wires the settings toggle in a future wave
- Forge's #447 `manualChunks` was already implemented in a prior CI commit — no code change needed

## Open issues (priority order)

- **#455/#454** — Aria: image export disclosure + provider data processing disclosure (Wave 21 batch)
- **#452–#448** — Aria: perf — React.memo MessageBubble, useMemo sanitize, auto-scroll, shimmer animation, stableContent O(n²)
- **#446** — Aria: restrict highlight.js language set
- **#456 (UI)** — Aria: settings toggle for logoutOnClose (deferred from Gate wave)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
- OG square variant (`og-image-square.png`) not wired — Forge used `summary_large_image` with 1200×630 per spec
