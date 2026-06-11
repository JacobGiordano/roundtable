Last updated: 2026-06-11 (end of session — mobile layout)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets wired. Mobile layout complete.

## Last closed

- #68 (Aria): brand assets wired into live app — fonts, brand-tokens.css, favicon, logo in header.
- #71 (Aria): mobile layout — sidebar drawer, mobile header, safe-area inset, touch targets.

## Decisions made this session (#71)

- Sidebar: fixed drawer on mobile (w-72/288px, translate-based show/hide), static on desktop.
  inline-style width guarded by isMobileViewport.current ref to avoid specificity conflict with w-72.
- AppLayout: isMobileMenuOpen state, mobile header (hamburger + logo + new-convo), backdrop overlay.
- InputBar: safe-area-inset-bottom via inline style (env() — no Tailwind pb-safe needed).
  Send button expanded to min-w/min-h 44px for touch target compliance.
- ModelSelectorPanel: pills row changed from flex-wrap to flex-nowrap + overflow-x-auto.
  ModelPill and AddModelButton outer divs get flex-shrink-0. Panel body gets max-h-[70vh] overflow-y-auto.
- isMobileViewport.current checked once at mount (not reactive) — CSS md: classes handle
  the visual switch; React doesn't need to re-render on resize.

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
- Mobile sidebar drawer: isMobileViewport.current is only checked once at mount.
  If a user resizes from mobile to desktop without reloading, the inline-style guard stays
  in mobile mode (no inline width). This is acceptable — mobile users don't resize.

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

No open issues known. Await user direction for next work.
