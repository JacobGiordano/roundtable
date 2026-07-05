Last updated: 2026-07-05

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#336–#339 — ProxyNudge a11y advisory batch** — Shipped in c146229.

All four Ada advisories on ProxyNudge resolved in a single Aria session:
- #336: Dismiss now returns focus to "Edit API key" button, not trash button
- #337: All interactive elements include provider name in aria-label
- #338: Focus rings normalized to `focus-visible:ring-2 focus-visible:ring-offset-2`
- #339: CTA uses double RAF to survive panel CSS transitions

**#340 — Auto-chain mode ignored before first message** — Shipped in 054888a.

**#335 — Proxy setup nudge in ProviderSettingsPanel** — Shipped in 5e4b08e.

## Key decisions

- Interaction mode default stays 'parallel' — tooltips make auto-chain discoverable
- ProxyNudge fires during provider setup (not on send) — preserves send excitement
- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS (better-sqlite3 prebuilt availability)

## Open bugs / known issues

- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- User to identify next priority
- Consider upgrading better-sqlite3 to ≥11.x to unblock backend CI Node 24

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
