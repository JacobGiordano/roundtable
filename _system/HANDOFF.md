Last updated: 2026-07-23 (ship: wave 23 — #426 #427 #428 #429 #430 #431 #432 #434 #435 #438 #439 #440 #443)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 23 shipped. 13 issues closed across Atlas, Gate, Vault, Arch, Aria, Ada.

- **Atlas**: precise 400 error classification (body-driven, not status-code); systemPrompt capability gate in generic.ts (#426 #438)
- **Arch**: `accents.user` added to `CustomThemeJSON`; `StorageErrorCode` union extended to cover server codes; ModelConfig.color JSDoc corrected (#429 #427 #436)
- **Gate**: `customThemeActive` no longer leaks on built-in theme switch; `importSetup()` allowlists credential keys; stale prose/validator comment removed (#430 #443 #429)
- **Vault**: `safeSet` throws typed `StorageError`; `deriveTitle` strips markdown + `[Image]` fallback; `StorageError.ts` aligned with contract (#428 #434 #427)
- **Aria**: blockquote border consistent across streaming/done; sidebar width guard reactive on resize; Manual mode removed; ghost mode live region silent on mount; focus fallback after active deletion (#431 #432 #440 #435 #439)
- **Ada**: PASS — 2374 passing, 13 new a11y tests

## Key decisions

- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode` — same concept, different provider literals; collapsing would require a breaking rename
- 400 error classification is now body-driven: OpenAI `error.code`, Anthropic `error.type` + keyword; falls back to `unknown` for unrecognized 400s
- Manual mode removed from `InteractionModeSwitcher` entirely — re-add when the feature ships
- Ghost mode live region suppresses on mount via `useRef` guard — announces on change only
- Focus fallback order after deletion: next conversation three-dot button → New Conversation button

## Open issues (priority order)

- **#453** — Arch + Vault + Aria: image export opt-out + pre-download disclosure (Arch types gate first)
- **#409** — Aria: render markdown in model responses (big standalone; has follow-ons #410 #412 #414 #415 #416; Scout #416)
- **#408** — Aria: system prompt per conversation
- **#407** — Aria: wire live model discovery into version picker
- **#425** — Atlas: gpt-image-gen.test.ts pre-existing failure
- **#413** — Luma: correct token class names in markdown-rendering.md (Luma spec fix, precedes #409)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable (italic + indentation co-convey blockquote semantic); revisit only if italic styling is removed
