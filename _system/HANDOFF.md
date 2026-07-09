Last updated: 2026-07-09

## Current phase

Phase 5 — Full gate process active.

## Session summary

Cost display wave complete. Both issues shipped plus several post-wave fixes.

**Shipped this session:**
- `#353` — Aria: cost column in SessionTokenSection (per-model + session total), staleness footer, pricing URL field in provider settings
- `#347` — Aria: empty-bubble polish — flushAbortedStreams for zombie placeholder cleanup, error/abort states verified
- Post-wave fixes (all on main): 69 test failures from mock gaps; pricing reactivity (custom event + useEffect); `_meta` key breaking isPricingTable validation; relative URL support for VITE_PRICING_URL; pricing prefetch on app mount so fast models get costs on first send

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- Pricing URL resolution: localStorage override → VITE_PRICING_URL → canonical default
- generic.ts uses DI for getPricingTableFn (avoids @/auth import side-effects in tests)
- AbortError early-termination paths do NOT get estimatedCost — partial streams report no cost
- Cost display: session-scoped only (Phase 1), no retroactive recalculation
- SOP detail lives in `_system/SOP.md` — CLAUDE.md has summary + pointer only
- Dev container rules placed in `_system/SOP.md` (not a separate file)
- Coda uses fork-first for all recon tasks; fresh spawns reserved for implementation waves
- pricing.json `_meta` key is filtered by isPricingTable (keys starting with `_` are skipped)
- `public/pricing.json` is a copy of root `pricing.json` — keep in sync when pricing.json updates
- VITE_PRICING_URL in .env.local points to /pricing.json for dev; production uses canonical GitHub raw URL

## Open issues

- `#356` — Luma: Linen theme `semantic.warning` fails WCAG AA (4.03:1); `it.fails()` tests ready to auto-promote when fixed
- `#357` — Aria: per-message cost in bubble footer + session total cost in header chip *(next Aria wave)*

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (586 kB) — pre-existing
- pricing.json: o1-mini and open-mistral-nemo output rate are unverified estimates (flagged in _meta)
- Grok entries are deprecated aliases that silently redirect to grok-4.3 billing
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Cost column only appears after pricing fetch completes — app now prefetches on mount
- Duplicate Ada run cost this wave (~87k tokens): Aria's internal Ada completed async; Coda spawned a second Ada before it landed. Fix in memory: wait for second notification on Aria's task before spawning Ada independently
