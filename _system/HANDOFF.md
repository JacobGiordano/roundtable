Last updated: 2026-06-18 (ship #148 #152 #229 #234)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Single Aria wave — four issues:

- #148 (Aria): `getModelDotStyle` extracted from Sidebar, ModelSelectorPanel, ProviderSettingsPanel into `/src/ui/utils/modelColor.ts`. Custom provider accent colors now resolve via `getProviderRoster()` fallback at all three sites.

- #152 (Aria): `MODEL_ACCENT_CSS_VARS` (modelId → CSS var name) consolidated into `utils/modelColor.ts`. Both `theme.ts` and `AccentColorPicker.tsx` import from the single definition.

- #229 (Aria): `ModelVisibilityBar` last-visible guard: `disabled` removed, `aria-disabled` only. Button is now in tab order; AT announces guarded state. Click guard retained.

- #234 (Aria): `InputBar.tsx` textarea `focus:` → `focus-visible:`. Mouse clicks no longer show focus ring.

## Key decisions

- Shared utility goes in `/src/ui/utils/modelColor.ts` (not `/src/models/`) — all consumers are UI files
- Custom provider resolution chain: builtin map → roster color → `var(--accent-other)` fallback
- `getProviderRoster()` import from `@/auth` is a documented Gate exception (pure read, no side effects)

## Open advisories (filed, not yet addressed)

- #235 (Aria) — MessageThread.tsx:101 visibility dot uses `model.color` directly, bypasses getModelDotStyle roster-fallback; stale comment at :191
- #232 (Gate/Aria) — Custom provider endpoints not editable; must delete/recreate to change any field
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #177 (Atlas) — Remote/live-API model catalog
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps 30 props)
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #159 (Atlas/Aria) — Cancel streaming
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit

## What's next

Top priority:
- Aria: **#162** (message editing) — high user value, unblocked
- Gate/Aria: **#232** (custom provider editing) — medium, cross-domain
- Atlas: **#177** (remote model catalog)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131) until Atlas implements dispatch
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- OpenRouter custom provider: requires investigation (Llama 3.3 not responding — may need extra headers)
