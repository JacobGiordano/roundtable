Last updated: 2026-07-15 (ship: #387 sanitize external model IDs in catalog)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #387 (add `SAFE_MODEL_ID` regex guard in `catalog.ts` — validates model IDs from OpenRouter, models.json, and remote catalog before any entry is pushed into the returned catalog; prevents path-traversal injection into Gemini URL construction).

## Key decisions

- gpt-image-2: `output_format: 'png'` (not `response_format`); always returns `item.b64_json` (not a CDN URL) — URL-fetch branch was wrong assumption, now removed
- `resolveVersionCatalog()` must use collect-then-fall-through; never unconditional return from live API path
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` per-model; two-condition gate: capabilities + toggle both required
- Attachment strip renders above message text (mb-2) — do not revert
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs
- `GPT_IMAGE_MODEL_CONFIG.get()!` non-null assertion in gpt.ts is safe by construction (guarded by .has() check upstream) — revisit if routing and config lookup are ever decoupled
- `SAFE_MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:\-]{0,127}$/` — applied at all three catalog fetch sites; `isRemoteCatalogEntry` not modified (structural validator only — regex applied after it passes)

## Open issues

- `#391` — spike: generated video support — DEFER; revisit when OpenRouter video API stabilizes

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Chunk size warning on build (~791 kB) — pre-existing
- Container DNS: OpenAI CDN IPs baked at container start — ENOTFOUND means restart container, not dev server
- OpenRouter fetch in dev: not on firewall allowlist — silently falls through to models.json then bundled
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after
- Scout should add unit tests for #387 validation sites: supply path-traversal strings and assert they are absent from returned catalog
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
