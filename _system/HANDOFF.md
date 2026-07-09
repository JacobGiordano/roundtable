Last updated: 2026-07-09 (evening)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Aria wave: cost display + syntax highlighting shipped. Post-ship bug fixes applied inline.

**Shipped this session:**
- `#357` — Aria: per-message cost in bubble footer + session total cost in header chip
- `#359` — Aria: syntax highlighting for code blocks (`rehype-highlight` + `atom-one-dark`)
- Post-ship fix: `rehype-highlight`/`highlight.js` packages missing from workspace (worktree npm install doesn't carry over — see memory)
- Post-ship fix: fenced code blocks with no language tag rendered as inline code; fixed via `node.position` block detection in `code` renderer

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

- `#356` — Luma: Linen theme `semantic.warning` fails WCAG AA (4.03:1); `it.fails()` tests ready to auto-promote when fixed
- `#360` — Aria: advisory — `aria-label` on generic div unreliable for suppressing child text in screen reader browse mode (non-blocking)

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
