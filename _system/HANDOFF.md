Last updated: 2026-06-11

## Current phase

Phase 4 — Feature-complete. Open source launch prep complete. Doc audit complete.
Accessibility baseline audit complete.

## Last closed (wave 3 — awaiting merge authorization)

- #57 (Aria): AddModelButton ARIA pattern corrected. listbox/option replaced with
  menu/menuitem; aria-haspopup="listbox" changed to aria-haspopup="menu";
  spurious aria-selected={false} removed from each item.
  File: /src/ui/ModelSelectorPanel.tsx, lines 290, 311, 324.
- #50 (Aria): ThreadActionMenu focus trap and arrow key navigation.
  onKeyDown on role="menu" container handles Tab (close+return focus),
  Escape (close+return focus), ArrowDown/Up (wrap), Home/End.
  Focus moves to first menuitem on open (useEffect on menuState === 'menu').
  closeAndReturnFocus() via rAF returns focus to trigger button on close.
  tabIndex={-1} on all menuitems (arrow keys navigate, Tab does not).
  triggerRef (RefObject<HTMLButtonElement>) added to ThreadActionMenuProps and
  ThreadRow. File: /src/ui/Sidebar.tsx.

## In progress

Wave 2/3 running — #49, #53, #54 (Aria a11y issues).

## Decisions made this session

- aria-controls: collapsible panels must always be in the DOM (hidden attr, not
  conditional render) so aria-controls resolves at all times. Pattern: #47, #56.
- Aria (#52): live regions must always be mounted before first toggle fires.
- AddModelButton: items trigger actions (not selection) → menu/menuitem is correct ARIA.
- prefers-reduced-motion: streaming shimmers use per-model selectors — must override each.
- ThreadActionMenu keyboard: Tab closes menu per ARIA spec (menus not in tab order).
  Arrow keys navigate. Escape + Tab both return focus to trigger via rAF.
  Sub-states (confirm-delete, group-input) are dialog-like — Tab works normally in them;
  only top-level 'menu' state restricts Tab.

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
2. Aria: #53 — AccentColorPicker focus not moved into dialog on open
3. Aria: #54 — MessageThread no live region for incoming messages
4. Ada: remove remaining it.fails() wrappers for #59/#60 in contrast.test.ts
5. Open branding issue → activate Marque
