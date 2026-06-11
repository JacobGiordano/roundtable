Last updated: 2026-06-11 (end of session — Aria a11y queue complete)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Closed this session (all merged to main)

- Ada: removed 11 it.fails() wrappers from contrast.test.ts (B1–B5 themes × 3 surfaces).
  Updated THEMES snapshot to post-#58 values.
- #56 (Aria): SessionTokenSection toggle missing aria-controls. Panel switched to
  always-in-DOM with hidden={!isExpanded}.
- #51 (Aria): ThreadRow three-dot button invisible on keyboard focus. focus-visible classes.
- #52 (Aria): InputBar ghost mode not announced. sr-only aria-live="polite" span.
- #55 (Aria): pill-shake + streaming shimmers + ThreadSkeleton reduced-motion fixes.
- #57 (Aria): AddModelButton listbox/option → menu/menuitem.
- #49 (Aria): ModelSelectorPanel aria-hidden set too late. aria-hidden={!isOpen} (removed &&!isClosing).
- #50 (Aria): ThreadActionMenu full keyboard nav — ArrowDown/Up/Home/End/Escape/Tab, focus trap.
- #53 (Aria): AccentColorPicker focus-on-open (useLayoutEffect) + focus-restore-on-close.
- #54 (Aria): MessageThread polite live region for incoming messages; deduped vs #48 streaming region.

## Status

**Aria's a11y queue (#49–#57) is fully cleared.** Marque is now unblocked pending:
1. Ada: remove remaining it.fails() wrappers for #59/#60 contrast tests (both Luma fixes on main)
2. Open a GitHub issue for the branding pass → activate Marque

## Decisions made this session

- aria-controls: collapsible panels must always be in the DOM (hidden attr, not conditional render).
- Live regions must be mounted before first state change fires (sr-only, always-present).
- AddModelButton items are actions → menu/menuitem, not listbox/option.
- prefers-reduced-motion: streaming shimmers have per-model selectors — must override each one.
- aria-hidden must update synchronously with isOpen, not after animation completes.
- ARIA menu keyboard: tabIndex={-1} on all menuitems; arrow keys only; Tab/Escape close+return focus.
- AccentColorPicker: useLayoutEffect (not useEffect) for focus-on-open — prevents Tab escape gap.
- MessageThread live region: track everStreamedIds to prevent double-announcement with #48.

## Model providers (all on main)

| Model | Default active | Accent token | providerName | Default version |
|-------|---------------|--------------|--------------|-----------------|
| Claude | yes | accent-claude | Anthropic | claude-sonnet-4-6 |
| GPT-5.5 | yes | accent-gpt | OpenAI | gpt-5.5 |
| Gemini | no | accent-gemini | Google | gemini-2.5-flash |
| Grok | no | accent-grok | xAI | grok-3 |
| DeepSeek | no | accent-deepseek | DeepSeek | deepseek-chat |
| Mistral | no | accent-mistral | Mistral | mistral-large-latest |

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

## Brand work (next phase)

Marque (brand agent, he/him) is drafted in .claude/agents/marque.md.
Aria's a11y queue is now clear — open a GitHub issue for the branding pass and activate Marque.

## Next issues in priority order

1. Ada: remove it.fails() wrappers for #59/#60 in contrast.test.ts (Luma fixes already on main)
2. Open branding issue → activate Marque
