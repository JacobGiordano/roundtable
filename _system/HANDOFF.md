Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

Cost display feature back-end complete. All four foundation tickets shipped.

**Shipped this session (cost display wave):**
- `#350` — Arch: PricingEntry, PricingTable, PricingMetadata, PricingConfig, fn type aliases
- `#351` — Gate: pricing cache (stale-while-revalidate, 24h TTL, runtime URL override, savePricingUrl)
- `#352` — Atlas: pricing.json (20 models), cost computation at stream completion, estimatedCost on TokenUsage

**Also shipped:**
- `#343` — Scout: aria-hidden test selectors fixed
- `#344` — Atlas: error-sentinel filter alignment
- `#345/#346` — Atlas: stream_options and gpt-5.5 spikes
- `#349` — Atlas: dispatch-time priming chunks

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- Pricing URL resolution: localStorage override → VITE_PRICING_URL → canonical default
- generic.ts uses DI for getPricingTableFn (avoids @/auth import side-effects in tests)
- AbortError early-termination paths do NOT get estimatedCost — partial streams report no cost
- Cost display: session-scoped only (Phase 1), no retroactive recalculation

## Open issues

**Ready to start (Aria #353 unblocked):**
- #353: [Aria] SessionTokenSection cost column + staleness footer + pricing URL settings field

**Also unblocked:**
- #347: [Aria] Empty-bubble polish for pre-first-chunk placeholder

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (560 kB) — pre-existing
- pricing.json: o1-mini and open-mistral-nemo output rate are unverified estimates (flagged in _meta)
- Grok entries are deprecated aliases that silently redirect to grok-4.3 billing
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
