Last updated: 2026-06-21 (ship: wave — Aria #249 TestButton wiring + #250 layout fix)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**Wave: Aria #249 + #250 (batched) — ProviderSettingsPanel test button fixes**

- **#250 (Aria)** — Layout fix: Test, Edit, Clear buttons consolidated into a single flex row in ProviderRow. Previously Test was stranded on its own line. Matches ApiKeyPanel.tsx pattern.
- **#249 (Aria)** — TestButton wired: `testCredential` / `testCustomCredential` / `TestResult` imported from `@/auth`. Full `TestState` lifecycle (idle → testing → result → auto-clear after 5s). Built-in providers use `testCredential`; custom keyed use `testCustomCredential`; keyless remain disabled (tooltip unchanged). `endpointUrl` prop threaded through ProviderRowProps. Live region `role="status"` added for AT. `TESTABLE_CREDENTIAL_KEYS` = {anthropic, openai, google, xai, deepseek, mistral}.
- **Ada audit**: PASS — 8 new axe tests in provider-settings-panel.test.tsx.
- **Flint**: PASS — 1335/1336 green (pre-existing ExportButton Escape failure only).

## Open bugs (reported during visual check, not yet fixed)

- **Claude credential test returns "Network Error"** (Gate) — `api.anthropic.com/v1/models` may not return CORS headers on error responses; browser can't read 4xx, throws as network error. Built-in providers should return `cors-or-network` on fetch throw, not `error`. Gate issue to file.
- **Claude messages not working** — related to above, or the user's new key may not be valid yet. Needs confirmation (does platform.anthropic.com accept the key?).
- **Selected models wiped on page reload** — reported after container rebuild. UNCONFIRMED whether plain page reload also wipes. If yes, this is a Vault/session regression — potentially introduced by #146 file split changing Sidebar component mount behavior. Needs immediate investigation before next wave.

## Key decisions

- `roundtable:` prefix (colon separator, kebab-case) is the canonical localStorage convention for all new keys.
- Migration shims live in place for one release cycle, then get removed.
- ThreadActionMenu backdrop pattern is intentional — backdrop blocks hover bleed; `useClickOutside` is for non-modal dropdowns only.
- `cors-or-network` is a distinct TestResult status — allows UI to surface informative message for custom endpoints.
- `MODEL_REGISTRY` from `@/models` and `BUILTIN_MODEL_IDS`, `getModelAccentCssValue` from `@/auth` are permitted Aria imports (read-only/shared utils) — document with comment at import site.
- MessageBubble + OnboardingEmptyState SVGs remain inline — no cross-file duplication.
- SearchBar magnifying glass SVG remains inline — single-use (#248 filed to document as inline exception).
- TestButton in ProviderSettingsPanel now calls real testCredential; `TESTABLE_CREDENTIAL_KEYS` mirrors Gate's PROVIDER_TEST_CONFIGS (update both together if providers change).

## Open advisories

- #248 (Aria) — Document SearchBar magnifying glass as inline exception in icons/index.tsx header
- #247 (Aria) — Focus-return on group-suggestion buttons; UX decision needed for post-delete focus target
- #245 (Ada/Aria) — SystemPromptRow: aria-controls references conditionally rendered element
- #244 (Aria) — SystemPromptRow: requestAnimationFrame in setState callback — refactor to useEffect
- #243 (Ada/Aria) — AddModelButton: role="menu" lacks ArrowDown/Up keyboard navigation
- #199 (Ada/Aria) — InteractionModeSwitcher coming-soon spans break radiogroup ownership model
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI

## What's next

**Before kicking off next wave:** confirm whether plain page reload (no container rebuild) also wipes selected models. If yes, Vault/Aria regression — investigate before any other wave.

- **Gate: credential test CORS fix** — built-in providers should return `cors-or-network` on fetch throw
- **Aria: #243** — AddModelButton keyboard nav (a11y blocker-adjacent)
- **Aria: #245** — SystemPromptRow aria-controls fix
- **Aria: #247** — Group-suggestion focus-return (UX decision needed)

## Visual check needed

- ProviderSettingsPanel: provider row with saved key → Test | Edit | Clear should be on one horizontal row
- Clicking Test should cycle through "Testing…" → result label → auto-reset after 5s

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount (single rAF OK when no unmount involved)
- `inert` attribute: `!isOpen ? '' : undefined`
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131)
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `openrouter.ai` not on container firewall allowlist — live-API catalog fetch degrades to `[]` in dev
- App integration tests read from `lastContextValue` (RoundtableContext), not `lastAppLayoutProps`
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
- `aria-disabled` not `disabled` for buttons that need tooltip discoverability via keyboard
- jsdom `DOMException` does not extend `Error` — always duck-type AbortError: `err?.name === 'AbortError'`
- Vault cache is in `LocalStorageProvider` instance scope — tests that create fresh instances always start cold
- ExportButton: WAI-ARIA menu pattern requires ArrowDown/Up wiring alongside `tabIndex={-1}` — pre-existing test failure in ExportButton Escape
- `BUILTIN_MODEL_IDS` from `@/auth` is the only Gate import Aria is normally permitted; `MODEL_REGISTRY` from `@/models` also permitted (read-only data) — both require comment at import site
- localStorage migration shims: `rt_key_` / `roundtable_user_preferences` / `rt-ui-sidebar-width` shims in place — remove after one release cycle
- `testCustomCredential` (Gate): `cors-or-network` = CORS blocked or network error — built-in providers still return `error` on network failure (fix pending)
- `TestResult` type lives in `credentialTest.ts`, exported via `@/auth` index — do not re-export from `/src/types/index.ts`
- `TESTABLE_CREDENTIAL_KEYS` in ProviderSettingsPanel must stay in sync with Gate's `PROVIDER_TEST_CONFIGS` — update both together
- Sub-component directories: sidebar/ and model-selector/ under /src/ui/components/ — added in #146 wave
