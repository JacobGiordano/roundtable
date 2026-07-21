Last updated: 2026-07-21 (ship: wave 14)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 14 shipped. Issues closed: #493 #466

- **Arch + Atlas**: `maxTokens?: number` added to `CustomProviderConfig`; `generic.ts` now uses `config.maxTokens ?? MAX_TOKENS_GENERIC`; 3 integration tests (low override / fallback / high override) (#493)
- **Luma**: 6 spec files for previously unspecced components — `outrun-flash.md`, `interaction-mode-switcher.md`, `bulk-action-bar.md`, `thread-action-menu.md`, `empty-states.md`, `settings-panels.md` (#466)

## Key decisions

- `maxTokens` on `CustomProviderConfig`: absence falls back to `MAX_TOKENS_GENERIC` (8192) via nullish coalescing — no migration needed for existing records
- `thread-action-menu.md` spec documents a `role="menu"` ↔ `role="dialog"` switch for sub-states — load-bearing WCAG 4.1.2 fix for when Aria next touches that component
- Vault eviction (wave 13): in-memory cache retains full base64 blobs; only the localStorage write is trimmed
- `getStorageUsage()` is NOT on StorageProvider interface (localStorage-specific)

## Open issues (priority order)

- **#535–#541** — Aria: WCAG 2.5.8 touch target blockers (10 elements, 7 issues) — next Aria wave
- **#542** — Ada: WCAG 2.5.8 advisory candidates
- **#463** — Aria: error state tone — auth vs rate-limit vs network
- **#495** — Vault/Aria: storage usage reporting UI (`getStorageUsage()` ready in `@/storage`)
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
