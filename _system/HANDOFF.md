Last updated: 2026-07-13 (ship: #388 console.warn hygiene + #399 image model config maps)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #388 (replace verbatim external response bodies in console.warn with safe type+length summaries — six sites in catalog.ts) and #399 (per-model config maps for image generation in gpt.ts and gemini.ts, replacing scattered model-ID conditionals).

## Key decisions

- gpt-image-2: `output_format: 'png'` (not `response_format`); always returns `item.b64_json` (not a CDN URL) — URL-fetch branch was wrong assumption, now removed
- `resolveVersionCatalog()` must use collect-then-fall-through; never unconditional return from live API path
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` per-model; two-condition gate: capabilities + toggle both required
- Attachment strip renders above message text (mb-2) — do not revert
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs
- `GPT_IMAGE_MODEL_CONFIG.get()!` non-null assertion in gpt.ts is safe by construction (guarded by .has() check upstream) — revisit if routing and config lookup are ever decoupled

## Open issues

- `#387` — Atlas: sanitize model IDs from external sources (prerequisite for live-discovery UI wire-up)
- `#391` — spike: generated video support — DEFER; revisit when OpenRouter video API stabilizes

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Chunk size warning on build (~791 kB) — pre-existing
- Container DNS: OpenAI CDN IPs baked at container start — ENOTFOUND means restart container, not dev server
- OpenRouter fetch in dev: not on firewall allowlist — silently falls through to models.json then bundled
- #387 hard prerequisite before live catalog results wire into version picker UI
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
