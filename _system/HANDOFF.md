Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed (wave 1 — all awaiting merge authorization)

- #46 (Aria): MessageBubble Reply button a11y fix. Removed aria-hidden from bottom row
  container; added focus-within:opacity-100. Token count div gets aria-hidden={!rowVisible}.
- #58 (Luma): text-muted contrast fixed in 5 themes (Slate, Linen, Ash, Ember, Chalk).
  Minimal per-theme adjustments; each theme file has _a11y annotation with ratios.
  Ada should remove it.fails() wrappers from B1–B5 in contrast.test.ts.
- #64 (Scout): @testing-library/react 16.3.2, @testing-library/user-event 14.6.1,
  jsdom 29.1.1, @axe-core/react 4.11.3, vitest-axe 0.1.0 installed. Vitest config
  updated to jsdom environment. 415 tests passing, 0 failures.
- Arch: Marque added to CLAUDE.md routing table and boundary rules.
- Quill: Marque added to CONTRIBUTING.md ownership and agent profiles tables.

## In progress

None — all wave 1 work complete, awaiting merge authorization.

## Decisions made this session

- Aria: aria-hidden must never wrap interactive controls. focus-within drives keyboard
  visibility; hover behavior unchanged.
- Luma: Ada's suggested Ember (#967A68) and Chalk (#6E6E6E) values were 1 step short —
  used #987C6A and #6D6D6D respectively. Exact rationale in _a11y annotations.
- Scout: jsdom environment set in vite.config.ts test block, not a separate vitest.config.ts.
- Arch: cross-agent comms paragraph in CLAUDE.md unchanged — Marque/Luma is a design-asset
  handoff, not a runtime interface.
- New agent SOP: Agency Agents repo format as base, expanded with Roundtable-specific sections.
  marque.md is the reference implementation.
- Gender rotation: M → NB → F → M → NB → F → ... Next after Marque: NB (they/them).

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
- accent-deepseek in Slate and Ash is a serious text contrast failure — Luma fix tracked in #60
- npm audit reports 4 pre-existing vulns (3 moderate, 1 critical) in esbuild/vite chain —
  fix requires Vite v8 upgrade (breaking change), not in current scope

## Brand work (post-a11y)

Marque (brand agent, he/him) is drafted in .claude/agents/marque.md.
Open a GitHub issue for the branding pass before activating him.
Do not activate Marque until Aria's a11y fixes are complete.

## Next issues in priority order (wave 2)

1. Aria: #47 — ModelSelectorPanel aria-controls id mismatch
2. Luma: #60 — accent-deepseek/gemini text contrast (Slate and Ash most severe)
   [run in parallel ↑]
3. Luma: #59 — error color contrast on card surface (Slate and Ash)
4. Aria: #48 — MessageBubble streaming state not announced to screen readers
5. Aria: #49–#57 — remaining a11y issues (one per session)
6. Open branding issue → activate Marque
