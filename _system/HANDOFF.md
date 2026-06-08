Last updated: 2026-06-08

## Current phase

Pre-Phase 1 — design system complete, project scaffold not yet started.

## Active agent for next session

**Next: scaffold the project.** Once scaffold is in place, activate agents in this order:
1. Aria — Chat interface layout (#3)
2. Gate — API key management (#10)
3. Atlas — Claude integration (#5)
4. Vault — LocalStorage provider (#8)

## Last issue closed

Issue #29 — [Arch] Bootstrap `/src/types/index.ts`. Added `ThemeId`, `CustomThemeJSON`, and `ThemePreferences` types alongside the full initial type contract. Merged to main.

## Decisions this session

- `ThemeId` is a string union of all 7 built-in identifiers: `slate | linen | midnight | ash | ember | chalk | outrun`
- `CustomThemeJSON` maps the full Luma token schema to TypeScript — all fields required, `shadow.none` typed as literal `'none'`
- `ThemePreferences` is `{ activeThemeId: ThemeId; customTheme?: CustomThemeJSON }` — Gate stores it, Aria reads it
- No lint/build check possible yet (no scaffold); types validated with standalone `tsc --noEmit --strict`

## Next issues (priority order)

1. Scaffold the project (Vite + React + TypeScript + Tailwind) — no open issue yet, needs creation
2. [Aria] Chat interface layout (#3)
3. [Aria] Model selector (#4)
4. [Gate] API key management (#10)
5. [Gate] #30
6. [Atlas] Claude integration (#5)
7. [Atlas] GPT integration (#6)
8. [Atlas] #7
9. [Vault] LocalStorage provider (#8)
10. [Vault] #9

## Cross-agent dependencies (unresolved)

1. **Atlas**: What happens when a model is deactivated mid-stream? Needs Atlas confirmation before Aria implements.
2. **Atlas**: Must expose a streaming state flag for Aria (disable send while streaming).
3. **Atlas**: Must expose a retry method for Aria (error state bubble retry button).
4. **Gate**: Must expose ghost mode state for Aria (input bar indicator).

## Gotchas

- No `package.json` yet — project scaffold is the next blocker before any agent can run lint/build
- Arch owns `/src/types/index.ts` and `CLAUDE.md` — no other agent touches these files
- Single-PR rule for types: all changes to `/src/types/index.ts` ship in one PR at a time
- Aria must NOT make design decisions — all values come from `/_design` specs
- Outrun shadow values use rgba neon glow — Aria must not flatten them to a standard drop shadow
- API keys: never log, never export, never transmit except to the provider's own API
