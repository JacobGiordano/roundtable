Last updated: 2026-07-09 (evening)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #356 (Linen semantic.warning WCAG AA fix) and #360 (sr-only interpunct fix in MessageBubble). Opened #361 for attachment rendering gap in user bubbles.

**Shipped this session:**
- `#356` — Luma: darken Linen `semantic.warning` `#A16207` → `#8A4E00`; Ada promoted both `it.fails()` contrast tests to passing
- `#360` — Aria: replace `aria-label` on generic divs in MessageBubble bubble footers with `sr-only` span pattern (ARIA 1.2 §6.2.6)

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
- `isBlock` in code renderer uses `node.position` (start.line !== end.line), not `!!className` — unlabeled fenced blocks have no className

## Open issues

- `#361` — Aria: render attachment images in user message bubbles (full pipeline exists; only MessageBubble display missing)

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
- Worktree npm installs don't carry over to workspace — always run `npm install` in /workspace after waves that add deps
- atom-one-dark highlight theme: light themes (Linen/Chalk) get readable-but-not-ideal colors; theme-aware palette deferred
- Unlabeled fenced blocks render as correct block but with no syntax coloring (expected — no language tag = no highlight.js detection)
- Attachments: only user messages carry them; assistant bubbles are unaffected by #361
