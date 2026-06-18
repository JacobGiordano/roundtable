Last updated: 2026-06-18 (ship #164 #165 #172 #228)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Parallel wave — Aria + Gate:

- #164 (Aria): Conversation rename via three-dot menu → inline input sub-state. Enter confirms, Escape cancels, empty reverts to auto-title. Focus returns to trigger via double-rAF. Persists via `ConversationStore.updateConversation`.

- #165 (Aria): `ModelVisibilityBar` above message thread (2+ models only). Per-model eye-toggle pill buttons, `aria-pressed`, at-least-one-visible guard. State is ephemeral local React state.

- #172 (Gate): `useCredentials` extended to cover custom provider `credentialKey` values from roster. `ApiKeyPanel` now renders credential rows for custom providers below the six built-ins.

- #228 (Gate): `ApiKeyPanel` `clearTimerRef` pattern — timer cancelled on unmount and on re-test.

## Key decisions

- Rename trigger: three-dot menu only (not double-click) — avoids dblclick WCAG 2.1.1 concern, cleaner integration
- Visibility bar: ephemeral state only (no persistence) — per spec
- Custom provider credential rows: no "Get your API key" link (no docsUrl); display name from roster
- `disabled={isLastVisible}` advisory (#229): filed, not fixed — Ada PASS verdict still stands

## Open advisories (filed, not yet addressed)

- #229 (Aria) — ModelVisibilityBar last-visible guard: drop `disabled`, keep `aria-disabled` only
- #230 (Aria) — Sidebar group-input sub-state Cancel doesn't return focus to trigger (pre-existing)
- #234 (Aria) — InputBar `focus:ring` → `focus-visible:ring` (pre-existing, shows ring on mouse click)
- #232 (Gate/Aria) — Custom provider endpoints not editable; must delete/recreate to change any field
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps 30 props)
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #165 done; #159 (Atlas/Aria) — Cancel streaming still open
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit

## What's next

Top priority wave:
- Aria: **#148 + #152** — consolidate `getModelDotStyle` (3 independent copies) into a shared utility with custom provider roster fallback; consolidate `modelId → CSS-var` map. Fixes custom accent color display everywhere. Batch these — same system, conflict risk if split.

Also strong candidates:
- Aria: #234 (InputBar focus-visible fix) — tiny, could batch with #148 wave
- Aria: #229 (ModelVisibilityBar disabled→aria-disabled) — tiny, same
- Gate/Aria: #232 (custom provider editing) — medium, cross-domain
- Atlas: #177 (remote model catalog)
- Aria: #162 (message editing) — high user value

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131) until Atlas implements dispatch
- Custom provider accent colors broken everywhere until #148 + #152 land
- OpenRouter custom provider: requires investigation (Llama 3.3 not responding — may need extra headers)
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
