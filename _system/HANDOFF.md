Last updated: 2026-06-11 (hexagon geometry fix + #70 overflow bugs)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets wired and corrected. Mobile layout complete.

## Last closed

- #70 (Aria): InteractionModeSwitcher overflow bugs fixed — label viewport overflow + tooltip clipping.
- Logo (no issue): hexagon polygon geometry corrected to proper flat-top orientation across all SVG files and RoundtableLogo.tsx. Previous geometry mixed pointy-top and flat-top vertices, producing a razor-blade shape.

## Decisions made this session

- Overflow fix: outer scrollable wrapper (overflow-x-auto) inside InteractionModeSwitcher;
  AppLayout wrapper changed from flex-shrink-0 to min-w-0.
- Tooltip fix: TooltipAlign ('left' | 'center' | 'right') on ModeButton. First item left-aligns,
  middle centers, last item (Auto-chain) right-aligns. Caret tracks anchor.
- Hexagon fix: correct flat-top vertices are 38,24 31,36.12 17,36.12 10,24 17,11.88 31,11.88
  (60° intervals from 0°). Wrong vertices (cos(30°) math) corrected in all 7 SVG files + TSX.
- Logo exploration doc produced by Marque at /_design/brand/logo-exploration.md (worktree, not merged).
  Recommendation: pointy-top hexagon (Option 2). Awaiting user direction before implementing.

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

## Next issues in priority order

- Logo mark direction: user to decide between Option 2 (pointy-top hex) or other from exploration doc.
  Once decided, open ticket for Marque + Aria to implement.
- Dev/staging branch workflow: open Arch ticket to formalize in CLAUDE.md (agents branch from main,
  merge to dev for preview, merge feature branch to main to ship).
- Branch/worktree pruning: large number of stale branches and worktrees to clean up.
