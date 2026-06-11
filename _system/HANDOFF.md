Last updated: 2026-06-11 (#74 complete — branch 74-aria-settings-access, pending merge)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete.

## Last closed

- #74 (Aria): Settings access point in app chrome. Gear icon button added to:
  (1) desktop sidebar header (right of logo, left of new-conversation button),
  (2) mobile top bar header (left of new-conversation button).
  isSettingsOpen state lifted from Sidebar to AppLayout and threaded via props.
  Sidebar bottom toggle kept intact — smoke test selector unchanged.

## Decisions made this session

- isSettingsOpen lifted to AppLayout; Sidebar accepts optional isSettingsOpen/onToggleSettings
  props for external control, falls back to internal state when not provided.
- Sidebar uses a ref+effect to refresh hasAccentOverrides when the panel opens via
  external control (previously only done in the internal toggle handler).
- Desktop gear: text-text-muted (quieter than the new-conv button) — visually subordinate.
- Mobile gear: text-text-secondary — matches other mobile header buttons.
- Sidebar bottom toggle (button[aria-controls="sidebar-settings-panel"]) kept intact
  to preserve smoke test selector; bottom toggle now delegates to handleToggleSettings
  which routes to external control when AppLayout provides it.

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
