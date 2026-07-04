Last updated: 2026-07-04

## Current phase

Phase 5 — Full gate process active.

## Session summary

**GitHub Pages + Cloudflare Workers deployment (6 issues, 3 waves)** — Closed.

Wave 1 — Arch #329: `ProxyConfig` type + function types in `/src/types/index.ts`.
Wave 2 — Gate #330: `getProxyConfig` / `saveProxyConfig` / `clearProxyConfig` in `/src/auth/`, key `roundtable:proxy-config`.
Wave 2 — Atlas #331: All 6 built-in providers read proxy URL at call time from Gate; `/workers/index.js` Cloudflare Workers proxy script + `wrangler.toml`.
Wave 3 — Aria #332: Settings → Connection Proxy panel + first-run onboarding modal ("Connect your proxy") with Deploy to Cloudflare button. Ada passed.
Wave 3 — Forge #333: `.github/workflows/deploy-pages.yml` (triggers on `v*.*.*` tags); `vite.config.ts` base via `VITE_BASE` env var.
Wave 3 — Quill #334: `/docs/deployment.md` end-user guide + README "Hosted version" section + `.env.example` rewrite.

## Key decisions

- User-deployed proxy only — no central/shared proxy. Privacy model preserved.
- Single global proxy URL (not per-provider) — one `*.workers.dev` URL routes all providers via path prefix.
- Runtime setting (localStorage) not build-time env var — one static build serves all users.
- Modal gated on `import.meta.env.PROD` — Vite dev proxy handles dev mode, no modal needed.
- `wrangler.toml` lives in `/workers/` — Cloudflare deploy button uses `?dir=workers`.

## Open bugs / known issues

- `playwright.a11y.config.ts` `testDir` points at `src/tests/a11y/keyboard/` which now has no `.spec.ts` files — idle but harmless.
- Chunk size warning on build (560 kB) — pre-existing, not introduced this wave.

## What's next

- One-time manual step before first tagged release: Repo → Settings → Pages → Source → **"GitHub Actions"**
- Version tag `v0.1.0` — push tag to trigger release.yml + deploy-pages.yml simultaneously
- User to identify next priority after tagging

## Gotchas

- All prior gotchas from previous session still apply (see git log for details)
- `VITE_BASE=/roundtable/` must be set in CI when building for GitHub Pages — handled automatically by `deploy-pages.yml`
- Cloudflare deploy button URL requires `?dir=workers` — `wrangler.toml` is in `/workers/`, not repo root
- Onboarding modal only fires in `import.meta.env.PROD` — invisible in local dev by design
- `getProxyConfig()` imported from `@/auth` in Atlas model files — documented cross-agent exception in `ProxyConfig` JSDoc
