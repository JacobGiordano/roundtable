Last updated: 2026-06-11 (layout scroll fixes — #71)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets wired and corrected. Mobile layout complete.

## Last closed

- #71 (Aria): Two layout bugs fixed.
  1. InteractionModeSwitcher: removed overflow-x-auto wrapper; radiogroup now flex w-full;
     each ModeButton outer div gets flex-1 min-w-0; button gets w-full + truncate.
     Buttons share width equally instead of scrolling horizontally.
  2. ModelSelectorPanel: .model-selector-panel.is-open max-height changed from 320px
     to 70vh in src/index.css, matching the inner content div's max-h-[70vh].
     Panel content is now scrollable instead of being cut off.

## Decisions made this session

- InteractionModeSwitcher uses flex w-full layout (not inline-flex in scroll wrapper).
  The outer AppLayout wrapper already has min-w-0 from #70 — untouched.
- ModelSelectorPanel outer animation cap is 70vh to match inner scroll div.
  The overflow: hidden on .model-selector-panel itself is preserved for animation.
- Button labels use truncate instead of whitespace-nowrap so they gracefully clip
  rather than overflow at very narrow widths.

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
