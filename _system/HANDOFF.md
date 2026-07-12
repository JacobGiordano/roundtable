Last updated: 2026-07-12 (post-#377 ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #377 (Atlas + Gate + Scout: OpenAI image generation via gpt-image-2).

Atlas added `generateImage()` to `GPT55ModelProvider` in `gpt.ts` — routes to `/v1/images/generations` when `IMAGE_GEN_MODEL_STRINGS.has(modelString) && requestImageGeneration === true`. Parses `b64_json` response into `GeneratedImage[]`; emits a single done chunk with `images` populated and no token usage (endpoint returns none). Gate added `imageGeneration: true` to `BUILTIN_CAPABILITIES_MAP['gpt-5.5']` to enable the UI toggle and satisfy the gate in `sendMessage.ts`. Scout added 40 integration tests covering all paths. Rune: green.

## Key decisions

- `IMAGE_GEN_MODEL_STRINGS` in `gpt.ts` gates which model versions use `/v1/images/generations` vs chat completions
- `gpt-image-2` MIME type hardcoded to `image/png` (API returns no MIME type for b64_json responses)
- `revised_prompt` from OpenAI response → `GeneratedImage.altText` (OpenAI may rewrite prompts)
- `tokenUsage` is `undefined` for image gen responses — images endpoint returns no token counts
- `gpt-image-1` kept in `IMAGE_GEN_MODEL_STRINGS` until Oct 23 2026 (OpenAI deprecation date); no runtime UI
- `BUILTIN_CAPABILITIES_MAP['gpt-5.5']` now includes `imageGeneration: true` (same pattern as gemini)
- `isValidCapabilities()` `knownFields` missing `imageGeneration`/`thinking`/`structuredOutputs`/`contextManagement` — Gate ticket opened (#384), not a blocker
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
- Stop button: `isPending` covers dispatch→first-chunk window; `isStreaming` covers streaming window
- `stopMessage` in `@/models` uses `AbortSignal.any()` — external (Aria) + internal signals both cancel

## Open issues

- `#384` — Gate: extend `isValidCapabilities()` `knownFields` to include newer `ProviderCapabilities` fields

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
