Last updated: 2026-06-20 (ship #177 follow-on — catalog resolver)

## Current phase

Phase 4+ — Full gate process active.

## Session summary

**#177 follow-on (Atlas)**: Wired `fetchLiveApiCatalog` and `fetchRemoteCatalog` into a
structured resolver pattern so Aria can call them from the version picker.

- `ModelRegistryEntry` in `registry.ts` gains optional `remoteCatalogUrl` and
  `liveApiEndpoint` fields (interface-only; no built-in registry entries populate them today)
- `resolveVersionCatalog(entry, apiKey?)` in `catalog.ts`: priority live API → remote → bundled
- `resolveCustomProviderCatalog(endpoint, key)` in `catalog.ts`: named entry point for
  custom (non-registry) providers (OpenRouter-style) — delegates to `fetchLiveApiCatalog`
- Both exported from `models/index.ts` as documented cross-agent exceptions Aria may call
- 13 new tests in `catalog-fetch.test.ts`; full suite 1048 passing, 7 pre-existing skips

## Key decisions

- `resolveVersionCatalog` does NOT fall back to bundled when a remote/live fetch fails —
  it returns whatever the underlying fetch function returns ([] on error). Callers that
  want a guaranteed non-empty list must implement their own fallback chain.
- Custom provider resolver is a thin wrapper, not a new fetch path — keeps the fetch
  implementation in one place and gives Aria a named boundary to call through.
- `openrouter.ai` is not on the container firewall allowlist — live API fetch degrades
  gracefully to [] in dev. Documented in registry.ts JSDoc.

## Open advisories (filed, not yet addressed)

- #241 (Aria/Ada) — ThreadActionMenu `role="menu"` aria-required-children violation in sub-states (pre-existing)
- #238 (Gate/Atlas) — Custom provider credential testing (CORS/keyless edge cases)
- #199 (Aria/Ada) — InteractionModeSwitcher coming-soon spans: radiogroup ownership
- #181 (Ada) — WCAG 2.1 → 2.2 upgrade path
- #180 (Ada) — Live browser keyboard audit
- #179 (Spark/Atlas) — Chunk fade-in wiring
- #178 (Spark) — Outrun entry flash
- #175 (Vault) — StorageProvider pagination
- #170 (Gate/Aria) — Backend auth UI
- #169 (Gate/Luma) — Custom theme validation UI
- #159 (Atlas/Aria) — Cancel streaming

## What's next

Top candidates:
- Atlas/Aria: #159 (Cancel streaming) — Atlas AbortController first, then Aria stop button
- Aria: #241 (ThreadActionMenu sub-state role fix) — straightforward structural change
- Aria: wire `resolveVersionCatalog` into `ModelSelectorPanel` version picker (no issue # yet)

## Gotchas

- CI uses `npm run test:run` — `npm test` is watch mode and hangs
- `ring-focus` = focus ring token; `ring-ring` does NOT exist
- `focus-visible:` directly on interactive elements; `focus-within:` on wrapper divs
- Double-rAF for focus restoration after React unmount
- `inert` attribute: `!isOpen ? '' : undefined`
- Bash tool CWD can drift into a worktree — always use `git -C /workspace`
- InteractionModeSwitcher: Manual + Auto-chain intentionally disabled (#131)
- `StoredConversation` envelope: `{ schemaVersion: 1, data: Conversation }` — bare records auto-migrate
- Release workflow: one-time → Settings → Actions → General → "Read and write permissions"
- `openrouter.ai` not on container firewall allowlist — live-API catalog fetch degrades to `[]` in dev
- App integration tests read from `lastContextValue` (RoundtableContext), not `lastAppLayoutProps`
- Parallel agent worktrees: Gate must always merge before Aria when Aria consumes a new Gate function
- `aria-disabled` not `disabled` for buttons that need tooltip discoverability via keyboard
