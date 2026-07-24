Last updated: 2026-07-23 (ship: wave 25 — #414 #415 #433 #416 #420)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 25 shipped. All three branches merged to local main, lint + build clean.

- **Wave 25**: Aria (#414+#415 streaming XSS fix, #433 @mention on edit), Scout (#416 XSS unit tests), Atlas (#420 live OpenAI model catalog)

## Key decisions

- `includeGeneratedImages` defaults to `false` — opt-in matches Vera's privacy-conservative posture
- `ExportOptions` local duplicate removed by Vault; all consumers import from `@/types/index`
- Streaming path link renderer now mirrors done-path `SAFE_SCHEMES` — unsafe hrefs render as inert `<span>`
- @mention restoration on edit: `useEffect` scans `originalContent` before focus; `targetModelId` stamped on edited messages
- Atlas extended `liveApiProvider` locally in `registry.ts` to include `'openai'` (Arch debt open as #549)

## Open issues (priority order)

- **#549** — Arch: add `'openai'` to `liveApiProvider` union in `/src/types/index.ts` (Atlas workaround in `registry.ts` until this lands)
- **#408** — Aria: system prompt per conversation
- **#407** — Aria: wire live model discovery into version picker
- **#410** — Tempo: bundle size audit (markdown chunk ~347 kB)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable (italic + indentation co-convey blockquote semantic)
- gpt-image-1 request body test (response_format assertion) is absent — low priority given Oct 23 2026 deprecation
- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode`
- Scout flagged: streaming path regression tests (MessageBubble link renderer) not yet written — good follow-on for Scout after #414/#415 verified
