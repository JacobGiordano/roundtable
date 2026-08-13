Last updated: 2026-08-13 (mobile panel fixes, auto-scroll, viewport height, CONTRIBUTING docs)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths
- Lazy panel boundaries (waves 31 + 31b): index chunk 345 kB → 200 kB raw / 88 → 55 kB gzip. Remaining index chunk is all critical-path code — no further splits available.
- Sidebar min/default width (wave 31): 330 px — four desktop header icons need ~324 px; old default clipped the gear. Stored values below 330 auto-migrate via `parseStoredWidth`.
- Auto-scroll (#598): scrollTop delta detection in scroll listener replaces touchstart/touchmove — works on both mobile and desktop. Wheel listener kept for desktop early-detection. `prevScrollTop` ref tracks last scrollTop.
- Viewport height (#599): `h-screen` (`100vh`) → `h-dvh` (`100dvh`) on root AppLayout and ProviderSettingsPanel overlay — fits visible area as mobile browser chrome shows/hides.
- Inline edit (#586): `onEditMessage` accepts optional `newContent` param — App uses it to pre-fill InputBar; callers that omit it fall back to original message text.
- HTML export markdown (#588): assistant messages run through `micromark` + GFM + DOMPurify; user messages stay plain text; no new deps.

## Open issues

- #595 — Mobile touch target audit (Ada)
- #596 — Proxy URL in settings export (Vault + Vera)

## Next up (not yet filed as issues)

None.

## Recently shipped

- **#592 Mobile icon fix** — provider settings icon was opening settings panel instead of providers panel on mobile; handler mapping corrected
- **#593 Providers panel full width** — panel now fills full viewport width on mobile
- **#594 Model selector popover** — full width and taller on mobile
- **#597 CONTRIBUTING.md** — model sync bot documented: what it does, why divergence happens, how to resolve with `git pull --no-rebase origin main`
- **#598 Mobile auto-scroll** — scrollTop delta replaces unreliable touchstart/touchmove; scroll-to-bottom button visibility fixed on mobile
- **#599 Viewport height** — `h-dvh` replaces `h-screen` on root container and ProviderSettingsPanel overlay

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek V4 active — migrated from retired deepseek-chat/reasoner to deepseek-v4-flash/v4-pro (#563)
- DevProxyHint (#565): `/dev-proxy/` only for CORS-blocking providers; CORS-enabled (e.g. OpenRouter) use plain `https://` URL
- HTML rendering (#566): DOMPurify pre-sanitization applied to streaming path in `MessageBubble.tsx`
- Auto-scroll (#598): `prevScrollTop` ref is the mobile intent signal — if scrollTop decreases, user scrolled up. Wheel listener is kept as early-detection for desktop only.
- HTML export (#588): assistant content uses `<div class="content">` wrapper; user content uses `<p>`
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Model sync bot commits to `main` daily at 06:00 UTC — `git pull --no-rebase origin main` before pushing if branch was open overnight
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Dev server: restart after all merges — HMR can disrupt in-flight streams
- KeyIcon: use axis-aligned paths — diagonal strokes anti-alias poorly at small sizes
