Last updated: 2026-06-11 (Marque — #69, R1 logo mark adopted)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets updated to R1 mark.

## Last closed

- #69 (Marque): R1 logo mark adopted. Hexagon retired. All five logo SVGs updated:
  symbol.svg, primary.svg, primary-stacked.svg, mono-light.svg, mono-dark.svg.
  identity.md updated: The Mark section rewritten for R1 geometry, forbidden-uses rule 7
  updated (rotation prohibition removed — mark is rotationally symmetric), hexagon
  references purged throughout. logo-exploration.md committed from stale worktree with
  Decision section added. No palette, token, or typeface changes.

## Decisions made this session

- R1 geometry (authoritative): outer circle r=22 #2D2B55, ring r=14 stroke-width=2 white,
  six seat dots r=3 white at (24,10)(36.12,17)(36.12,31)(24,38)(11.88,31)(11.88,17),
  center dot r=3.5 white.
- mono-light.svg (dark mark on light surface): currentColor on outer circle + #FFFFFF on
  ring/dots. No mask needed — R1 uses only additive geometry.
- mono-dark.svg (light mark on dark surface): currentColor on outer circle + #2D2B55 on
  ring/dots. No mask needed.

## Next issues in priority order

- Aria: update RoundtableLogo.tsx (or equivalent React component in /src/ui/) to match
  R1 SVG geometry — replace hexagon polygon with ring circle + six seat dot circles +
  center dot. See symbol.svg for exact geometry. May be in flight in parallel.
- Dev/staging branch workflow: open Arch ticket to formalize in CLAUDE.md.
- Branch/worktree pruning: large number of stale branches and worktrees to clean up.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with ModelId union
- VALID_MODEL_IDS also in /src/auth/modelVersion.ts — update both when adding models
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Gemini model string is now in the URL path via buildGeminiUrl() — not a body field
- Adding new models: update MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry
- npm audit reports 4 pre-existing vulns (3 moderate, 1 critical) in esbuild/vite chain —
  fix requires Vite v8 upgrade (breaking change), not in current scope
- vitest-axe axe-core assertion pattern: use assertNoViolations(results) helper
- aria-controls: panels must always be in DOM (hidden attr, not conditional render)
- prefers-reduced-motion: streaming shimmers use per-model selectors — must override each
- brand-tokens.css uses [data-mode] attribute set by applyTheme() — brand logo color only
  works correctly once applyTheme() has run (which happens before first render in main.tsx)
- SIDEBAR_WIDTH_MIN is 278; Aria's drag UI must enforce this same floor
- Mobile sidebar: isMobileViewport.current only checked at mount. Resize mobile→desktop
  without reload leaves inline-style guard in mobile mode. Acceptable.
- Tailwind: `relative` and `fixed` conflict (relative comes later in stylesheet). Always
  scope `relative` to `md:relative` on elements that use `fixed` for mobile positioning.

## Model providers (all on main)

| Model | Default active | Accent token | providerName | Default version |
|-------|---------------|--------------|--------------|-----------------|
| Claude | yes | accent-claude | Anthropic | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | OpenAI | gpt-5.5 |
| Gemini | no | accent-gemini | Google | gemini-2.5-flash |
| Grok | no | accent-grok | xAI | grok-3 |
| DeepSeek | no | accent-deepseek | DeepSeek | deepseek-chat |
| Mistral | no | accent-mistral | Mistral | mistral-large-latest |
