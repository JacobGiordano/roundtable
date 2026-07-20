Last updated: 2026-07-20 (ship: wave 10)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 10 shipped. Issues closed: #522 #523 #524 #525 #526 #528

- **Arch**: removed `imageGenerationEnabled` from `ModelConfig` (#522 types)
- **Atlas**: added `gpt-5.6` to `MAX_COMPLETION_TOKENS_MODELS` (root cause of #525 chain error); added autochain dispatch-time priming chunks (#526 models side)
- **Aria**: removed `ImageGenToggleRow` and all wiring (#522 UI); portaled copy dropdown (#523); fixed table alternating row shading via imperative index (#524); fixed stale-conversation race in `handleSend`/`handleRetry` (#526 Aria side); first-model auto-activation + dismiss affordance on active pills (#528)
- **Ada**: cleared after one blocker fix — portal dropdown was using `role="menu"` without Arrow-key navigation; fixed by removing menu roles and moving focus to first portal button on open

## Key decisions

- `gpt-5.6` is the first/default GPT version and requires `max_completion_tokens` — omitting it caused 400s which triggered the retry path, producing the misleading "gpt-5.5 not active" error
- autochain now emits priming chunks per step (parallel and directed already did); `priming-chunks.test.ts` comment is stale — Scout issue #529 filed
- Portal dropdown pattern: plain buttons with focus-on-open, not `role="menu"` — avoids unimplemented Arrow-key obligation
- `imageGenerationEnabled` fully removed from types and UI — always-on via roster capabilities is the authoritative path

## Open issues (priority order)

- **#529** — Scout: update stale autochain comment + add priming test (Scout)
- **#463** — error state tone: auth vs rate-limit vs network (Aria)
- **#474** — MarkdownContent rehype plugin order regression test (Scout)
- **#493** — per-model max_tokens override for custom/generic providers (Atlas)
- **#494** — unbounded base64 attachment storage (Vault)
- **#496/#495/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#497/#498/#499** — CI hardening wave (Forge)
- **#527** — empty state visual polish (Luma → Aria)
- **#501** — Luma ThinkingIndicator motion rows (Luma)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
