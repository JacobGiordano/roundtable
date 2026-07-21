Last updated: 2026-07-21 (ship: wave 10 + visual follow-ups)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 10 shipped + visual follow-up fixes. Issues closed: #522 #523 #524 #525 #526 #528

- **Arch**: removed `imageGenerationEnabled` from `ModelConfig`
- **Atlas**: added `gpt-5.6` to `MAX_COMPLETION_TOKENS_MODELS` (root cause of chain error); autochain priming chunks
- **Aria**: toggle wiring removal, copy dropdown portal, table renderer, stale-conversation race, model selector first-load + dismiss affordance
- **Ada**: cleared after blocker fix — portal dropdown keyboard pattern (removed menu roles, focus-on-open)
- **Post-ship visual fixes**: palette icon restored (absolute positioning anchor back on outer div); palette offsets to `right-[22px]` when dismiss × also shows; alternating row shading stripped (CSS approach filed as #533)

## Key decisions

- `gpt-5.6` requires `max_completion_tokens` — omitting it caused the 400→retry→"not active" chain
- Portal dropdown: plain buttons + focus-on-open, not `role="menu"` (avoids Arrow-key obligation)
- Alternating row shading: React-based approaches fail; follow-up #533 uses `.markdown-table tbody tr:nth-child(even)` in CSS
- × dismiss button: hover-only + 16×16px is broken on mobile; Luma spec needed (#531) before Aria re-implements
- `imageGenerationEnabled` fully removed — always-on via roster capabilities

## Open issues (priority order)

- **#529** — Scout: update stale autochain comment + add priming test
- **#533** — Aria: alternating table row shading via CSS nth-child (quick win)
- **#531** — Luma → Aria: × dismiss button mobile redesign (touch target + hover-free)
- **#532** — Ada: add WCAG 2.5.8 touch target checks to audit checklist
- **#463** — Aria: error state tone — auth vs rate-limit vs network
- **#474** — Scout: MarkdownContent rehype plugin order regression test
- **#493** — Atlas: per-model max_tokens override for custom/generic providers
- **#494** — Vault: unbounded base64 attachment storage
- **#496/#495/#480/#481** — StorageProvider interface expansion wave (Vault + Arch)
- **#497/#498/#499** — CI hardening wave (Forge)
- **#530** — Forge + Scout: Playwright smoke suite for AFK visual verification
- **#527** — Luma → Aria: empty state visual polish
- **#501** — Luma: ThinkingIndicator motion rows

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `cd /workspace` before git operations
