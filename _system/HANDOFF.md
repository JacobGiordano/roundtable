Last updated: 2026-06-19 (ship #235 #162 #177 + dangling polish)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

Three-issue wave (one Aria + one Atlas, parallel worktrees) + dangling uncommitted polish:

- **Dangling polish (Coda)**: ApiKeyPanel and ProviderSettingsPanel now show an
  eye-toggle to reveal/hide saved keys; Edit/Clear buttons surface below the masked
  field. AccentColorPicker resolves custom provider swatch via roster fallback.
  InputBar outer border provides focus indicator (inner ring suppressed). Theme
  swatch decorators removed from Sidebar theme buttons.

- **#235 (Aria)**: `MessageThread.tsx` visibility dot now uses `getModelDotStyle()`
  instead of bare `model.color`, restoring custom provider accent colors in the
  visibility bar. Stale `disabled` comment updated to `aria-disabled`.

- **#162 (Aria)**: Message editing. User message bubbles show a hover-revealed edit
  button (right-10, left of copy button). Clicking pre-fills InputBar; an "Editing
  message" banner with Cancel appears. Send truncates the conversation at that point,
  replaces it with the edited message, and resends to all models. Escape cancels.
  Edit state clears on conversation switch and new conversation.

- **#177 (Atlas)**: `fetchRemoteCatalog(url)` and `fetchLiveApiCatalog(endpoint, apiKey)`
  added to `src/models/catalog.ts`, exported from `src/models/index.ts`. Both degrade
  gracefully to `[]` on any error.

- **Aria profile update (Coda)**: Pre-Ada self-audit checklist added to `.claude/agents/aria.md`.
  Five mandatory evidence items before Ada can be spawned.

## Key decisions

- Truncation uses `slice(0, messageIndex)` exclusive — the edited message is appended fresh, not modified in place
- Edit state lives in `App.tsx`; `updateConversation` path handles ghost mode correctly
- Catalog fetch functions are pure utilities; wiring them into the version picker is a follow-on Aria issue
- `openrouter.ai` is not on the container firewall allowlist — live-API calls degrade to `[]` in dev (correct behavior; add to allowlist if live fetch is needed)

## Open advisories (filed, not yet addressed)

- #232 (Gate/Aria) — Custom provider endpoints not editable; must delete/recreate
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 (Vault) — StorageProvider pagination
- #174 (Aria) — React Context or Zustand (AppLayoutProps 30+ props)
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #159 (Atlas/Aria) — Cancel streaming
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit (includes edit-mode focus + aria-live verification)

## What's next

Top priority:
- Aria: **#174** (AppLayoutProps prop drilling → React Context / Zustand) — now more urgent after this wave added 3 more props
- Aria: **#232** (custom provider endpoint editing) — cross-domain Gate/Aria
- Atlas: wire `fetchLiveApiCatalog` / `fetchRemoteCatalog` into the version picker (follow-on to #177, needs Aria)

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
- `openrouter.ai` not on container firewall allowlist — live-API catalog fetch degrades to `[]` in dev
