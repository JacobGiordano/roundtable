Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

Long triage + planning session. Several fixes shipped, Atlas wave shipped, cost display feature fully specced and ticketed.

**Shipped this session:**
- `8338ce6` — fix(ui): chunk fade-in re-keyed so chunkFadeIn fires on every chunk
- `dcbbd9d` — fix(models): align buildAttributedMessages error-sentinel predicate (#344)
- `af570a1` — feat(models): dispatch-time priming chunks for placeholder bubbles (#349)
- Spikes #345 (stream_options safe on o1/o1-mini) and #346 (gpt-5.5 broadly available)
- Pricing types: PricingEntry, PricingTable, PricingMetadata, PricingConfig (#350)
- fix(tests): aria-hidden selectors updated in conversation-empty-state.test.tsx (#343)

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- gpt-5.5 confirmed available on all paid tiers since April 2026 — 500s were transient
- stream_options.include_usage safe for all OpenAI models including o1/o1-mini
- Pricing data: repo-hosted pricing.json (raw.githubusercontent.com), daily stale-while-revalidate fetch, runtime URL override in settings (localStorage) takes precedence over VITE_PRICING_URL env var
- Cost display: session-scoped only (Phase 1), no retroactive recalculation, ~$X.XX format
- Lifetime dashboard deferred to Phase 2

## Open issues — cost display feature (do in order)

- #351: [Gate] Pricing cache: stale-while-revalidate fetch, localStorage, runtime URL override + savePricingUrl()
- #352: [Atlas] Cost computation at send time + create pricing.json in repo root
- #353: [Aria] SessionTokenSection cost column + staleness footer + pricing URL settings field

Gate (#351) and Atlas (#352) can run in parallel. Aria (#353) goes last.

## Other open issues

- #347: [Aria] Empty-bubble polish for pre-first-chunk placeholder (unblocked — #349 shipped)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- ConversationEmptyState beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (560 kB) — pre-existing
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
