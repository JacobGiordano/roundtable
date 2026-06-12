Last updated: 2026-06-12 (#76 + #77 complete — branch 76-77-aria-gear-favicon, pending merge)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete.

## Last closed

- #76 (Aria): Two gear-button bugs fixed.
  (1) Mobile gear now fires handleOpenMobileMenu + conditional handleToggleSettings — drawer
      opens and settings panel is visible. Previously settings opened inside a closed drawer.
  (2) Gear removed from desktop sidebar header — was confusingly adjacent to the + button.
      Bottom settings toggle remains the desktop entry point. smoke test selector unchanged.
- #77 (Aria): favicon.svg updated to R1 geometry. Removed flat-top hexagon polygon.
  Added ring (circle r=14, icon-mark CSS class for stroke), six seat dots at hexagonal
  vertex positions (r=3, icon-mark-fill), center dot r=3.5 (icon-mark-fill).
  prefers-color-scheme media query and all CSS class theming preserved.

## Decisions made this session

- Mobile gear onClick: `() => { handleOpenMobileMenu(); if (!isSettingsOpen) handleToggleSettings(); }`
  Guard prevents double-toggle if settings is already open when gear is clicked.
- Desktop sidebar header: gear button removed entirely. The bottom "Settings" toggle row
  (aria-controls="sidebar-settings-panel") is the canonical desktop entry point.
- favicon.svg `.icon-mark` CSS rule updated: `fill: none` (was `fill: #FFFFFF`) so the ring
  renders as a stroke-only circle. icon-mark-fill continues to handle filled dots.

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — wired at boot and
  in handleThemeChange in Sidebar.tsx
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

- #72 (Aria): Accent color picker pre-selects model's current color
- Dev/staging branch workflow: Arch ticket to formalize in CLAUDE.md
