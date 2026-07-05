Last updated: 2026-07-05

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#340 — Auto-chain mode ignored before first message** — Shipped in 054888a.

Added `pendingMode` state to `App.tsx`. Mode selections before the first message
are now captured and applied when the first conversation is created. New Chat
inherits the last selected mode instead of hardcoding 'parallel'.

**#335 — Proxy setup nudge in ProviderSettingsPanel** — Shipped in 5e4b08e.
`ProxyNudge` inline callout after API key save in prod when no proxy configured.

**CI + Pages fixes** — Shipped earlier this session (coverage scope, backend
Node 22, eslint coverage/ ignore, blank page → gh-pages branch source).

## Key decisions

- Interaction mode default stays 'parallel' — tooltips already make auto-chain
  discoverable; parallel is self-evident on first use, auto-chain requires context
- ProxyNudge fires during provider setup (not on send) — preserves send excitement
- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS (better-sqlite3 prebuilt availability)

## Open bugs / known issues

- #336 — ProxyNudge dismiss focuses trash button; should target key-management control
- #337 — ProxyNudge aria-labels lack provider name; ambiguous with multiple nudges
- #338 — ProxyNudge focus ring weight inconsistent (ring-1 vs ring-2)
- #339 — ProxyNudge CTA RAF timing may silently fail on CSS transition
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- User to identify next priority
- Ada advisories #336–339 are deferred (non-blocking)
- Consider upgrading better-sqlite3 to ≥11.x to unblock backend CI Node 24

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
