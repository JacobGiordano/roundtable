Last updated: 2026-06-17 (ship #222 #223 + agent cascade fix)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Keyboard navigation QA during #216–#220 visual review surfaced two pre-existing bugs:

- #222 (Aria): MessageThread scroll container missing focus-visible ring. Added `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset`. `ring-inset` required — parent has `overflow-hidden`, outset ring is clipped.

- #223 (Aria): ProviderSettingsPanel missing `inert` when closed. Panel uses `translateX(100%)` off-screen but all form fields remained in tab order — keyboard users hit 15+ invisible elements between sidebar and main area. Fixed via `{...({ inert: !isOpen ? '' : undefined } as React.HTMLAttributes<HTMLDivElement>)}` spread cast on root drawer div (React 18 types don't expose `inert` natively).

Also shipped:
- Agent cascade fix (b84a661): Added "When spawned by Coda" sections to `aria.md` and `ada.md` profiles. Aria no longer runs Ada; Ada no longer runs Flint. Coda orchestrates all gate agents. Global fix — no per-prompt patching needed.

## Key decisions

- `ring-inset` is the correct pattern for focus rings on full-height containers inside `overflow-hidden` parents.
- `inert` attribute (not `aria-hidden` + `pointer-events-none`) is the correct tool for off-screen panels — it covers tab order, AT tree, and pointer events in one attribute.
- TypeScript cast `as React.HTMLAttributes<HTMLDivElement>` used for `inert` since `@types/react` 18.3.3 only exposes it in `experimental.d.ts`.

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

Good next wave options:
- Aria: #221 (sr-only sibling move — trivial, batch with any other Aria work)
- Aria: #166 (Cmd+N) or #167 (theme picker swatches) — user-visible features
- Gate: #171 (test connection) or #172 (credentialKey status)
- Atlas: #177 (remote model catalog)

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- `ring-focus` = focus ring token; `ring-ring` does NOT exist in this codebase
- `ring-inset` required on full-height containers inside `overflow-hidden` parents — outset rings are clipped
- `inert` attribute: use `!isOpen ? '' : undefined` (not boolean true/false) — React omits `undefined` from DOM; `inert="false"` is treated as truthy by some browsers
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- Bash tool CWD can drift into a worktree — always use `git -C /workspace` for git commands
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- Ghost mode tooltip anchor pattern: `tabIndex={0}` wrapper div + `aria-label` + `aria-describedby` + immediate onFocus show + 600ms hover setTimeout — see InputBar.tsx
- App.tsx handleSend calls store.updateConversation() TWICE per send+done cycle — correct, documented
- Release workflow requires one-time repo setting: Settings → Actions → General → "Read and write permissions"
- `StoredConversation` envelope in localStorage: `{ schemaVersion: 1, data: Conversation }` — bare legacy records auto-migrate on read
- Agent cascade fix shipped b84a661: Aria skips Ada, Ada skips Flint, when spawned by Coda
