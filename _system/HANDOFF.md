Last updated: 2026-07-22 (ship: wave 19)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 19 shipped. Issues closed: #545 #495 #544 #480 #481 #496

- **Aria**: "Go to Settings" CTA now opens settings panel (#545); storage usage UI in Settings → Section 7 (#495)
- **Atlas**: `classifyHttpError()` added — Grok 400 + all provider 400/401/429/fetch errors now map correctly to ModelErrorCode (#544)
- **Arch**: `searchConversations`, `bulkDeleteConversations`, `bulkArchiveConversations` + `BulkOperationResult` added to StorageProvider interface (#480 #496)
- **Vault**: orphan ID cleanup + implemented all three new StorageProvider methods in LocalStorageProvider and ServerStorageProvider (#481 #480 #496)
- **Scout**: fixed CTA test regression from #545 onOpenSettings prop change
- **Flint**: PASS — all 6 issues verified

## Key decisions

- `bulkArchiveConversations(ids, archive: boolean)` — combined archive/unarchive; delete of missing ID = succeeded (idempotent), archive of missing ID = failed
- Vault implemented #480/#496 storage methods proactively when worktree included Arch's types; UI layer (search bar, bulk-select) is future Aria work
- Parallel agent worktrees cross-contaminated /workspace staging area; fixed by resetting staging and merging branches cleanly

## Open issues (priority order)

- **#546** — Scout: Grok 400 auth regression test (`classifyHttpError` body-inspection)
- **#455/#454** — Aria + Vera: image export disclosure + provider data processing disclosure
- **#456** — Gate: backend auth token TTL / logout-on-close
- **#491/#490** — Marque: OG/social image spec + PWA manifest PNG icons
- **#452–#446** — Tempo: 7 perf issues (bundle split, memo, scroll, shimmer, highlight.js)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
