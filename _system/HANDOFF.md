Last updated: 2026-07-10 (morning — post-#370 ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #370 (Atlas: backfill inputTokens + estimatedCost onto user message after stream via
wrappedOnChunk interceptor in sendMessage.ts). Added Gauge (code reviewer, he/him) and Tempo
(performance engineer, she/her) agent profiles.

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

## Open issues

- `#366` — Aria: render message.generatedImages in assistant bubbles with streaming placeholder (depends on #364 ✓)
- `#367` — Scout: regression tests for image content streaming pipeline (depends on #364 ✓)
- `#368` — Aria: wire dragover/drop onto chat input; reuse attachment ingestion path (batch with #369)
- `#369` — Aria: lightbox/expand for attachment thumbnails; a11y contract pre-specced (batch with #368)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (766 kB) — pre-existing
- pricing.json: o1-mini and open-mistral-nemo output rate are unverified estimates
- Grok entries are deprecated aliases that silently redirect to grok-4.3 billing
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Cost column only appears after pricing fetch completes — app prefetches on mount
- Worktree npm installs don't carry over to workspace — run `npm install` in /workspace after dep-adding waves
- atom-one-dark highlight theme: light themes get readable-but-not-ideal colors; deferred
- Unlabeled fenced blocks render as block with no syntax coloring (expected)
- Attachments: only user messages carry them; assistant bubbles unaffected until #366 ships
- Agency-agents paths: always fetch directory listing first — forks hallucinate paths
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Vera: called when storage formats change, new data fields land, exports change, or analytics considered
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Tempo: called when bundle size grows, streaming perf changes, or explicitly requested
- #366 Aria: streaming placeholder needed — ThinkingIndicator shows, then images appear
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
