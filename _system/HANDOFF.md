Last updated: 2026-07-23 (ship: wave 23 + #425 test fix)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 23 + follow-on shipped. 13 issues closed + pre-existing gpt-image-gen test fixed.

- **Wave 23**: Atlas (#426 #438), Arch (#427 #429), Gate (#429 #430 #443), Vault (#427 #428 #434), Aria (#431 #432 #440 #435 #439), Ada PASS
- **#425 test fix**: gpt-image-gen.test.ts asserted `response_format=b64_json` on gpt-image-2 (wrong parameter — gpt-image-2 uses `output_format=png`). Test corrected by Scout. Suite now fully green: 2375 passing, 0 failures.

## Key decisions

- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode` — same concept, different provider literals
- 400 error classification is now body-driven: OpenAI `error.code`, Anthropic `error.type` + keyword; falls back to `unknown` for unrecognized 400s
- Manual mode removed from `InteractionModeSwitcher` entirely — re-add when the feature ships
- Ghost mode live region suppresses on mount via `useRef` guard — announces on change only
- Focus fallback order after deletion: next conversation three-dot button → New Conversation button
- gpt-image-2 uses `output_format: 'png'` (not `response_format`); gpt-image-1 (deprecated Oct 23 2026) uses `response_format: 'b64_json'`

## Open issues (priority order)

- **#453** — Arch + Vault + Aria: image export opt-out + pre-download disclosure (Arch types gate first)
- **#409** — Aria: render markdown in model responses (big standalone; follow-ons #410 #412 #414 #415 #416 #416)
- **#408** — Aria: system prompt per conversation
- **#407** — Aria: wire live model discovery into version picker
- **#413** — Luma: correct token class names in markdown-rendering.md (Luma spec fix, precedes #409)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable (italic + indentation co-convey blockquote semantic); revisit only if italic styling is removed
- gpt-image-1 request body test (response_format assertion) is absent — low priority given Oct 23 2026 deprecation
