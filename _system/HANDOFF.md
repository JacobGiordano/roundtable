Last updated: 2026-06-17 (ship #224 #225)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Continued keyboard navigation QA pass. Two more focus bugs found and fixed:

- #224 (Aria): ThreadRow checkbox invisible on keyboard focus. Wrapper div had `opacity-0 group-hover:opacity-100` with no focus-within rule. Fixed: added `focus-within:opacity-100` to wrapper div (not `focus-visible:` — opacity is on the containing div, not the input).

- #225 (Aria): ThreadActionMenu `closeAndReturnFocus()` raced React's menu unmount. Single rAF fired before browser painted, leaving focus on `<body>` briefly. Fixed: double-rAF (~33ms total, under human perception threshold).

Also fixed earlier this session (shipped separately):
- #222: MessageThread scroll container ring (ring-inset)
- #223: ProviderSettingsPanel inert when closed (killed 15-element hidden tab maze)
- Agent cascade: aria.md + ada.md profiles updated to skip downstream gate agents when spawned by Coda

## Key decisions

- `focus-within:` (not `focus-visible:`) on wrapper divs whose inner input is the focusable element
- Double-rAF is the correct pattern for focus restoration after React unmount — single rAF races the paint cycle
- Profile-level "skip Ada/Flint" rule is not reliable alone — always include explicit "Do not run Ada" in Aria spawn prompts too

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

- Keep the keyboard QA pass going — Tab through the full app and file any remaining focus issues
- Aria: #221 (sr-only sibling move) or #166 (Cmd+N) or #167 (theme swatches)
- Gate: #171 (test connection) or #172 (credentialKey status)
- Atlas: #177 (remote model catalog)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist in this codebase
- `ring-inset` required on full-height containers inside `overflow-hidden` parents
- `inert` attribute: use `!isOpen ? '' : undefined` — React omits `undefined` from DOM
- `focus-within:` on wrapper divs; `focus-visible:` directly on interactive elements
- Double-rAF for focus restoration after React unmount (single rAF races paint cycle)
- Aria agent cascade fix: profile rule alone is not reliable — always include explicit "Do not run Ada — Coda will handle Ada after your session" in every Aria spawn prompt
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- Ghost mode tooltip: `tabIndex={0}` wrapper + `aria-label` + immediate onFocus show + 600ms hover setTimeout — InputBar.tsx canonical
- Release workflow: one-time repo setting → Settings → Actions → General → "Read and write permissions"
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate on read
