Last updated: 2026-07-18 (ship: waves 6–9)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Waves 6–9 shipped. Issues closed: #421 #464 #471 #472 #473 #475 #477 #484 #485 #486 #487 #488 #492 #500 #517 #518 #519 #520

- **Wave 6** — Aria: imageGenerationEnabled toggle wired in ModelSelectorPanel; Ada: deprecation warning contrast tests promoted; Atlas: CORS_ORIGIN docs fixed
- **Wave 7** — Arch: PricingConfig confirmed absent, Forge backend ownership fixed in CLAUDE.md; Quill: agent tables, Node version, PR/issue templates; Atlas: estimatedCost aggregation fixed in getSessionTokenUsage()
- **Wave 8** — Quill: CONTRIBUTING.md + PR template agent list; Bastion: proxy auth tests rewritten (wave 5 contract was broken in test helper), corrupt-blob 500 paths; Scout: #473/#475 already done in wave 4
- **Wave 9** — Aria+Ada: empty state recovery affordance (#500), split copy button with plain-text strip (#471), markdown table rendering via remark-gfm (#464)

## Key decisions

- `align` attribute on GFM tables deferred — `sanitizeSchema` allows it but renderers don't forward to DOM; cosmetic only, not a WCAG violation
- Forge now owns `/backend/src/` for security middleware/rate limiting/infra (CLAUDE.md updated); not a blank check over product logic
- `stripMarkdown.ts` in `/src/ui/utils/` — regex-based, no new npm dep
- #475 and #473 were already closed in wave 4 — closed retroactively this wave

## Open issues (priority order)

- **#425 gpt-image-gen.test.ts** — pre-existing Atlas test failure; no filed issue; Atlas scope
- **#463** — error state tone: auth vs rate-limit vs network (Aria)
- **#493** — per-model max_tokens override for custom/generic providers (Atlas)
- **#474** — MarkdownContent rehype plugin order regression test (Scout)
- **#494** — unbounded base64 attachment storage (Vault)
- **#496/#495/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#497/#498/#499** — CI hardening wave (Forge)
- **#501** — Luma ThinkingIndicator motion rows (Luma)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
