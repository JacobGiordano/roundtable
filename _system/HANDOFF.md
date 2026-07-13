Last updated: 2026-07-12 (post-#392 hotfix ship)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #392 (Atlas: hotfix — send regression from #386). `resolveVersionCatalog()` had an unconditional `return` on the live API path. When Anthropic's `/v1/models` is CORS-blocked in browsers (always), the function returned `[]` immediately, never reaching the bundled fallback. Empty catalog → empty model picker → `canSend` guard blocked send → total silence for users with an Anthropic key. Fix: collect live result first, only return early if non-empty; empty falls through to OpenRouter → models.json → bundled.

Shipped #390 (Aria + Ada + Scout: image action controls). Hover overlay with download icon on generated image thumbnails; lightbox gets download (bottom-right), copy-to-clipboard PNG-only (bottom-right), info toggle (bottom-left, conditional on altText). Download uses `data:${mimeType};base64,...` with extension derived from mimeType; filename `roundtable-image-<timestamp>.<ext>`. New utility `src/ui/utils/imageActions.ts`. Ada two WARNs resolved before commit. 68 Scout tests. 2184 passed / 7 skipped / 0 failed.

Opened #391 (spike: generated video support). Atlas verdict: DEFER. Sora shutting down Sept 24, every provider is async/polling (novel pattern), video URLs expire in 24h (no export solution). Revisit when OpenRouter's video API stabilizes and OpenAI announces Sora replacement.

## Key decisions

- `resolveVersionCatalog()` must use collect-then-fall-through: collect live result, return early only if non-empty; never unconditionally return from live API path
- altText is absent for ALL Gemini images, conditional for GPT (only when prompt revised) — treat as always optional
- Download filename: `roundtable-image-<timestamp>.<ext>`, ext derived from mimeType
- Copy-to-clipboard: PNG-only gate required (ClipboardItem JPEG support inconsistent across browsers)
- Image action controls: hover overlay pattern (not nameplate toolbar) — translucent black bar at bottom of thumbnail
- Lightbox DOM order: download → info → close (Tab cycles logically); initial focus on close unchanged
- OpenRouter prefix map: anthropic → `anthropic`, GPT → `openai`, Gemini → `google`, Grok → `x-ai`, DeepSeek → `deepseek`, Mistral → `mistralai`
- `openrouterPrefix` lives on `ModelRegistryEntry` in `registry.ts` (Atlas-owned) — no types/index.ts change needed
- Capabilities NOT sourced from OpenRouter — `BUILTIN_CAPABILITIES_MAP` remains authoritative
- `models.json` / `public/models.json` pattern mirrors `pricing.json` / `public/pricing.json`
- sync-models-json.yml uses `[skip ci]` on auto-commits to avoid re-triggering CI
- #387 (model ID sanitization) is a hard prerequisite before any PR wires live catalog into the version picker UI
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

- `#387` — Atlas: sanitize model IDs from external sources before use (prerequisite for UI wire-up of live discovery)
- `#388` — Atlas: replace verbatim external response body in console.warn validation failures
- `#390` — **pending visual review** — image action controls on local main, not yet pushed; needs dev-server check before ship
- `#391` — spike: generated video support — DEFER verdict posted; no action needed

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- Chunk size warning on build (783 kB) — pre-existing, grew with @mention overlay components
- Container DNS: OpenAI CDN IPs baked into ipset at container start — ENOTFOUND on api.openai.com
  means restart the CONTAINER (not just dev server) to re-resolve; SOP §"Dev container" has details
- pricing.json: o1-mini and open-mistral-nemo output rates are unverified estimates
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after that date
- OpenRouter fetch in dev container: openrouter.ai not on firewall allowlist — tier 1 silently returns [] in dev, falls through to models.json (tier 2) or bundled (tier 3) — expected behavior
- #387 is a hard prerequisite before any PR wires live catalog results into the version picker UI
- Rune: called before any PR touching auth, API key handling, model output rendering, or backend routes
- Gauge: called on request or before PRs with non-trivial logic changes or refactors
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs; push main directly
