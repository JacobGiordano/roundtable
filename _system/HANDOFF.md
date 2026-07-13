Last updated: 2026-07-13 (ship: #390 + #393–#398 bundle)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped bundle: #393 (selectedVersionId fallback), #394 (auto-create on send), #390 (image action controls — visual sign-off complete), #395 (error text now shows in model response bubbles), #396 (copy button on error bubbles), #397 (reply-to/token count gap), #398 (gpt-image-2 format fix).

Queued next Aria wave: #400–404 (timestamp refresh on interaction, image bubble token/cost display, image copy icon mismatch, extra space above image, buttons-below-image enhancement).

## Key decisions

- gpt-image-2: `output_format: 'png'` (not `response_format`); always returns `item.b64_json` (not a CDN URL) — URL-fetch branch was wrong assumption, now removed
- #399 queued: model config map for image models so parameter divergence is data, not scattered conditionals
- `resolveVersionCatalog()` must use collect-then-fall-through; never unconditional return from live API path
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` per-model; two-condition gate: capabilities + toggle both required
- Attachment strip renders above message text (mb-2) — do not revert
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs

## Open issues

- `#387` — Atlas: sanitize model IDs from external sources (prerequisite for live-discovery UI wire-up)
- `#388` — Atlas: replace verbatim external response body in console.warn validation failures
- `#391` — spike: generated video support — DEFER; revisit when OpenRouter video API stabilizes
- `#399` — Atlas: model config map for image models (follow-on to #398)
- `#400–404` — Aria wave queued (timestamps, image bubble polish, buttons-below-image)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Chunk size warning on build (~790 kB) — pre-existing
- Container DNS: OpenAI CDN IPs baked at container start — ENOTFOUND means restart container, not dev server
- OpenRouter fetch in dev: not on firewall allowlist — silently falls through to models.json then bundled
- #387 hard prerequisite before live catalog results wire into version picker UI
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
