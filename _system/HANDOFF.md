Last updated: 2026-06-16 (ship #131 #132)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process active.

## Session summary

Coda coordinated a batched Aria wave — both shipped:

- #131 (Aria): Manual and Auto-chain interaction modes disabled with "coming soon"
  tooltip. Rendered as non-interactive `<span>` elements (no tabIndex, no click handler).
  Users can no longer reach a state where their selected mode is silently ignored by
  `App.tsx:handleSend`. Parallel mode unchanged.

- #132 (Aria): Markdown rendering added to `MessageBubble.tsx` via `react-markdown` +
  `rehype-sanitize`. Assistant messages render bold, italic, headings, lists, code blocks,
  inline code, and links. XSS sanitized. User messages unchanged (plain text). Link color
  uses `text-text-primary underline` (schema-guaranteed contrast in all 7 themes) pending
  Luma `text-link` token from #193.

New dependencies: `react-markdown@10.1.0`, `rehype-sanitize@6.0.0`

## Key decisions

- #131 went with Option 2 (disable) not Option 1 (implement). Full Auto-chain/Manual
  dispatch deferred — that's a future Atlas + Aria wave.
- Link color: `text-accent-claude` failed 4.5:1 in Linen (4.12:1 on bg-sidebar).
  Replaced with `text-text-primary underline`. TODO comment in code points to #193.
- Luma #193 (markdown token layer) deferred — Aria used existing semantic tokens with
  `/* TODO: Luma token #193 */` callouts on novel choices.
- Syntax highlighting deferred — code blocks render as `<pre><code>` only.
- Agent profiles updated: Aria (cross-agent file isolation, a11y scope, token discipline)
  and Flint (issue gate vs. phase gate distinction, scope discipline).

## Open advisories (filed this session)

- #198 (Aria): InteractionModeSwitcher tooltip not wired via `aria-describedby`
- #199 (Aria): Coming-soon spans break radiogroup ownership — fix when #131 Option 1 ships
- #200 (Aria): External links missing "(opens in new tab)" sr-only announcement
- #201 (Aria): Markdown headings unconstrained — h1 in message content (WCAG 1.3.1, serious)
- #196 still open: ghost toggle aria-label double announcement
- #197 still open: BulkActionBar focuses destructive action instead of Cancel

## What's next

- #201 (Aria) — heading hierarchy fix, serious a11y, quick Aria session
- #134 (Spark) — Streaming shimmer wrong color for 4 models
- #186 (Scout/Forge) — Coverage report absent in CI
- #193 (Luma) — Markdown token layer (text-link, code-bg, prose colors)
- #200 (Aria) — New-tab sr-only announcement (quick, batch with next Aria session)

Good next wave: batch #201 + #200 into one Aria session (both small, one Ada audit).

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
  (exception: backend's `npm test` maps to `vitest run` directly — documented in ci.yml)
- `bg-bg` = surface background token; `bg-bg-surface` is NOT a registered token (generates no CSS)
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before final test run
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials must close+reopen panel
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper
- Settings drawer has focus trap (#116) — keyboard tests must account for Tab interception
- Context menu confirm-delete state moves focus to Cancel on open
- `semantic.error` = foreground text color; `semantic.error-bg` = destructive button background. Never `bg-error text-white`.
- Sidebar.management.test.ts has 7 test.skip stubs with false comment — real coverage in sidebar-state-machines.test.tsx (#139)
- `--sidebar-width` CSS var on `:root` is the sidebar width source of truth — set by Sidebar.tsx useEffect
- Parallel agent worktrees share the git object store; branch checkouts in a worktree can affect main workspace reflog — always verify HEAD after merging worktree branches
- Ghost mode toggle visual state = `isGlobalGhostMode` (global), not `isGhost` (per-conversation) — don't confuse the two
- react-markdown re-parses on every render chunk — no debounce applied; fast enough in practice
- Markdown link color = `text-text-primary underline` (interim); swap to `text-link` token when Luma #193 ships
