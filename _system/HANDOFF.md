Last updated: 2026-07-11 (post-#381 + #382 ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #381 (Atlas: capability discovery) and #382 (Aria: @mention autocomplete) as a parallel wave.

**#381**: Mistral wired to live API (`fetchMistralCatalog` → `/v1/models`, maps vision/toolUse/contextWindow). OpenAI and DeepSeek get model-ID heuristics (`inferOpenAICapabilities`, `inferDeepSeekCapabilities`) in new `src/models/capabilities.ts`. No type changes — all in Atlas-owned files.

**#382**: `@` in InputBar opens a popover above the input listing active models (filter, keyboard nav, click-away). `@ModelName ` gets a model-accent highlight overlay. On send: token stripped, routes exclusively to the mentioned model. "→ ModelName" label in receiving bubble nameplate. Ada 43/43 pass.

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
- Live model discovery: registry uses `liveApiProvider: 'anthropic'|'gemini'|'mistral'` discriminator
- `ModelCatalogEntry.capabilities?: ProviderCapabilities` — only set on `source: 'live-api'` entries
- Gemini live fetch: CORS-blocked in browser without proxy; degrades to bundled fallback silently
- OpenAI /v1/models returns no capability data — static registry only (heuristics via `capabilityHeuristic`)
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` (per-model, persists in localStorage)
- Image gen two-condition gate: `capabilities.imageGeneration === true && requestImageGeneration === true`
- Gemini image gen: model-string check (IMAGE_GEN_MODEL_STRINGS) AND toggle both required
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- `BUILTIN_CAPABILITIES_MAP['gemini']` must include all capabilities incl. imageGeneration
- @mention token is routing metadata — stripped before send, never delivered to model
- @mention popover positions above input bar (viewport-bottom constraint)
- `capabilityHeuristic` field lives in `ModelRegistryEntry` (registry.ts) — not in types/index.ts

## Open issues

- `#383` — Atlas+Aria: abort/cancel button for in-flight model responses
- `#377` — Atlas: OpenAI image generation via gpt-image-2 [deferred]

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- Chunk size warning on build (780 kB) — pre-existing, grew with @mention overlay components
- Container DNS: OpenAI CDN IPs baked into ipset at container start — ENOTFOUND on api.openai.com
  means restart the CONTAINER (not just dev server) to re-resolve; SOP §"Dev container" has details
- pricing.json: o1-mini and open-mistral-nemo output rates are unverified estimates
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs; push main directly
