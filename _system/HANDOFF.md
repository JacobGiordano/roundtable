Last updated: 2026-06-08

## Current phase

Pre-Phase 1 — design system complete, project scaffold not yet started.

## Active agent for next session

Frontend Developer (Aria) — issue #3 (chat interface layout) and issue #4 (model selector) are now unblocked. Aria implements from `/_design` specs.

## Last issue closed

Issue #28 — Luma design system. Complete. Branch: `28-luma-design-system` (not yet merged — awaiting user authorization).

## Decisions made this session

- 7 themes defined: Slate (dark), Linen (light), Midnight (dark), Ash (dark), Ember (dark), Chalk (light), Outrun (dark)
- All text-on-background pairings verified WCAG AA. `text.muted` values were adjusted upward in Slate, Midnight, Ash, Ember, and Outrun to clear 4.5:1 minimum. All pass.
- Outrun neon borders (`borders.default` #FF00AA, `borders.strong` #00FFFF) are decorative — exempted from text contrast requirements. Explicitly documented in contrast audit.
- Model identity colors: Claude = amber, GPT = teal, Gemini = purple, Other = coral. Consistent family across all themes; exact values shift per theme but remain recognizable.
- Send button accent is `accents.model-claude` (amber) across all themes. Deliberate choice documented in components.md.
- Model selector is a slide-up panel above input bar, not a sidebar. Rationale documented in components.md.
- Sidebar width fixed at 256px for Phase 1. No resize.
- Thread title default: first 40 chars of first user message.
- Timestamp format specified: relative time with defined breakpoints (min/hour/day/date).

## Cross-agent dependencies flagged (unresolved)

1. **Atlas**: What happens when a model is deactivated mid-stream? Luma's lean: stream completes, then model goes inactive. Needs Atlas confirmation before Aria implements the edge case.
2. **Atlas**: Must expose a streaming state flag for Aria (to disable send while streaming).
3. **Atlas**: Must expose a retry method for Aria (for error state bubble retry button).
4. **Gate**: Must expose ghost mode state for Aria (input bar indicator).

## Next issues (in order)

1. Project scaffold and directory structure (blocked on types/interfaces — already done in #0)
2. [Aria] Chat interface layout (#3) — unblocked, reads `/_design` specs
3. [Aria] Model selector (#4) — unblocked, reads `/_design` specs
4. [Atlas] Claude integration — unblocked
5. [Atlas] GPT-5.5 integration — unblocked
6. [Vault] LocalStorage provider — unblocked
7. [Gate] API key management — unblocked

## Gotchas

- `/src/types/index.ts` changes require review from all active agents — never modify unilaterally
- Aria must NOT make design decisions — all values come from `/_design` specs. If something is missing, Luma adds it.
- Outrun shadow values use rgba neon glow — Aria must not flatten them to a standard drop shadow
- `rounded-sm/md/lg` and `shadow-sm/md/lg` must be overridden in `tailwind.config.js` to use token values
- Run all npm commands from project root, not from `src/`
- API keys: never log, never export, never transmit except to the provider's own API
