Last updated: 2026-06-18 (ship #166 #167 #221 #171)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Parallel wave — Aria + Gate:

- #221 (Aria): InteractionModeSwitcher sr-only span moved to radiogroup sibling via React fragment. Fixes double-read on JAWS ≤ 2022.

- #167 (Aria): Theme picker now shows two color swatches per button (surfaces.background + accents['model-claude']) from THEME_MAP. aria-hidden on swatch wrapper; label is accessible name.

- #166 (Aria): Cmd+N / Ctrl+N keyboard shortcut registered at document level in AppLayout. Suppressed in input/textarea/contenteditable. Tooltip on both mobile header and desktop Sidebar new-conversation buttons (below the button, 600ms hover / immediate focus). 17 new Ada a11y tests.

- #171 (Gate): Test Connection button added to ApiKeyPanel masked-display state. New credentialTest.ts hits list-models endpoints (no tokens). Shows Valid / Invalid / rate-limited / error with auto-clear after 5s. aria-live region for screen readers.

## Key decisions

- New-conversation tooltip: `top-full` (below button) — header position makes `bottom-full` clip off screen
- `focus-within:` on wrapper divs; `focus-visible:` directly on interactive elements; bare `focus:` on skip-link destinations
- Double-rAF is canonical pattern for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
- Aria always runs Ada once per session — Coda goes straight to Flint after Aria's Ada verdict
- Test connection fetch: browser-side only (native fetch). In-container, Google/xAI/DeepSeek/Mistral endpoints hit firewall — graceful "Network error" shown.

## Open advisories (not yet addressed)

- #228 (Gate) — ApiKeyPanel test-connection setTimeout not cancelled on unmount (React 18 no-op, advisory)
- #199 (Aria, deferred) — coming-soon spans: radiogroup ownership + keyboard discoverability
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps has 30 props)
- #172 (Gate) — credentialKey status not exposed for custom providers
- #171 done; #172 still open
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #165 (Aria) — Per-model visibility toggle
- #164 (Aria) — Conversation rename
- #162 (Aria) — Message editing
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit

## What's next

Good next wave options:
- Aria: #162 (message editing) — high user value, solo session
- Aria: #164 (conversation rename) + #165 (per-model visibility) — batch
- Gate: #172 (credentialKey status) + #228 (unmount cleanup) — batch
- Atlas: #177 (remote model catalog)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `ring-inset` for full-height containers / borderless elements in styled wrappers
- `focus-within:` on wrapper divs; bare `focus:` on skip-link destinations
- Double-rAF for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
- New-conversation tooltip: `top-full mt-2` (below), not `bottom-full` — header context
- Aria always runs Ada once per session — Coda goes straight to Flint after Aria's Ada verdict
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- Ghost mode tooltip: `tabIndex={0}` + `aria-label` + immediate onFocus + 600ms hover — InputBar.tsx canonical
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Test connection fetch: browser-side native fetch; container firewall blocks Google/xAI/DeepSeek/Mistral
