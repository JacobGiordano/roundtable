Last updated: 2026-08-05 (CI peer dep fix — deploys unblocked)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths
- Bundle audit (wave 29): GREEN vs. wave 27 baseline; lazy boundary working correctly
- KeyIcon redesign (wave 30): axis-aligned paths replace diagonal strokes — diagonal strokes at 13px anti-alias into interlocked-oval artefacts
- Live version picker (#407): fully implemented in wave 26 via `useLiveVersionCatalog` hook — `resolveVersionCatalog` fans out to all registry entries in parallel
- System prompt persistence (#408): seeded from `Conversation.conversationSystemPrompt` on load/switch; persisted via `store.updateConversation()` on edit; ghost guard in place
- Lazy panel boundaries (waves 31 + 31b): index chunk 345 kB → 200 kB raw / 88 → 55 kB gzip across two passes. Wave 31: `ModelSelectorPanel` + `ProviderSettingsPanel`. Wave 31b: `ApiKeyPanel`, `BackendServerPanel`, `ProxySettingsPanel`, `UserAccentColorPicker`, `ProxyOnboardingModal`, `credentialTest` (transitive dep). Remaining index chunk is all critical-path code (App, Sidebar, InputBar, sidebarUtils, ThreadActionMenu, icons) — no further splits available. `ProviderSettingsPanel` uses mount-once guard (`hasEverOpenedProvider`); all other lazy panels are already conditionally rendered. Dev server does not show chunks; verify against `npm run build && npx serve dist`.
- Sidebar min/default width (wave 31): raised from 278/280 → 330 px. Four desktop header icons (ghost + collapse + new + gear) need ~324 px; old default clipped the gear via `overflow-hidden`. Stored values below 330 auto-migrate via `parseStoredWidth` out-of-range guard. If a 5th icon is added, recalculate: 5×32 + 4×4 + logo(152) + padding(32) = 360 px.

## Open issues

None — backlog clear.


## Next up (not yet filed as issues)

None.

## Recently shipped

- **CI peer dep fix** — Three dependabot PRs merged July 31 out of sync broke `npm ci` for 6 days; all GitHub Pages deploys skipped since. Fix: pinned `@vitest/coverage-v8→^1.6.1`, `@eslint/js→^9.9.0`, `eslint-plugin-react-hooks→^5.1.0-rc.0` back to pre-conflict versions. Also added `<meta name="description">` and fixed proxy-onboarding-modal a11y test count (4→5) for the #584 setup guide link.
- **OG/Twitter social card fix** — `og:image` and `twitter:image` were relative paths; crawlers resolved them against the domain root (missing `/roundtable/` base) → 404. Fixed to absolute URLs. Added `og:url`, `og:site_name`, `twitter:title`, `twitter:description`.
- **#584 Proxy onboarding fixes** — broken `&dir=workers` deploy URL, setup guide link in modal, README blockquote callout, expanded deployment guide (Step 1 now covers Cloudflare UI, wrong-page warning, and post-deploy URL copy).

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek V4 active — migrated from retired deepseek-chat/reasoner to deepseek-v4-flash/v4-pro (#563)
- Custom provider dot color fix: `getModelAccentCssValue` now returns `var(--accent-custom-{id})` for custom providers instead of raw roster hex — dots update live after AccentColorPicker changes, consistent with `resolveAccentCssColor`
- DevProxyHint (#565): `/dev-proxy/` only for CORS-blocking providers; CORS-enabled providers (e.g. OpenRouter) use plain `https://` URL — routing through proxy mangles `Authorization` header
- HTML rendering (#566): DOMPurify pre-sanitization (`ALLOWED_TAGS: []`) now applied to streaming path in `MessageBubble.tsx` — mirrors `MarkdownContent.tsx`; raw HTML in model responses stripped before ReactMarkdown parses it
- Auto-scroll (#567): `isProgrammaticScroll` ref in `MessageThread.tsx` guards scroll listener — programmatic `scrollIntoView` no longer overwrites `pinnedToBottom`; scroll-up during streaming correctly pauses auto-scroll
- Screenshot refresh: 8 shots in `docs/assets/`, all browser-chrome-free. Covers parallel broadcast, auto-chain, streaming mid-flight, version picker, model selector, code comparison, provider settings, system prompt + auto-chain. README fully illustrated across all sections.
- Setup Transfer docs (#564): step-by-step instructions + explicit "API keys never exported" callout added to README
- README copy/image audit: fixed 4 mismatches — parallel "three angles" → "multiple angles", streaming theme label (Chalk not Slate), provider settings alt text (removed sections not in cropped image), removed broken screenshot cross-reference in Transfer Setup prose
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Coda worktree drift: always `git checkout main` before any merge operations
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Both `parse_failure` (Local) and `parse_error` (Server) retained in `StorageErrorCode`
- Dev server: restart after all merges — HMR can disrupt in-flight streams
- KeyIcon: use axis-aligned paths — diagonal strokes anti-alias poorly at small sizes
