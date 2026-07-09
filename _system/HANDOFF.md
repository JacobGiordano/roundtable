Last updated: 2026-07-09 (evening)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Gemini guard fix shipped. Two new tickets opened.

**Shipped this session:**
- `#358` — Atlas: guard `candidate.content?.parts ?? []` in Gemini stream parser (safety-filtered/empty candidates no longer crash)

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
- `#359` — Aria: syntax highlighting for code blocks (`rehype-highlight`) *(batch with #357)*

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
