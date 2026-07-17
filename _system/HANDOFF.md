Last updated: 2026-07-17 (ship: waves 1–4 + Outrun glow polish)

## Current phase

Phase 5 — Full gate process active.

## Session summary

Held full 17-agent team meeting, filed 81 issues (#421–#501). Shipped four waves:
- Wave 1 (Arch): types contract cleanup — ExportOptions, ModelRegistryEntry, promoted Gate types, removed dead PricingConfig (#482 #483 #484 #487 #436)
- Wave 2 (Forge): CI sweep — Node 22 fix, SHA-pin all actions, vendor chunk split, Dependabot, deploy-pages gate, sync-models validation (#422 #445 #447 #455 #496 #497)
- Wave 3 (Aria+Ada): perf + delight — React.memo, DOMPurify memoization, hl.js language restriction, instant scroll, theme transition wiring, ghost icon pulse, shimmer GPU fix, Outrun bubble glow (#446–#451 #462 #465 #467)
- Wave 4 (Scout+Bastion): test coverage — fix stale image-actions test, add groupConversations/plugin-order/SAFE_MODEL_ID/AtMention suites, proxy + corrupt-blob backend tests (#472–#478)
- Coda hotfixes: Outrun bubble glow border-radius, tail glow via drop-shadow (color-mix to tame intensity), input bar glow matching border/border-strong, proxy.test.ts lint fix

## Key decisions

- drop-shadow (not box-shadow) for Outrun bubble glow — follows triangle tail shape; color-mix(50%) on wide pass compensates for accent-border amplification
- Input bar glow uses --border-default / --border-strong (not --border) — Tailwind maps border-border to var(--border-default)
- gpt-image-2: output_format: 'png'; always returns item.b64_json
- resolveVersionCatalog() must use collect-then-fall-through; never unconditional return from live API path
- SAFE_MODEL_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/ — hyphen at end needs no escape
- rehypeHighlight must run before rehypeSanitize in MarkdownContent — order is load-bearing
- Agents do NOT open GitHub PRs — push main directly at ship time (SOP §18)

## Open issues (priority order)

- **#423** — DeepSeek deprecation 2026-07-24 — URGENT, ~7 days
- **#421** — imageGenerationEnabled toggle never wired (always-on bug)
- **#425** — 2 pre-existing failing tests: gpt-image-gen.test.ts (Atlas), a11y copy-button (Ada)
- **#424** — README falsely says image generation not supported (Quill, Wave 5)
- **#442** — CORS wildcard on backend proxy (Rune/Atlas)
- **#444** — Login rate limiting missing (Rune/Gate)
- **#441** — Proxy no-auth passthrough (Rune)

## Gotchas

- ProxyNudge only renders in import.meta.env.PROD
- GitHub Pages source MUST be gh-pages branch, not main
- Backend CI uses Node 22 specifically
- Agents installing new npm deps in worktrees must commit package-lock.json
- Container DNS: ENOTFOUND means restart container, not dev server
- DeepSeek entries scheduled for deprecation 2026-07-24
- Next new agent gender: NB (they/them) — roster is 9F/8M/2NB
