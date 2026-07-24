Last updated: 2026-07-23 (ship: wave 24 — #453 export safety)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 24 shipped. #409 and #412 discovered already in main (closed). Stale issues reconciled.

- **Wave 24**: Arch (#453 types), Vault (#453 export logic), Aria (#453 disclosure UI + Ada PASS)
- **Reconciled**: #409 (markdown rendering) and #412 (heading downshift) were already in main from earlier waves — both closed.

## Key decisions

- `includeGeneratedImages` defaults to `false` — opt-in model matches privacy-conservative posture Vera requires
- `ExportOptions` local duplicate in `exporters.ts` removed by Vault; all consumers now import from `@/types/index`
- Streaming path link renderer (#414 #415) gap confirmed: `MessageBubble.tsx:385` allows `//` (protocol-relative); `MarkdownContent.tsx` done path has full `SAFE_SCHEMES` — streaming path does not

## Open issues (priority order)

- **#414 + #415** — Aria: fix streaming path link renderer in MessageBubble.tsx — batch both in one Aria session (same file, same fix area)
- **#416** — Scout: XSS payload unit tests for MarkdownContent
- **#420** — Atlas: populate ChatGPT model list from OpenRouter catalog
- **#433** — Aria: @mention detaches silently on message edit
- **#408** — Aria: system prompt per conversation
- **#407** — Aria: wire live model discovery into version picker
- **#410** — Tempo: bundle size audit (markdown deps added ~347 kB chunk)

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
