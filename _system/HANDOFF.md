Last updated: 2026-06-08

## Current phase

Phase 1 — LocalStorage provider complete.

## Active agent for next session

**Next: activate agents in this order:**
1. Gate — API key management (#10)
2. Atlas — Claude integration (#5)

## Last issue closed

Issue #30 — [Gate] Theme storage. Implemented `getThemePreference()`,
`saveThemePreference()`, `setActiveTheme()`, and `clearThemePreference()` in
`src/auth/theme.ts`. All functions build on `ThemeId` / `ThemePreferences` from
`/src/types/index.ts` (no types changes required). Storage key is
`roundtable:theme`. Corrupt/missing stored values fall back to `slate` silently.
Exported from `src/auth/index.ts`. lint + build pass.

## Decisions this session

- Storage key: `roundtable:theme` (JSON-serialised ThemePreferences object)
- Default fallback theme: `slate` (matches the theme already applied at startup in main.tsx)
- `isThemeId()` guard validates stored value against the exact ThemeId union — corrupt entries fall back to default, no throw
- `setActiveTheme()` convenience helper merges new ThemeId with existing customTheme, avoiding accidental erasure
- `clearThemePreference()` is a full reset helper for dev/testing

## Cross-agent dependencies (unresolved — carry forward)

1. **Atlas**: Streaming state flag — Aria reads `isStreaming` prop; Atlas must supply via context
2. **Atlas**: Retry method — Aria renders Retry button with `onRetry` callback; Atlas wires re-request
3. **Atlas**: Mid-stream model deactivation — stream completes, then model goes inactive
4. **Gate**: Ghost mode state — Aria reads `isGhostMode` prop; Gate wires toggle

## Next issues (priority order)

1. [Gate] API key management (#10)
2. [Atlas] Claude integration (#5)
3. [Atlas] GPT integration (#6)
4. [Atlas] #7
5. [Vault] #9
6. [Aria] Model selector (#4) — unblocked after Gate and Atlas land

## Gotchas

- Arch owns `/src/types/index.ts` and `CLAUDE.md` — no other agent touches these
- Single-PR rule for types
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- `src/ui/index.ts` now exports all Phase 1 components
- Markdown rendering inside MessageBubble is deferred — plain text with whitespace-pre-wrap
- `LocalStorageProvider` is exported from `src/storage/index.ts` — ready for Aria/Gate to consume via React context
- `getThemePreference()` / `saveThemePreference()` are exported from `src/auth/index.ts` — Aria can wire these to a theme context/toggle
