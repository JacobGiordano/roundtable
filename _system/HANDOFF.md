Last updated: 2026-06-20 (ship #159 — cancel streaming)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: cancel streaming (#159, #242)**

- **Arch**: `StopMessageFn = () => void`, `signal?: AbortSignal` on `SendMessageOptions`, `stopMessage: StopMessageFn` on `ConversationContext` — all in `/src/types/index.ts`
- **Atlas**: AbortSignal threaded through all 7 providers via `options.signal`; `runProviderIsolated` swallows AbortError (duck-typed `err?.name === 'AbortError'` — jsdom `DOMException` does not extend `Error`); all three routing modes (parallel, directed, auto-chain) thread signal; 12 tests in `abort-controller.test.ts`
- **Aria**: `AbortController` ref in `App.tsx`, new controller per send, `.finally()` clears ref; `stopMessage` in context; stop button in `InputBar` (44×44px, filled square) replaces send while streaming; `aria-live="polite"` live region announces state
- **Flint**: cleared, all 5 acceptance criteria passed

**#241 deferred** — correct structural fix breaks Scout's `sidebar-state-machines.test.tsx` (`within(menu)` queries sub-state content). Filed #243 for Scout to update test contracts first.

## Key decisions

- `signal` lives on `SendMessageOptions`, not on `ModelProvider.sendMessage` — the 4th positional param slot is already `selectedVersionId?: string`; adding AbortSignal there would break all 6 provider classes
- Aria owns the `AbortController` (creates, stores, passes signal, calls abort) — Atlas only threads the signal through
- AbortError detection by `err?.name === 'AbortError'` (not `instanceof Error`) for jsdom cross-environment compat
- `sendMessage` always resolves on abort — never rejects; clean `isDone: true` chunk with partial token usage emitted on mid-stream abort

## Open advisories (filed, not yet addressed)

- #244 (Aria/Ada) — Stop button: focus drops to body when send unmounts on stream start (WCAG 2.4.3)
- #243 (Scout) — Update sidebar-state-machines tests to unblock #241
- #241 (Aria/Ada) — ThreadActionMenu `role="menu"` aria-required-children in sub-states (blocked on #243)
- #238 (Gate/Atlas) — Custom provider credential testing (CORS/keyless edge cases)
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 (Vault) — StorageProvider pagination
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

Top candidates:
- Scout: #243 (update sidebar-state-machines tests) → unblocks #241
- Aria: #241 (ThreadActionMenu role fix) — once #243 lands
- Aria: #244 (focus drop on send→stop swap)
- Aria: wire `resolveVersionCatalog` into `ModelSelectorPanel` version picker (no issue # yet)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount
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
