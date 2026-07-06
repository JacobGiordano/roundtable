Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

Productive triage and planning session. Two fixes shipped, Atlas wave merged to local main (not yet pushed), five new feature tickets filed.

**Shipped:**
- `8338ce6` — fix(ui): re-key chunk-entering span so chunkFadeIn fires on every chunk (MessageBubble.tsx)

**Atlas wave — merged to local main, awaiting ship authorization:**
- `#344` — fix(models): align buildAttributedMessages error-sentinel predicate with filterMessagesForApi
- `#349` — feat(models): emit dispatch-time priming chunks for parallel and directed modes
- `#345` — spike: stream_options.include_usage safe on o1/o1-mini (no code change, comment added)
- `#346` — spike: gpt-5.5 broadly available on paid tiers since April 2026 (no default change, comment added)

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- `ConversationDefaults` implemented as standalone exported fns, not `StorageProvider` methods
- Ghost mode guard lives in Aria, not Vault
- gpt-5.5 500 errors observed were transient API blips, not model availability issues
- stream_options.include_usage confirmed safe for all OpenAI models including o1/o1-mini

## Open issues

- #343: [Scout] 2 pre-existing `aria-hidden` failures in conversation-empty-state.test.tsx
- #344: [Atlas] MERGED TO LOCAL MAIN — awaiting ship authorization
- #345: [Atlas] MERGED TO LOCAL MAIN — awaiting ship authorization
- #346: [Atlas] MERGED TO LOCAL MAIN — awaiting ship authorization
- #347: [Aria] Empty-bubble polish for pre-first-chunk placeholder (depends on #349 being shipped)
- #349: [Atlas] MERGED TO LOCAL MAIN — awaiting ship authorization

**Cost display feature (dependency chain — do in order):**
- #350: [Arch] Types: PricingTable, PricingEntry, PricingMetadata
- #351: [Gate] Pricing cache: fetch, store, expose with staleness tracking + runtime URL override
- #352: [Atlas] Cost computation at send time + create pricing.json
- #353: [Aria] SessionTokenSection cost column + staleness footer + pricing URL settings field

## What's next

1. Ship Atlas wave (#344, #345, #346, #349) — user authorization needed
2. Start cost display feature: Arch (#350) first, then Gate (#351) + Atlas (#352) in parallel, then Aria (#353)
3. #343: Scout fixes aria-hidden test failures (can run anytime, independent)
4. #347: Aria empty-bubble polish (unblocked once #349 is shipped)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- `ConversationEmptyState` beacon stagger: 150ms base delay is intentional
- Chunk size warning on build (560 kB) — pre-existing
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
