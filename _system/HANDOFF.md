Last updated: 2026-06-11 (post #54)

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Recently merged (this session)

- #54 (Aria): MessageThread live region for non-streaming message arrivals.
  Added aria-live="polite" sr-only div that announces "Author: [first 100 chars]"
  when a complete (non-streamed) message lands. Excludes messages that went through
  streamingMessages (those are handled by the assertive region from #48).

## Last closed (wave 3 — awaiting merge authorization)

- #57 (Aria): AddModelButton ARIA pattern corrected. listbox/option replaced with
  menu/menuitem; aria-haspopup="listbox" changed to aria-haspopup="menu";
  spurious aria-selected={false} removed from each item.
  File: /src/ui/ModelSelectorPanel.tsx, lines 290, 311, 324.

## In progress

Wave 2 remaining — #49, #50, #53 (Aria a11y issues).

## Decisions made this session

- #54: Two distinct live regions in MessageThread.
  Region 1 (assertive, #48): "[Model] responded" — fires on stream completion.
  Region 2 (polite, #54): "Author: [snippet]" — fires on non-streamed message arrival.
  Dedup via everStreamedIdsRef: any ID that ever appeared in streamingMessages is
  excluded from region 2 to prevent double-announcing.
- Ada: vitest-axe assertNoViolations helper pattern (not expect.extend). See prior sessions.
- aria-controls: collapsible panels must always be in the DOM (hidden attr, not conditional
  render) so aria-controls resolves at all times. Pattern: #47, #56.
- AddModelButton: items trigger actions (not selection) → menu/menuitem is correct ARIA.
- prefers-reduced-motion: streaming shimmers use per-model selectors — must override each.

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

## Brand work (post-a11y)

Marque (brand agent, he/him) is drafted in .claude/agents/marque.md.
Open a GitHub issue for the branding pass before activating him.
Do not activate Marque until Aria's a11y fixes are complete.

## Next issues in priority order

1. Aria: #49 — ModelSelectorPanel aria-hidden set too late during close animation
2. Aria: #50 — ThreadActionMenu no focus trap or arrow key navigation (most complex)
3. Aria: #53 — AccentColorPicker focus not moved into dialog on open
4. Ada: remove remaining it.fails() wrappers for #59/#60 in contrast.test.ts
5. Open branding issue → activate Marque
