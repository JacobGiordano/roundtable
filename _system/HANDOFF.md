Last updated: 2026-07-21 (ship: wave 11)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 11 shipped. Issues closed: #531 #532 #533

- **Luma**: specced mobile-safe model pill dismiss affordance (_design/specs/model-pill-dismiss.md)
- **Aria**: × button enlarged to w-6 h-6 (24×24px, WCAG 2.5.8); CSS-only opacity with @media(hover:none) for touch; isPillHovered JS state removed entirely; palette icon also converted to CSS group-hover
- **Ada**: WCAG 2.2 §2.5.8 touch target size added to audit checklist (.claude/agents/ada.md)
- **Coda direct**: alternating table row shading via .markdown-table tbody tr:nth-child(even) in index.css — React-based approaches failed due to reconciler timing; browser-native CSS works

## Key decisions

- × button: CSS-only opacity (no JS hover state); @media(hover:none) for touch rest opacity (0.55 vs 0.35 on pointer) — clean, no JS required
- Table shading: must use top-level CSS rule with a scoped class, not Tailwind even: or React.Children.map/cloneElement — both fail due to ReactMarkdown reconciler timing
- Ada checklist now includes WCAG 2.5.8 with Blocker (<24px, no offset) / Advisory (24px spacing offset saves it) thresholds; tabIndex={-1}/aria-hidden elements exempt
- Full WCAG 2.5.8 sweep of all existing components filed as #534

## Open issues (priority order)

- **#534** — Ada: full WCAG 2.5.8 touch target audit across all existing components
- **#529** — Scout: update stale autochain comment + add priming test
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
