Last updated: 2026-06-18 (ship #226 #227 + Ada cascade fix)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Continued keyboard navigation QA pass. Three more fixes shipped:

- #226 (Aria): Skip-to-main link now targets the first meaningful interactive element. `href="#skip-target"` — when empty state: OnboardingEmptyState CTA button; when active: InputBar textarea. Mutual exclusion guaranteed (only one element holds the id at a time). 7 new Ada a11y tests.

- #227 (Aria): InputBar textarea missing direct focus ring. Added `focus:outline-none focus:ring-2 focus:ring-focus focus:ring-inset` using bare `focus:` (not `focus-visible:`) — programmatic focus from skip-link fragment nav doesn't fire `focus-visible:`.

- Ada cascade fix: CLAUDE.md step 13 updated (Arch, 84b7373) + aria.md "stop after reporting" rule moved to top. Coda now goes Aria → Flint directly when Aria's session already includes Ada verdict. One Ada run per Aria session (not two).

## Key decisions

- `focus-within:` on wrapper divs; `focus-visible:` directly on interactive elements; bare `focus:` on skip-link destinations (programmatic focus)
- Double-rAF is canonical pattern for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined` (not boolean)
- `ring-inset` required on full-height containers and borderless elements inside styled wrappers
- Ada cascade: Aria will always run Ada once per session — Coda trusts that result and goes straight to Flint, no duplicate Ada spawn

## Open advisories (not yet addressed)

- #221 (Aria/Ada) — sr-only IMS description span is inside radiogroup; should be a sibling (cosmetic)
- #199 (Aria, deferred) — coming-soon spans: radiogroup ownership + keyboard discoverability
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps has 30 props)
- #172 (Gate) — credentialKey status not exposed for custom providers
- #171 (Gate) — 'Test connection' for API keys
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #167 (Aria) — Theme picker visual preview swatches
- #166 (Aria) — Keyboard shortcut Cmd+N for new conversation
- #165 (Aria) — Per-model visibility toggle
- #164 (Aria) — Conversation rename
- #162 (Aria) — Message editing
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit

## What's next

Keyboard QA pass is winding down — most critical focus issues addressed. Good next options:
- Aria: #221 (sr-only sibling — trivial) or #166 (Cmd+N) or #167 (theme swatches)
- Gate: #171 (test connection) or #172 (credentialKey status)
- Atlas: #177 (remote model catalog)
- Feature wave: batch #166 + #167 + #221 as one Aria session

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `ring-inset` for full-height containers / borderless elements in styled wrappers
- `focus-within:` on wrapper divs; bare `focus:` on skip-link destinations
- Double-rAF for focus restoration after React unmount (single rAF races paint cycle)
- `inert` attribute: `!isOpen ? '' : undefined`
- Aria always runs Ada once per session — Coda goes straight to Flint after Aria's Ada verdict
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- Ghost mode tooltip: `tabIndex={0}` + `aria-label` + immediate onFocus + 600ms hover — InputBar.tsx canonical
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
