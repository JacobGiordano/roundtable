Last updated: 2026-07-23 (ship: wave 26 — #408 #407 + Atlas cleanup + Tempo audit)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 26 shipped. Atlas registry cleanup landed. Tempo bundle audit completed — tickets opened.

- **Wave 25**: Aria (#414+#415+#433), Scout (#416), Atlas (#420), Arch (#549), Atlas cleanup
- **Wave 26**: Aria (#408 system prompt, #407 live model discovery + Ada PASS)
- **Tempo audit (#410)**: markdown chunk is justified; lazy-load is the one real win

## Key decisions

- `includeGeneratedImages` defaults to `false` — opt-in matches Vera's privacy-conservative posture
- Streaming path link renderer mirrors done-path `SAFE_SCHEMES` — unsafe hrefs render as inert `<span>`
- Per-conversation system prompt is ephemeral (Map in App state) until Arch adds `conversationSystemPrompt` to `Conversation` type (#554)
- `aria-live` span for catalog fetch always rendered (never conditionally mounted) — WCAG 4.1.3
- `liveApiProvider` canonical type includes `'openai'`; local workaround in registry.ts removed

## Open issues (priority order)

- **#554** — Arch: add `conversationSystemPrompt?: string` to `Conversation` interface (system prompt persistence)
- **#551** — Forge: move `dompurify` into markdown manualChunk (prerequisite for lazy-load)
- **#550** — Aria: lazy-load `MessageThread` to defer 105 kB markdown chunk off initial load (after #551)
- **#552** — Aria: extract shared `HIGHLIGHT_LANGUAGES`/`rehypePlugins` to avoid streaming/done drift
- **#553** — Aria: remove `markdown` hljs language (~2–3 kB gzip, fold into next Aria session)

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
