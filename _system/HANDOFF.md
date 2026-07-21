Last updated: 2026-07-21 (ship: wave 15)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 15 shipped. Issues closed: #535 #536 #537 #538 #539 #540 #541 #478 #479 #482 #483 #489

- **Aria + Ada**: all 10 WCAG 2.5.8 touch target blockers fixed across 6 files; Ada re-audit passed (#535–#541)
- **Scout**: 15 new InputBar @mention integration tests; `makeGeneratedImage` consolidated from 3 definitions to 1 shared fixture (#478 #479)
- **Arch**: #482 and #483 already done in prior wave — closed as resolved
- **Quill**: `/docs/themes.md` — full token schema reference, validator error map, worked example (#489)
- **Filed**: #543 — `CustomThemeJSON` prose field incomplete (2 declared vs. 7 required by validator)

## Key decisions

- WCAG 2.5.8 eye-toggle buttons in ProviderSettingsPanel: repositioned `right-3` → `right-1` to center 32px button in 36px input padding — verify visually in dev server
- `maxTokens` on `CustomProviderConfig`: absence falls back to `MAX_TOKENS_GENERIC` (8192) — no migration needed
- `thread-action-menu.md` spec: `role="menu"` ↔ `role="dialog"` switch is load-bearing WCAG 4.1.2 fix — respect when Aria next touches that component
- Vault eviction: in-memory cache retains full base64; only localStorage write is trimmed

## Open issues (priority order)

- **#543** — Arch: CustomThemeJSON prose field incomplete (2 declared, 7 required by validator)
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
