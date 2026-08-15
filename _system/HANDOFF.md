Last updated: 2026-08-15 (font scale controls — #600)

## Current phase

Phase 5 — Full gate process active.

## Key decisions

- `conversationSystemPrompt` storage: whole-object JSON serialization means new optional fields on `Conversation` are persisted automatically — no field-by-field wiring needed
- Ghost mode guard confirmed: `isGhost` check is first line of both `saveConversation` paths
- Lazy panel boundaries (waves 31 + 31b): index chunk 345 kB → 200 kB raw / 88 → 55 kB gzip. Remaining index chunk is all critical-path code — no further splits available.
- Sidebar min/default width (wave 31): 330 px — four desktop header icons need ~324 px; old default clipped the gear. Stored values below 330 auto-migrate via `parseStoredWidth`.
- Touch targets (#595): `min-w-[44px] min-h-[44px]` added to all icon-only buttons. Nameplate chevrons, directed-reply ×, and attachment × buttons left at 24px WCAG floor (rationale in commit).
- Settings export (#596): proxy URL travels through `preferences['proxyUrl']` (same pattern as `serverUrl`); omitted when not configured; silently skipped by older clients.
- Font scale (#600): two independent CSS custom properties — `--font-scale-ui` (0.875–1.25) and `--font-scale-content` (0.875–2.0). Set on `:root` at startup from `getFontScalePreferences()`. UI scope: AppLayout root div. Content scope: MessageThread scroll container. Tailwind `text-*` classes are rem-based and do not auto-scale — only inline `style` overrides on targeted elements. Small metadata text (11–12px) uses `max(10px, calc(Xpx * var(--font-scale-content, 1)))` floor. Live preview via direct `document.documentElement.style.setProperty()` on each stepper change. `aria-valuemin` announces 88 (not 87) — correct, `Math.round(87.5)` = 88.

## Open issues

- #568 Upgrade @eslint/js to v10 (blocked: major version bump, peer dep audit needed)
- #569 Upgrade @vitest/coverage-v8 to v4 (blocked: major version bump)
- #570 Upgrade eslint-plugin-react-hooks to v7 (blocked: major version bump)

## Next up

Forge wave: #568 + #569 + #570 as one coordinated upgrade pass.

## Recently shipped

- **#600 Font scale controls** — "Reading" section in Settings with independent UI scale and content scale steppers. Storage key `roundtable:font-scale`. 42 a11y regression tests. Exports with settings.
- **CI fix (ProviderSettingsPanel focus return)** — shared `ref` between mobile/desktop gear buttons caused ref to point to `display:none` element. Fixed: `document.activeElement` captured at open time as primary return target.
- **#595 Mobile touch targets** — 12 interactive controls upgraded to ≥44px. 6 WCAG 2.5.8 regression tests.
- **#596 Settings export: proxy URL** — additive, backward-compatible.

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- DeepSeek V4 active — migrated from retired deepseek-chat/reasoner to deepseek-v4-flash/v4-pro (#563)
- DevProxyHint (#565): `/dev-proxy/` only for CORS-blocking providers; CORS-enabled (e.g. OpenRouter) use plain `https://` URL
- Font scale: Tailwind `text-*` classes are rem-based — do NOT assume they inherit container font-size. Scale only works via inline `style` overrides or em-based classes on targeted elements.
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
- Model sync bot commits to `main` daily at 06:00 UTC — `git pull --no-rebase origin main` before pushing if branch was open overnight
- `border-blockquote` token at 2.11:1 on `bg-card` in Slate — acceptable
- Dev server: restart after all merges — HMR can disrupt in-flight streams
- KeyIcon: use axis-aligned paths — diagonal strokes anti-alias poorly at small sizes
- Dependency upgrades (#568–570): pinned to avoid peer dep conflicts — do not bump individually, upgrade as a coordinated Forge wave
