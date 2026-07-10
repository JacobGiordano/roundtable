Last updated: 2026-07-10 (afternoon — post-#373 ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #366 (Aria: render generatedImages in assistant bubbles, streaming via useStreamingMessages),
#367 (Scout: 34 regression tests for image pipeline — streaming, storage round-trip, regression guards),
#368 (Aria: drag-and-drop ARIA live region — DnD+paste were already implemented; added sr-only
announcer), #369 (Aria: lightbox for attachment thumbnails — portal, focus trap, Gauge-reviewed,
Ada PASS 14/14). #373 (Atlas: fix directed reply silently ignored in auto-chain mode — swap
targetModelId / chainConfig check order so directed reply always takes priority).

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
- `isBlock` in code renderer uses `node.position` (start.line !== end.line), not `!!className`
- Attachment strip renders above message text (mb-2) — UX convention; do not revert
- ThinkingIndicator: 1.2s pulse cycle, 200ms stagger, static dots at opacity 0.6 under reduced-motion
- generatedImages in exports: unconditional inline base64 (only copy of model-produced image)
- User message tokenUsage backfill: mutate before onChunk fires so save captures it; first provider wins in parallel mode
- Lightbox focus trap: filters disabled + tabindex="-1" + zero-dimension elements (Gauge fix, #369)
- sr-only aria-live announcer for attachments is pre-mounted (not conditional) so first-drop fires

## Open issues

- `#372` — Aria: move `→ Model` directed-reply label above user message text (batch with next Aria issue)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (772 kB) — pre-existing, grew slightly with Lightbox component
- pricing.json: o1-mini and open-mistral-nemo output rate are unverified estimates
- Grok entries are deprecated aliases that silently redirect to grok-4.3 billing
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Cost column only appears after pricing fetch completes — app prefetches on mount
- Worktree npm installs don't carry over to workspace — run `npm install` in /workspace after dep-adding waves
- atom-one-dark highlight theme: light themes get readable-but-not-ideal colors; deferred
- Unlabeled fenced blocks render as block with no syntax coloring (expected)
- Lightbox for generatedImages on assistant bubbles is not yet implemented (out of scope for #369)
- Agency-agents paths: always fetch directory listing first — forks hallucinate paths
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Vera: called when storage formats change, new data fields land, exports change, or analytics considered
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Tempo: called when bundle size grows, streaming perf changes, or explicitly requested
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
