Last updated: 2026-07-23 (ship: wave 21 + ModelPill hotfix)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Wave 21 shipped. Issues closed: #455 #454 #452 #547 #448 #449 #446 #451 #450

- **Aria**: image export disclosure (#455) + provider data processing disclosure (#454) + StableMarkdown memo wrapper for stableContent re-parse (#452) + ModelPill palette icon overlap fix (#547)
- **#448 #449 #446 #451 #450**: all confirmed already implemented in prior waves — closed as pre-existing
- **Ada**: PASS — ExportButton menu restructure satisfies aria-required-children; ProviderSettingsPanel role="note" valid; StableMarkdown no new roles

## Key decisions

- ExportButton disclosure sits outside `role="menu"` div (inside shared card wrapper) — `<p>` inside a menu violates aria-required-children
- ProviderSettingsPanel disclosure uses `<aside role="note">` at top of panel body, before Section 1
- stableContent AST caching not exposed by react-markdown API — StableMarkdown memo wrapper is the correct minimal fix
- ModelPill palette icon: `right-[22px]` → `right-9` (36px = × width + gap + inner padding)
- ModelPill hotfix: pill padding stays `pr-7` in both dismiss/no-dismiss states; `right-9` alone compensates for × wrapper offset — conditional `pr-9` was shifting icon 8px right when active

## Open issues (priority order)

- **#456 (UI)** — Aria: settings toggle for logoutOnClose (Gate layer done, UI deferred)
- **#425** — Atlas: gpt-image-gen.test.ts pre-existing failure
- **#455/#454** — shipped; Vera advisory layer complete

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek deprecated 2026-07-24 — UI warning + registry flags in place
- `gpt-image-gen.test.ts` pre-existing failure — Atlas scope, issue #425
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- Parallel worktrees cross-contaminate /workspace staging — reset staging and merge branches manually if dirty
- Relay-applied worktree fixes may miss the merge window — cherry-pick from `git log --all` if needed
