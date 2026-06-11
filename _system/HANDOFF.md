Last updated: 2026-06-11 (#73 + #75 closed)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete.

## Last closed

- #73 (Aria): Theme switcher in settings panel + boot fix. THEME_MAP and THEME_IDS
  added to /src/ui/theme.ts (shared by main.tsx and Sidebar.tsx). main.tsx now calls
  getThemePreference() at boot and applies the saved theme. Settings panel has a
  2-column theme grid (radiogroup/radio a11y) with dark/light mode swatch dots.
- #75 (Scout): Playwright wired. @playwright/test@1.60.0 installed. playwright.config.ts
  at project root, baseURL http://localhost:5173, Chromium only. 10 smoke tests across
  desktop (1280×800) and mobile (375×812). vite.config.ts updated to exclude tests/e2e/
  from Vitest. Firewall updated — playwright.download.prss.microsoft.com now in
  init-firewall.sh. To activate: restart container, then run
  `npx playwright install --with-deps chromium`.

## Decisions made this session

- THEME_MAP / THEME_IDS live in /src/ui/theme.ts to avoid circular import. Both
  main.tsx and Sidebar.tsx import from @/ui/theme.
- Theme switcher uses role="radiogroup" / role="radio" / aria-checked for a11y.
- Mode swatch: filled dot = dark theme, ring dot = light theme (from THEME_MAP[id].mode).
- Playwright webServer auto-start intentionally NOT configured — dev server must be
  running before npm run test:e2e.

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

- #74 (Aria): Settings access point / user icon in app chrome
- #72 (Aria): Accent color picker pre-selects model's current color
- Dev/staging branch workflow: Arch ticket to formalize in CLAUDE.md
