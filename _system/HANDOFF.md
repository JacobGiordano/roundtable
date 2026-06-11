Last updated: 2026-06-11 (end of session — #69 logo fix, #70 sidebar min-width, #71 mobile layout)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete. Brand assets wired and corrected. Mobile layout complete.

## Last closed

- #70 (Gate): raised SIDEBAR_WIDTH_MIN from 180 to 278 — prevents TokenCountControl
  wrapping at narrow sidebar widths.
- #69 (Aria): logo symbol rendering corrected — removed CSS mask approach, now renders
  solid Indigo circle (`--brand-primary`) with white hexagon stroke and white center dot
  per Marque's identity spec.
- #71 (Aria): mobile layout — sidebar drawer, mobile header, safe-area inset, touch targets.
  Post-merge fixes: `relative` → `md:relative` (freed chat area width), × close button
  in drawer header.

## Decisions made this session

- SIDEBAR_WIDTH_MIN: 278px — just below SIDEBAR_WIDTH_DEFAULT (280) so default remains valid.
- Logo: dropped SVG mask; three flat paint layers. `--brand-primary` drives circle fill;
  `--brand-logo-color` drives wordmark only.
- Mobile sidebar: fixed drawer on mobile (w-72/288px, translate-based show/hide), static on
  desktop. Inline-style width guarded by `isMobileViewport.current` ref to avoid specificity
  conflict with Tailwind `w-72`.
- AppLayout: `isMobileMenuOpen` state, mobile header (hamburger + logo + new-convo), backdrop.
- InputBar: safe-area-inset-bottom via inline style (env()). Send button min 44×44px tap target.
- ModelSelectorPanel: pills row flex-nowrap + overflow-x-auto. Panel body max-h-[70vh].
- Sidebar header on mobile: × (close drawer); on desktop: + (new conversation).

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

No open issues known. Await user direction for next work.
