Last updated: 2026-07-05

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#335 — Proxy setup nudge in ProviderSettingsPanel** — Shipped in 5e4b08e.

`ProxyNudge` component renders inline inside `ProviderSettingsPanel` after a
built-in provider API key is saved in production when no proxy is configured.
"Almost there!" tone, provider-name-aware copy, CTA navigates to Connection
Proxy section and focuses URL input, dismissible (focus returns to trash button).
PROD-gated — invisible in dev. Ada PASS.

Also shipped this session (earlier): CI fixes (coverage scope, backend Node 22,
eslint coverage/ ignore), blank page fix (Pages source → gh-pages branch),
Aria #332 recovery (proxy settings panel + onboarding modal on main).

## Key decisions

- Proxy nudge fires *during provider setup* (after key save), not on send — preserves send excitement
- Nudge is PROD-gated (`import.meta.env.PROD`) — same pattern as onboarding modal
- Send-intercept modal (ProxyOnboardingModal) kept as fallback
- GitHub Pages source: "Deploy from a branch" → gh-pages → / (root) — must not change
- Backend CI pinned to Node 22 LTS (better-sqlite3 prebuilt availability)
- Coverage scoped to src/**/*.{ts,tsx} only; function threshold 70%

## Open bugs / known issues

- #336 — Nudge dismiss focuses trash button; should target a key-management control
- #337 — Aria-labels lack provider name; ambiguous when multiple nudges visible
- #338 — Focus ring weight inconsistent (ring-1 vs ring-2) in nudge
- #339 — CTA RAF timing may silently fail if settings panel has CSS transition
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts files — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- User to identify next priority
- Ada advisories #336–339 are deferred follow-ups (non-blocking)
- Consider upgrading better-sqlite3 to ≥11.x to unblock backend CI Node 24

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
