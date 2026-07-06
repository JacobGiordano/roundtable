Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

**#341 — Enhanced in-conversation empty state** — Shipped in e1b9a7b.

New `ConversationEmptyState` component replaces the single "Start a conversation" placeholder:
- State A (0 active models): defensive fallback heading
- State B (1 model): identity beacon + model name + "Ask [Name] anything"
- State C (2+ models): staggered beacon row + heading + subtext + 3 suggestion chips
- Chips pre-fill and focus the InputBar textarea on click
- Entrance animation: content block 200ms fade+slide, beacons stagger at 150ms base + 50ms per beacon (offset to clear parent opacity ramp)
- `prefers-reduced-motion` compliant — no animation at all
- No new tokens; uses existing accent color system via `getModelDotStyle`

**#342 — Model/mode persistence across new conversations** — Filed, not started.

## Key decisions

- Product tour rejected in favor of enhanced empty state — agent consensus (Luma, Aria, Spark)
- Contextual first-use tooltips deferred until real user confusion is reported
- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS (better-sqlite3 prebuilt availability)

## Open bugs / known issues

- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- #342: Persist last-used model roster + interaction mode as new conversation defaults (Vault + Aria + Arch)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- `ConversationEmptyState` beacon stagger: 150ms base delay is intentional — clears parent opacity ramp before beacons animate
