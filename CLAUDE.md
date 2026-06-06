# Roundtable — Claude Operating Rules

## What this project is

A browser-based multi-model AI conversation interface. Users talk with multiple
AI models simultaneously in a shared chat thread. Open source, client-side first,
self-hostable backend path.

## Codebase structure

```
roundtable/
├── src/
│   ├── types/        ← shared interfaces — read carefully before touching
│   ├── ui/           ← Aria owns this (React components, layout)
│   ├── models/       ← Atlas owns this (API integrations, streaming)
│   ├── storage/      ← Vault owns this (persistence, export, ghost mode)
│   └── auth/         ← Gate owns this (API keys, settings, backend auth)
├── backend/          ← optional self-hosted backend (Phase 4)
└── _system/          ← HANDOFF.md, MEMORY.md, this file
```

## Agent boundary rules — NON-NEGOTIABLE

Each agent owns exactly one directory. These are hard walls:

| Agent | Owns | Must never touch |
|-------|------|-----------------|
| Aria  | `/src/ui` | `/src/models`, `/src/storage`, `/src/auth` |
| Atlas | `/src/models` | `/src/ui`, `/src/storage`, `/src/auth` |
| Vault | `/src/storage` | `/src/ui`, `/src/models`, `/src/auth` |
| Gate  | `/src/auth` | `/src/ui`, `/src/models`, `/src/storage` |

Cross-agent communication happens ONLY through the interfaces in `/src/types/index.ts`.
If you need something from another agent's directory, you are doing it wrong —
define or extend an interface instead.

**Exception:** Pure utility functions exported from `/src/models/index.ts`
(e.g. `getSessionTokenUsage()`) may be imported by Aria. Document any such
exception with a comment.

## `/src/types/index.ts` rules

This file is the contract between all agents. It is the most critical file in
the project.

- No agent may modify it unilaterally
- Changes require a PR reviewed and approved by all active agents
- No implementation code — types and interfaces only
- If in doubt, read it before writing any code

## Core rules

- NEVER silently modify files outside your assigned directory
- NEVER skip the branch check before starting work (see SOP step 4)
- NEVER merge to main or push without explicit user authorization
- NEVER update HANDOFF.md after pushing — update it BEFORE the final commit
- Keep HANDOFF.md under ~30 lines — it is a whiteboard, not a log
- Do not introduce new dependencies without noting them in the PR description
- `npm run lint` and `npm run build` must pass before any PR is opened

## Technical constraints

- React + TypeScript + Vite
- Tailwind CSS v3 (utility classes only — no inline styles, no CSS modules)
- Path alias: `@/` maps to `./src/`
- Node 20+
- Tests: Vitest
- Run `npm run dev` / `npm test` from the project root (not `src/`)
- API keys are stored in localStorage — never logged, never exported, never
  transmitted except to the respective provider's official API endpoint

## Phase awareness

Always check `HANDOFF.md` to know the current phase before starting work.
Do not implement Phase N+1 features during Phase N work, even if it seems easy.
Scope creep across agents is how collisions happen.

---

## SOP

**Always follow this SOP. Skip asking about planning — execute directly unless
the user explicitly requests a plan.**

### Session start

1. Pull `main` and check for changes in `HANDOFF.md` before doing anything else.
2. Review `HANDOFF.md` for current phase, active issues, and gotchas.
3. Cross-reference with `gh issue list --repo {owner}/roundtable` to catch
   anything closed manually that isn't reflected yet. Update `HANDOFF.md` if stale.

### Execution

4. Before creating a branch for an issue, run `git branch -a | grep <issue-number>`.
   If a match exists, stop and tell the user — another agent may already be on it.
   Do not proceed without explicit confirmation.
5. Assess if a new branch is necessary and create it. A new branch is almost
   always preferred. Branch naming: `{issue-number}-{agent}-{short-description}`
   e.g. `12-aria-chat-layout`.
6. Execute directly against the prompt (skip planning unless explicitly requested).
7. If planning is requested: plan the implementation and request confirmation
   before proceeding.
8. Before opening a PR, verify:
   - `npm run lint` passes
   - `npm run build` passes
   - No imports outside your assigned directory (except permitted exceptions)
   - No modifications to `/src/types/index.ts` without cross-agent review
9. Give a brief honest assessment of whether testing is worthwhile for the work done.
   Then ask if testing is desired. If yes, create and run tests with Vitest.
   Only run the full suite if asked or if the work warrants it.
10. If bugs are found, recap them and ask if fixing is desired. Iterate until
    tests pass.

### Session close-out (required)

11. When all work is completed, report back. Do not merge into `main`, push to
    the repo, or delete the WIP branch without authorization.
12. **Update `HANDOFF.md` first** — before the final commit and push. Stage it.
    Include it in the fix commit or as a separate `chore: update handoff` commit.
13. Once approved: merge the WIP branch into `main`, push `main` to the repo,
    and delete the WIP branch. No PRs needed for solo work; PRs required for
    any change to `/src/types/index.ts`.
14. Close the related GitHub issue with a brief summary of decisions made and
    anything the next agent needs to know. Do not skip this step.
15. **Rewrite** `HANDOFF.md` — not append. Replace the entire contents with:
    - Last updated date
    - Current phase
    - Last issue closed and outcome
    - Decisions made this session that affect future work
    - Next issue(s) in priority order
    - Any live gotchas or blockers

**The rule:** `HANDOFF.md` is a whiteboard. Erase and rewrite every session.
Git is the log.
