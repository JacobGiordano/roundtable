Last updated: 2026-06-21 (ship: wave — Aria #241 ThreadActionMenu a11y + Gate #238 custom credential testing)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Aria #241 + Gate #238 (parallel worktrees)**

- **#241 (Aria/Ada)** — ThreadActionMenu `aria-required-children` critical violation resolved. `role="dialog" aria-modal="true"` was already switching on sub-states; remaining gaps were: confirm-delete Cancel called `onClose` instead of `closeAndReturnFocus` (WCAG 2.4.3), and group-input `<input>` lacked `aria-label` (WCAG 4.1.2). Both fixed. Ada: PASS.
- **#238 (Gate)** — `testCustomCredential(endpointUrl, apiKey?)` added to `credentialTest.ts`. New `cors-or-network` TestResult status distinguishes CORS/network failures from bad keys. Keyless endpoint support (no Authorization header when key absent). UI wired in `ApiKeyPanel.tsx` via `endpointUrl` prop + `KeylessEndpointRow`. 42 new tests. Exports added to `index.ts`.
- **Flint**: PASS — 1248/1249 tests green (pre-existing ExportButton Escape failure only).

## Key decisions

- `roundtable:` prefix (colon separator, kebab-case) is the canonical localStorage convention for all new keys.
- Migration shims live in place for one release cycle, then get removed.
- ThreadActionMenu backdrop pattern is intentional — backdrop blocks hover bleed; `useClickOutside` is for non-modal dropdowns only.
- `cors-or-network` is a distinct TestResult status (not `error`) — allows UI to surface a more informative message for custom endpoints where CORS ambiguity is expected.

## Open advisories

- #246 (Ada) — Regression test for ThreadActionMenu group-input `aria-label` in `thread-action-menu.test.tsx`
- #247 (Aria) — Focus-return on group-suggestion buttons; UX decision needed for post-delete focus target
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

- **Aria: #146** — Sidebar.tsx (1499 lines) + ModelSelectorPanel.tsx (1215 lines) splitting (big)
- **Aria: #147** — Shared icon system (~25 SVGs inlined; big)
- **Ada: #246** — Regression test for ThreadActionMenu group-input aria-label
- **Aria: #247** — Focus-return on group-suggestion buttons (UX decision needed first)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount (single rAF OK when no unmount involved)
- `inert` attribute: `!isOpen ? '' : undefined`
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131)
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `openrouter.ai` not on container firewall allowlist — live-API catalog fetch degrades to `[]` in dev
- App integration tests read from `lastContextValue` (RoundtableContext), not `lastAppLayoutProps`
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
- `aria-disabled` not `disabled` for buttons that need tooltip discoverability via keyboard
- jsdom `DOMException` does not extend `Error` — always duck-type AbortError: `err?.name === 'AbortError'`
- Vault cache is in `LocalStorageProvider` instance scope — tests that create fresh instances always start cold
- ThreadActionMenu sub-states: `role="dialog" aria-modal="true"` not `role="menu"` — sub-state role switching is resolved (#241 closed)
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring alongside `tabIndex={-1}` — pre-existing test failure in ExportButton Escape (unrelated to recent waves)
- `BUILTIN_MODEL_IDS` from `@/auth` is the only Gate import Aria is permitted — document with comment at import site
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` shims in place — remove after one release cycle
- `useClickOutside` uses `mousedown`; ThreadActionMenu uses backdrop instead — not a regression
- `testCustomCredential` (Gate): `cors-or-network` status means CORS blocked or network error — not a bad key; built-in providers still return `error` on network failure (they always send CORS headers)
- `TestResult` type lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
