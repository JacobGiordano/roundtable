Last updated: 2026-07-27 (waves 27 + 28 shipped)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` on `Conversation` type is canonical; ephemeral Map in App state is interim source until Vault/Aria wire it up
- Ghost bubble root cause: ThinkingIndicator fade effect had `thinkingFading` in dep array → timer cancelled prematurely → body blank. Fixed with `thinkingFadingRef` + `fadingTimerRef` (wave 28).
- Auto-focus pattern: double-rAF `.focus()` via `autoFocusKey` prop — consistent with all other InputBar focus sites

## Follow-on issues to file (next session)

- Vault: persist `conversationSystemPrompt` from Conversation type field
- Aria: wire ephemeral Map in App state → `conversation.conversationSystemPrompt` on save/load

## Open issues

- #407 — feat(ui): wire live model discovery into version picker (Aria)
- #408 — feat(ui): system prompt support per conversation (Aria + Vault + Arch)
- #410 — perf(bundle): bundle size audit after markdown deps (Tempo)
- #416 — test(ui): XSS payload unit tests for MarkdownContent (Scout)
- #420 — fix(models): ChatGPT model list from OpenRouter catalog (Atlas)
- #549 — types: add 'openai' to liveApiProvider union (Arch)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode`
- Dev server: restart after all merges — HMR can disrupt in-flight streams
