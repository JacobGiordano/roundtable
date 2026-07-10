Last updated: 2026-07-10 (evening — post-#366–#369, #373 ship; image-gen spec pending)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #366 (Aria: render generatedImages in assistant bubbles), #367 (Scout: 34 regression tests
for image pipeline), #368 (Aria: DnD ARIA live region — DnD+paste already existed; added sr-only
announcer), #369 (Aria: lightbox for attachment thumbnails — portal, focus trap, Gauge-reviewed,
Ada PASS 14/14), #373 (Atlas: fix directed reply swallowed by auto-chain — targetModelId now
checked before chainConfig; priority: directed reply > auto-chain > parallel).

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- Pricing URL resolution: localStorage override → VITE_PRICING_URL → canonical default
- generic.ts uses DI for getPricingTableFn (avoids @/auth import side-effects in tests)
- AbortError early-termination paths do NOT get estimatedCost — partial streams report no cost
- Cost display: session-scoped only (Phase 1), no retroactive recalculation
- Coda uses fork-first for all recon tasks; fresh spawns reserved for implementation waves
- `public/pricing.json` is a copy of root `pricing.json` — keep in sync when pricing.json updates
- VITE_PRICING_URL in .env.local points to /pricing.json for dev; production uses canonical GitHub raw URL
- Attachment strip renders above message text (mb-2) — UX convention; do not revert
- generatedImages in exports: unconditional inline base64 (only copy of model-produced image)
- User message tokenUsage backfill: mutate before onChunk fires; first provider wins in parallel mode
- Lightbox focus trap: filters disabled + tabindex="-1" + zero-dimension elements (Gauge fix, #369)
- sr-only aria-live announcer for attachments is pre-mounted (not conditional) so first-drop fires
- sendMessage mode priority: directed reply > auto-chain > parallel broadcast (fixed #373)

## Image generation — research findings (tickets not yet filed)

Gemini 2.0 Flash can generate images natively — add `responseModalities: ["TEXT", "IMAGE"]` to
`generationConfig` in the Gemini provider. The #364/#366 inlineData pipeline already handles the
response format. Delta: Atlas adds the config param + a registry flag (`supportsImageGeneration`)
on capable versions; image output should be opt-in (not sent on every request). gemini-2.5-pro/flash
may not yet support this — verify before adding to registry.

OpenAI image generation requires DALL-E 3 via a separate `/v1/images/generations` endpoint — not
wired to the current chat completions path. Significantly more work; park for later.

Claude has no image generation API. Not possible.

## Open issues

- `#372` — Aria: move `→ Model` directed-reply label above user message text (batch with next Aria issue)
- `#374` — Atlas/Vault: assistant bubble shows empty content until page reload in auto-chain mode
  (suspected: void store.updateConversation between sequential chain steps races with replaceInState;
  now reduced for directed-reply flows post-#373 since only one model responds)
- Image generation tickets: to be filed next session (Gemini first; OpenAI deferred)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- Chunk size warning on build (772 kB) — pre-existing, grew with Lightbox (#369)
- Container DNS: OpenAI CDN IPs baked into ipset at container start — ENOTFOUND on api.openai.com
  means restart the CONTAINER (not just dev server) to re-resolve; SOP §"Dev container" has details
- pricing.json: o1-mini and open-mistral-nemo output rates are unverified estimates
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Worktree npm installs don't carry over to workspace — run `npm install` in /workspace after dep-adding waves
- Lightbox for generatedImages on assistant bubbles not yet implemented (out of scope for #369)
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
