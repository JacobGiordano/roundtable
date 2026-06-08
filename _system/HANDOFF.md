Last updated: 2026-06-08

## Current phase

Phase 1 — scaffold complete, implementation not yet started.

## Active agent for next session

**Next: activate agents in this order:**
1. Aria — Chat interface layout (#3)
2. Gate — API key management (#10)
3. Atlas — Claude integration (#5)
4. Vault — LocalStorage provider (#8)

## Last issue closed

Issue #2 — [Coda] Project scaffold. Created package.json (React 18, TypeScript 5, Vite 5, Tailwind v3, Vitest, ESLint v9), vite.config.ts with `@/` alias, tsconfig.json (strict), postcss.config.js, tailwind.config.js, index.html, src/main.tsx, src/App.tsx, src/index.css, placeholder index.ts per agent directory, .github/workflows/ci.yml, and .env.example. Merged to main.

## Decisions this session

- ESLint v9 flat config (`eslint.config.js`) — matches Vite 5 default
- Tailwind v3 (not v4) per CLAUDE.md
- `@/` alias wired in both vite.config.ts and tsconfig.json paths
- Placeholder `index.ts` files created in /src/ui, /src/models, /src/storage, /src/auth — no implementation
- `src/main.tsx` + `src/App.tsx` are minimal shells; Aria will replace App content

## Next issues (priority order)

1. [Aria] Chat interface layout (#3)
2. [Aria] Model selector (#4)
3. [Gate] API key management (#10)
4. [Gate] #30
5. [Atlas] Claude integration (#5)
6. [Atlas] GPT integration (#6)
7. [Atlas] #7
8. [Vault] LocalStorage provider (#8)
9. [Vault] #9

## Cross-agent dependencies (unresolved)

1. **Atlas**: What happens when a model is deactivated mid-stream? Needs Atlas confirmation before Aria implements.
2. **Atlas**: Must expose a streaming state flag for Aria (disable send while streaming).
3. **Atlas**: Must expose a retry method for Aria (error state bubble retry button).
4. **Gate**: Must expose ghost mode state for Aria (input bar indicator).

## Gotchas

- Arch owns `/src/types/index.ts` and `CLAUDE.md` — no other agent touches these files
- Single-PR rule for types: all changes to `/src/types/index.ts` ship in one PR at a time
- Aria must NOT make design decisions — all values come from `/_design` specs
- Outrun shadow values use rgba neon glow — Aria must not flatten them to a standard drop shadow
- API keys: never log, never export, never transmit except to the provider's own API
- `src/App.tsx` is a scaffold placeholder — Aria owns the final layout, not this file
