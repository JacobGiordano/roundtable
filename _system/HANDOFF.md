Last updated: 2026-07-06

## Current phase

Phase 5 — Full gate process active.

## Session summary

**Inline fix — chunk fade-in animation** — Shipped in 8338ce6.

`MessageBubble.tsx`: React was reusing the same `.chunk-entering` span DOM
element on every streaming render, so `chunkFadeIn` only fired on the first
chunk. Added `key={chunkKey}` (offset captured before `prevLengthRef` advances)
to force remount on each chunk.

## Key decisions

- GitHub Pages source: gh-pages branch → / (root) — must not change
- Backend CI pinned to Node 22 LTS
- `ConversationDefaults` implemented as standalone exported fns, not `StorageProvider` methods
- Ghost mode guard lives in Aria, not Vault

## Open bugs / known issues

- #343: 2 pre-existing `aria-hidden` failures in `conversation-empty-state.test.tsx` — Scout to fix
- #344: [Atlas] Bug — inconsistent error-sentinel filtering (filterMessagesForApi vs buildAttributedMessages)
- #345: [Atlas] Spike — stream_options.include_usage compatibility with o1/o1-mini
- #346: [Atlas] Spike — gpt-5.5 default model availability
- #347: [Aria] Pre-first-chunk placeholder bubble (split pending — Atlas priming + Aria polish)
- playwright.a11y.config.ts testDir points at keyboard/ with no .spec.ts — harmless
- Chunk size warning on build (560 kB) — pre-existing

## What's next

- Split #347 into Atlas (dispatch-time priming chunks) + Aria (empty-bubble polish) tickets
- Atlas wave: #344 + #345 + #346 + #347-atlas (all /src/models, bundle efficiently)
- #343: Scout fixes aria-hidden test failures

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD — not visible in npm run dev
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically — changing to 24 breaks npm ci
- `ConversationEmptyState` beacon stagger: 150ms base delay is intentional
