Last updated: 2026-06-08

## Current phase

Phase 2 — IN PROGRESS

## Active agents for next session

Parallel track A (no dependencies):
- Atlas — issue #14 (directed reply routing)
- Atlas — issue #15 (token usage tracking)
- Aria  — issue #12 (interaction mode switcher)

Parallel track B (depends on Atlas shipping first):
- Aria  — issue #11 (directed reply UI) → needs Atlas #14
- Aria  — issue #16 (token usage display) → needs Atlas #15

## Last closed

- #13 [Aria] Per-model system prompt UI — SystemPromptRow in ModelSelectorPanel,
  onUpdateSystemPrompt wired through AppLayout → App.tsx

## Decisions made this session

- System prompt section placed inside ModelSelectorPanel slide-up panel, below
  Active Models, separated by a border-t divider
- Each active model gets a SystemPromptRow: collapse/expand toggle, auto-resizing
  textarea (max 160px), clear (×) button when prompt is set, hint text below
- "Set" badge shown on collapsed rows with a non-empty prompt
- "N of M set" counter in section header when any prompt is active
- systemPrompt stored as undefined (not empty string) when cleared via App.tsx handler
- onUpdateSystemPrompt is a required prop on ModelSelectorPanel and AppLayout

## Gotchas

- Single-PR rule on types/index.ts — no concurrent Arch PRs
- Outrun shadow values use rgba neon glow — do not flatten in Tailwind config
- Gate's ApiKeyPanel requiredKeys prop wired — Aria passes active model keys
- getSessionTokenUsage() exported from @/models — Aria may import (documented exception)
- Markdown rendering in MessageBubble deferred — plain text with whitespace-pre-wrap
- Subagents must be prompted to commit before reporting back (learned pattern)
- Aria and Atlas cannot self-review their own PRs on GitHub — agent approvals logged in PR comments only
- App.tsx lives outside /src/ui — Aria may update it only to thread UI props (no logic)
