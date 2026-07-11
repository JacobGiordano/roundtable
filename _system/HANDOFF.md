Last updated: 2026-07-11 (post-#379 ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #379 (Arch+Atlas+Aria+Gate: image generation opt-in toggle per model).
Four-agent wave: Arch added `imageGenerationEnabled?: boolean` to `ModelConfig`; Atlas
threaded it through all three sendMessage dispatch modes to `generic.ts` and `gemini.ts`
(two-condition gate: capability flag AND per-model toggle); Aria added "Image generation"
section in `ModelSelectorPanel` with per-model `ImageGenerationRow` toggle, wired through
`RoundtableContext` → `App.tsx`; Gate fixed `BUILTIN_CAPABILITIES_MAP['gemini']` (Flint
caught missing `imageGeneration: true` — toggle never rendered without it). Ada PASS,
Flint PASS (after one-line Gate fix).

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
- Live model discovery: registry uses `liveApiProvider: 'anthropic'|'gemini'` discriminator
- `ModelCatalogEntry.capabilities?: ProviderCapabilities` — only set on `source: 'live-api'` entries
- Gemini live fetch: CORS-blocked in browser without proxy; degrades to bundled fallback silently
- OpenAI /v1/models returns no capability data — static registry only
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` (per-model, persists in localStorage)
- Image gen two-condition gate: `capabilities.imageGeneration === true && requestImageGeneration === true`
- Gemini image gen: model-string check (IMAGE_GEN_MODEL_STRINGS) AND toggle both required
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- `BUILTIN_CAPABILITIES_MAP['gemini']` must include all capabilities incl. imageGeneration

## Open issues

- `#381` — Atlas: programmatic capability discovery for OpenAI, Mistral, DeepSeek (research-first)
- `#377` — Atlas: OpenAI image generation via gpt-image-2 [deferred]

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- Chunk size warning on build (776 kB) — pre-existing, grew with Lightbox (#369/#380)
- Container DNS: OpenAI CDN IPs baked into ipset at container start — ENOTFOUND on api.openai.com
  means restart the CONTAINER (not just dev server) to re-resolve; SOP §"Dev container" has details
- pricing.json: o1-mini and open-mistral-nemo output rates are unverified estimates
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs; push main directly
