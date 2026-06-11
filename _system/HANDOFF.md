Last updated: 2026-06-11 (#75 Scout — Playwright smoke tests)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets updated to R1 mark.

## Last closed

- #75 (Scout): Playwright wired. @playwright/test@1.60.0 installed.
  playwright.config.ts at project root, baseURL http://localhost:5173, Chromium only.
  src/tests/e2e/smoke.spec.ts — 10 tests across desktop (1280×800) and mobile
  (375×812): JS errors, logo mark, model selector open/close, settings open/close,
  new conversation button, mobile layout overflow, mobile drawer open/close.
  vite.config.ts exclude added so Vitest ignores tests/e2e/**. Vitest: 441 pass.
  BLOCKER: Chromium binary not installed — playwright.download.prss.microsoft.com
  is not on the container firewall allowlist. Tests will fail with "Executable
  doesn't exist" until Chromium is installed. Fix: add domain to init-firewall.sh
  and restart container, then run `npx playwright install --with-deps chromium`.

## Decisions made this session

- Playwright webServer auto-start intentionally NOT configured. Dev server must
  be running (`npm run dev`) before `npm run test:e2e`.
- e2e tests excluded from Vitest via `exclude: ['**/tests/e2e/**']` in vite.config.ts.
- Playwright tests live in src/tests/e2e/ per the acceptance criteria.

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
- main.tsx hardcodes slateTheme at boot — getThemePreference() not called (#73)
- Playwright Chromium: container firewall blocks playwright.download.prss.microsoft.com.
  Run `npx playwright install --with-deps chromium` outside container or update firewall.

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

- UNBLOCK #75: add playwright.download.prss.microsoft.com to firewall, install Chromium, run smoke tests
- #73 (Aria): Theme switcher in settings + fix main.tsx boot to read saved preference
- #74 (Aria): Settings access point / user icon in app chrome
- #72 (Aria): Accent color picker pre-selects model's current color
- Dev/staging branch workflow: Arch ticket to formalize in CLAUDE.md
- Branch/worktree pruning: clean up stale branches and worktrees
