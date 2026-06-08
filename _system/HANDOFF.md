Last updated: 2026-06-08

## Current phase

Phase 1 — chat interface layout complete.

## Active agent for next session

**Next: activate agents in this order:**
1. Gate — API key management (#10)
2. Atlas — Claude integration (#5)
3. Vault — LocalStorage provider (#8)

## Last issue closed

Issue #3 — [Aria] Chat interface layout. Built AppLayout, MessageBubble, MessageThread, InputBar, Sidebar. Wired Tailwind token extension block. Created theme.ts + applyTheme(). Loaded Slate theme at startup in main.tsx. Added all @keyframes (chunkFadeIn, cursorBlink, streamingShimmer, bubbleEntrance, threadEntrance) to index.css with prefers-reduced-motion handling. Mock data in App.tsx renders two conversations and 6 messages across Claude and GPT-5.5. lint + build pass.

## Decisions this session

- tailwind.config.js now uses `export default` (ESM) to match Vite 5 convention; confirmed working
- Tailwind `border-l-[3px]` used as arbitrary value for bubble accent — spec says 3px solid left border
- `max-w-[720px]` applied to MessageThread inner column per spec recommendation
- No markdown renderer added (spec says "Aria owns markdown styling" — deferred to a follow-up; whitespace-pre-wrap handles plain newlines for now)
- Ghost mode and retry are prop-driven shells; Atlas and Gate wire the real logic later
- `isStreaming` prop on InputBar disables Enter-to-submit but allows typing (per spec: "textarea accepts input but pressing Enter does not submit")

## Cross-agent dependencies (unresolved — carry forward)

1. **Atlas**: Streaming state flag — Aria reads `isStreaming` prop; Atlas must supply it via context or prop drilling when real model integration lands
2. **Atlas**: Retry method — Aria renders the Retry button with an `onRetry` callback; Atlas wires the actual re-request
3. **Atlas**: Mid-stream model deactivation behavior — confirmed lean from Luma: stream completes, then model goes inactive
4. **Gate**: Ghost mode state — Aria reads `isGhostMode` prop; Gate wires toggle

## Next issues (priority order)

1. [Gate] API key management (#10)
2. [Gate] #30
3. [Atlas] Claude integration (#5)
4. [Atlas] GPT integration (#6)
5. [Atlas] #7
6. [Vault] LocalStorage provider (#8)
7. [Vault] #9
8. [Aria] Model selector (#4) — unblocked after Gate and Atlas land

## Gotchas

- Arch owns `/src/types/index.ts` and `CLAUDE.md` — no other agent touches these
- Single-PR rule for types
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- `src/ui/index.ts` now exports all Phase 1 components
- Markdown rendering inside MessageBubble is deferred — currently plain text with whitespace-pre-wrap
