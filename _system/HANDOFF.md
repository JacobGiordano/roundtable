Last updated: 2026-07-21 (ship: wave 16)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 16 shipped. Issues closed: #542 #543

- **Aria + Ada**: all 7 WCAG 2.5.8 advisory touch targets fixed — `min-h-[24px]` + `inline-flex items-center` across 5 files; `gap-1 → gap-2` on image buttons; Ada re-audit passed (#542)
- **Arch**: #543 already resolved in commit `9c6d81d` (2026-06-23) — closed as done

## Key decisions

- All WCAG 2.5.8 blocker and advisory touch targets are now resolved — no remaining open a11y size issues
- Stale comment in `themeValidation.ts` line 276 ("declares only link and link-hover") is Gate cleanup on next touch — not worth a ticket
- WCAG 2.5.8 eye-toggle buttons in ProviderSettingsPanel: repositioned `right-3` → `right-1` (wave 15) — verify visually in dev server
- Vault eviction: in-memory cache retains full base64; only localStorage write is trimmed

## Open issues (priority order)

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
