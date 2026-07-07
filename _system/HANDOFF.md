Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

Cost-reduction wave: CLAUDE.md trimmed 52%, SOP extracted, agent profiles tightened.

**Shipped this session:**
- `#354` — Arch: CLAUDE.md 292 → 141 lines; SOP + dev container extracted to `_system/SOP.md`; all 15 agent profile descriptions tightened; routing table merged into boundary table

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- Pricing URL resolution: localStorage override → VITE_PRICING_URL → canonical default
- generic.ts uses DI for getPricingTableFn (avoids @/auth import side-effects in tests)
- AbortError early-termination paths do NOT get estimatedCost — partial streams report no cost
- Cost display: session-scoped only (Phase 1), no retroactive recalculation
- SOP detail lives in `_system/SOP.md` — CLAUDE.md has summary + pointer only
- Dev container rules placed in `_system/SOP.md` (not a separate file)

## Open issues

**Ready to start (usage resets Wed 10am):**
- #353: [Aria] SessionTokenSection cost column + staleness footer + pricing URL settings field
- #347: [Aria] Empty-bubble polish for pre-first-chunk placeholder *(batch with #353)*

**Also open:**
- #355: [Arch] Update Coda agent profile — fork-first coordination pattern

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (560 kB) — pre-existing
- pricing.json: o1-mini and open-mistral-nemo output rate are unverified estimates (flagged in _meta)
- Grok entries are deprecated aliases that silently redirect to grok-4.3 billing
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
