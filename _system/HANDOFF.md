Last updated: 2026-06-10

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed

- #58 (Luma): text.muted contrast failures — 5 themes fixed (Slate, Linen, Ash, Ember, Chalk).
  All 15 text/surface pairs now pass WCAG AA 4.5:1. Contrast ratios documented in _a11y
  blocks inside each theme JSON. Ada: remove it.fails() wrappers in contrast.test.ts for B1–B5.

## In progress

None.

## Decisions made this session

- Luma: text.muted adjustments were minimal — closest passing value to original for each theme.
  Slate: #7A82A0 → #7C84A2. Linen: #7A7570 → #6D6863. Ash: #7A848D → #838D96.
  Ember: #8C7260 → #987C6A. Chalk: #737373 → #6D6D6D.
- _a11y annotation blocks added to each affected theme JSON for Ada verification.
  These are doc-only fields — no runtime impact.

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
- React hook layer (useConversationStore, useGhostMode) needs @testing-library/react
  + jsdom before it can be integration-tested; neither is in devDependencies.
- accent-deepseek in Slate and Ash is a serious text contrast failure — Luma fix tracked in #60

## Agent SOP update

New agents must be based on the Agency Agents repo (https://github.com/msitarzewski/agency-agents)
format, then expanded with Roundtable-specific Ownership & Boundaries, Session Start Checklist,
Persona, and Operating Authority sections. See crest.md as the reference implementation.

Gender rotation going forward: M → NB → F → M → NB → F → ...
Next new agent after Marque: NB (they/them).

## Pending: CLAUDE.md update (Arch required)

Marque needs to be added to the agent table and boundary rules in CLAUDE.md.
Activate Arch for this — Marque's entry:
- Owns: `/_design/brand/`
- Must never touch: `/src/**`, `/_design/tokens/`, `/_design/themes/`, `/_design/specs/`

## Brand work (post-a11y)

Marque (brand agent, he/him) is drafted in .claude/agents/crest.md.
Open a GitHub issue for the branding pass before activating him.
Do not activate Marque until Aria's a11y fixes are complete.

## Next issues in priority order

1. Install @testing-library/react + jsdom — unblocks Scout hook tests + Ada axe-core tests
2. Aria: fix A1 (MessageBubble Reply button aria-hidden — #46) — blocks keyboard users
3. Aria: fix A2 (ModelSelectorPanel aria-controls id mismatch — #47)
4. Luma: fix error color contrast on card surface (#59) — Slate and Ash
5. Luma: fix accent-deepseek/gemini text contrast failures (#60) — Slate and Ash most severe
6. Aria: remaining a11y issues #48–#57
7. Arch: add Marque to CLAUDE.md agent table and boundary rules
8. Marque: branding pass (logo, icon, favicon, palette, typography) — open issue first
