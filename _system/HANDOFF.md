Last updated: 2026-06-16 (ship #125)

## Current phase

Phase 4+ — Custom provider infrastructure complete. Full gate process now active.

## Session summary

- #125 (Aria): Fix context menu backdrop z-index bug on mobile sidebar
  - Root cause: `<li class="thread-entering">` retains a GPU compositing layer while the `animation` property is present, even after the keyframe animation ends at `transform: none`. This layer becomes a containing block for `position: fixed` descendants, clipping the backdrop to the row height instead of the full sidebar.
  - Fix: `AnimatedListItem` React component wraps every thread row `<li>`. Applies `thread-entering` on mount, removes it via `onAnimationEnd`. Without the `animation` property, no GPU layer is retained.
  - Also created GitHub issues #126–#194 from the 2026-06-15 all-hands audit.

## Key decisions

- `semantic.error` and `semantic.error-bg` are intentionally split. `semantic.error` is a bright foreground text color; `semantic.error-bg` is the dark-red variant for button backgrounds with white text. NEVER use `bg-error text-white` — use `bg-error-bg text-white` for destructive buttons.
- Co-located unit tests in domain directories (`/src/storage/*.test.ts`) are established practice and consistent with the existing `LocalStorageProvider.test.ts` / `ServerStorageProvider.test.ts` pattern.
- `position: fixed` backdrop for ThreadActionMenu must stay INSIDE the sidebar's stacking context (not portaled to document.body) — the mobile sidebar is `position: fixed; z-index: 50` and forms an opaque stacking context; a portaled backdrop at z-30 in page context sits below it.

## Open issues

None. Queue is clear — see #126–#194 for the full audit backlog.

## What's next

No open issues — queue is clear. Await new issue from user.

## Gotchas

- CI uses `npm run test:run` (vitest run) — `npm test` is watch mode and hangs the runner
- Worktrees cause Vitest to discover test files twice — always `git worktree remove --force` before the final test run; also clears stale path references that cause loadAndTransform noise (fixed by #123)
- `models` re-derives on panel CLOSE only — mid-panel mutations not reflected until close, by design
- `addCustomProvider()` returns config with generated `credentialKey` — credential save is non-atomic; if it fails, roster entry exists but has no key
- userEvent v14 deadlocks with vi.useFakeTimers() — use fireEvent + vi.advanceTimersByTime() instead
- E2E: ProviderRow badgeState initializes once on mount — tests pre-seeding credentials via localStorage must close+reopen the panel to remount the row
- Smoke tests seed a minimal Claude roster via `seedMinimalRoster()` helper — required so real model selector trigger renders (empty-roster button has same aria-controls but opens provider settings, not model selector)
- Settings drawer has focus trap (#116) — keyboard tests that open the drawer must account for Tab being intercepted
- Context menu confirm-delete state moves focus to Cancel on open — tests that interact with confirm-delete must account for this
- GPU compositing layers: browsers may keep a compositing layer alive on any element with an active `animation` property. This layer acts as a containing block for `position: fixed` descendants — even if the final keyframe value is `transform: none`. Remove the `animation` class entirely (not just override the transform) to eliminate the layer. Fixed via `AnimatedListItem` in #125.
