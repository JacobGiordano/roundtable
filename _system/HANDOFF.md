Last updated: 2026-07-21 (ship: waves 12 + 13)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Waves 12 and 13 shipped. Issues closed: #501 #529 #474 #534 #497 #498 #499 #494

- **Luma**: added `thinking-pulse` and `thinking-exit` rows to motion.md summary table (#501)
- **Scout**: fixed stale autochain comment + added 2 autochain priming tests; #474 already had coverage (`markdown-content-plugin-order.test.tsx`) — closed as done (#529 #474)
- **Ada**: full WCAG 2.5.8 touch target audit — 10 blockers filed as #535–#541, 7 advisories bundled in #542 (#534)
- **Forge**: `sync-models-json.yml` now validates per-provider model counts + top-level shape; #497 and #499 were already done (#497 #498 #499)
- **Vault**: `storageUsage.ts` — pre-flight 80% quota guard in `saveConversation`, `evictOldGeneratedImages()` (keeps last 3 per conversation, in-memory cache unaffected), `getStorageUsage()` exported for #495 companion UI (#494)

## Key decisions

- Vault eviction: in-memory cache keeps full base64 blobs; only the localStorage write is trimmed — current session always has full images
- `getStorageUsage()` is NOT on StorageProvider interface (localStorage-specific; ServerStorageProvider has no meaningful implementation)
- `sync-models-json.yml`: per-provider zero-model check + shape assertion — do not revert to aggregate-only validation

## Open issues (priority order)

- **#535–#541** — Aria: WCAG 2.5.8 touch target blockers (10 elements across 7 issues) — next Aria wave
- **#542** — Ada: WCAG 2.5.8 advisory candidates (lower priority)
- **#463** — Aria: error state tone — auth vs rate-limit vs network
- **#493** — Atlas: per-model max_tokens override for custom/generic providers
- **#495** — Vault/Aria: storage usage reporting UI (getStorageUsage() now ready)
- **#496/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#530** — Forge + Scout: Playwright smoke suite for AFK visual verification
- **#527** — Luma → Aria: empty state visual polish

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
