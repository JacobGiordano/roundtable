Last updated: 2026-07-16 (ship: #419 SAFE_MODEL_ID lint fix)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Shipped #417 + #418 (batched Aria wave): restored syntax highlighting in fenced code blocks and applied MarkdownContent to user message bubbles. Shipped #419 (Atlas): removed useless escape in SAFE_MODEL_ID regex — `npm run lint` now passes clean.

## Key decisions

- gpt-image-2: `output_format: 'png'`; always returns `item.b64_json` — URL-fetch branch removed
- `resolveVersionCatalog()` must use collect-then-fall-through; never unconditional return from live API path
- Image gen opt-in: `ModelConfig.imageGenerationEnabled` per-model; two-condition gate: capabilities + toggle both required
- Attachment strip renders above message text (mb-2) — do not revert
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)
- GH_TOKEN PAT lacks Pull requests: Read and write — agents cannot open PRs
- `GPT_IMAGE_MODEL_CONFIG.get()!` non-null assertion in gpt.ts is safe by construction — revisit if routing and config lookup are ever decoupled
- `SAFE_MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/` — hyphen at end of character class needs no escape
- `rehypeHighlight` must run before `rehypeSanitize` in MarkdownContent — order is load-bearing (hljs-* classes must exist in hast before sanitize evaluates them)
- User bubbles use MarkdownContent — full rendering parity with model bubbles
- Headings downshifted in MarkdownContent (h1→h3, h4–h6→h6) per WCAG 1.3.1 — matches streaming renderer

## Open issues

- `#391` — spike: generated video support — DEFER; revisit when OpenRouter video API stabilizes

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Chunk size warning on build (~791 kB) — pre-existing
- Agents installing new npm deps in worktrees must commit `package-lock.json` — omitting it breaks CI `npm ci`
- Container DNS: OpenAI CDN IPs baked at container start — ENOTFOUND means restart container, not dev server
- OpenRouter fetch in dev: not on firewall allowlist — silently falls through to models.json then bundled
- DeepSeek entries scheduled for deprecation 2026-07-24 — update pricing.json after
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
