Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed

- #45 (Ada): Phase 4 accessibility baseline audit. 147 new tests (contrast ratios
  + keyboard logic patterns). 13 contrast failures documented as it.fails() tests
  tracking real token issues. 23 findings: 0 critical, 9 serious/moderate UI
  findings (A1–A9), 11 contrast failures across 5 themes (B1–B13), 3 minor (C1–C3).
  15 GitHub issues opened (#46–#60 — 12 for Aria, 3 for Luma).

## In progress

None. All known branches merged.

## Decisions made this session

- a11y test files live in src/tests/a11y/{themes,keyboard,components,audit-reports}.
- Contrast tests use pure TypeScript math (no jsdom needed) — run in vitest baseline.
- Keyboard tests verify interaction logic contracts, not DOM rendering.
- Component axe-core tests blocked on @testing-library/react + jsdom installation
  (HANDOFF priority #1 — Scout's domain).
- it.fails() wrappers document known token failures; removal signals Luma fix merged.
- Accent colors (deepseek, gemini) used as text labels — 4.5:1 threshold applies
  (12px/11px are NOT large text per WCAG).

## Model providers (all on main)

| Model | Default active | Accent token | providerName |
|-------|---------------|--------------|--------------|
| Claude | yes | accent-claude | Anthropic |
| GPT-5.5 | yes | accent-gpt | OpenAI |
| Gemini | no | accent-gemini | Google |
| Grok | no | accent-grok | xAI |
| DeepSeek | no | accent-deepseek | DeepSeek |
| Mistral | no | accent-mistral | Mistral |

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- StorageConfig is NOT in types/index.ts — it's in @/storage/storageFactory.ts
- applyUserAccentColors must be called after EVERY applyTheme() — currently only wired at app load
- VALID_MODEL_IDS in /src/auth/accentColors.ts must stay in sync with ModelId union
- getActiveStorageProvider() is the App.tsx entry point for provider injection
- Backend uses ESLint 9 flat config (eslint.config.mjs) — not .eslintrc.json
- getSessionTokenUsage(), buildDefaultModelConfigs(), MODEL_REGISTRY from @/models — documented cross-agent exceptions for Aria
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props/hooks
- Gemini API key goes in URL as ?key= — Google REST API pattern, not a header
- Adding new models: update only MODEL_REGISTRY in /src/models/registry.ts — UI auto-updates
- /auth/refresh does NOT invalidate the previous token — both tokens valid until expiry
- React hook layer (useConversationStore, useGhostMode) needs @testing-library/react
  + jsdom before it can be integration-tested; neither is in devDependencies.
- accent-deepseek in Slate and Ash is a serious text contrast failure (3.32:1 and
  3.26:1 on card) — Luma fix tracked in gh issue #60.

## Next issues in priority order

1. #61 (Arch → Atlas + Gate → Aria): Model version selection per provider — Arch types first, then parallel Atlas/Gate, then Aria UI
2. #62 (Aria + Gate): Resizable sidebar — self-contained, can run anytime
3. Install @testing-library/react + jsdom so Scout can test React hook layer and Ada can run axe-core component tests (src/tests/a11y/components/)
4. Aria: fix A1 (MessageBubble Reply button aria-hidden — #46) — blocks keyboard users
5. Aria: fix A2 (ModelSelectorPanel aria-controls id mismatch — #47)
6. Luma: fix text-muted contrast failures (#58) — 5 themes affected
7. Luma: fix accent-deepseek text contrast failures (#60) — Slate and Ash most severe
8. Aria: remaining a11y issues #48–#57 (streaming live regions, focus management, etc.)
9. Regression test suite for known bugs as they are fixed.
