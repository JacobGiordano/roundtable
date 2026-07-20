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
│   ├── auth/         ← Gate owns this (API keys, settings, backend auth)
│   └── tests/        ← Scout owns this (integration/regression); Ada owns tests/a11y/
├── _design/          ← Luma owns this (token schema, themes, component specs)
├── backend/          ← optional self-hosted backend (Phase 4)
└── _system/          ← HANDOFF.md, SOP.md, MEMORY.md, this file
```

## Agents

Project-local agent profiles live in `.claude/agents/`. Claude Code loads them
automatically — no installation required.

**Invoke the correct agent for every task — do not work without one.**

| Agent | Owns | Must never touch |
|-------|------|--------------------|
| Aria 🎨 | `/src/ui` | `/src/models`, `/src/storage`, `/src/auth` |
| Atlas 🔭 | `/src/models` | `/src/ui`, `/src/storage`, `/src/auth` |
| Vault 🗄️ | `/src/storage` | `/src/ui`, `/src/models`, `/src/auth` |
| Gate 🔑 | `/src/auth` | `/src/ui`, `/src/models`, `/src/storage` |
| Luma ✦ | `/_design` | `/src/**` (specs only — no code) |
| Marque 🏷️ | `/_design/brand/` | `/src/**`, `/_design/tokens/`, `/_design/themes/`, `/_design/specs/` |
| Arch 🏛️ | `/src/types/index.ts`, `CLAUDE.md` | `/src/ui`, `/src/models`, `/src/storage`, `/src/auth`, `/_design` |
| Spark ✨ | *(none — called by Aria in Phase 2+)* | owns nothing; produces specs Aria applies |
| Coda 🎯 | *(none — coordinates)* | owns nothing; sequences agents, no implementation |
| Flint 🔍 | *(none — reviews live app)* | owns nothing; read-only phase gate verification |
| Quill 🪶 | `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `/docs/` | `/src/ui`, `/src/models`, `/src/storage`, `/src/auth`, `/_design`, `/src/types/index.ts`, `CLAUDE.md`, `_system/HANDOFF.md` |
| Scout 🐾 | `/src/tests/` (excluding `/src/tests/a11y/`) | application code in any agent directory, `/src/types/index.ts`, `CLAUDE.md`, `/_design`, root-level docs |
| Ada ♿ | `/src/tests/a11y/` | application code in any agent directory, `/src/models`, `/src/storage`, `/src/auth`, `/src/types/index.ts`, `CLAUDE.md`, root-level docs |
| Forge ⚙️ | `.github/workflows/`, `/backend/src/` (security middleware, rate limiting, infrastructure-level backend concerns only) | `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `/src/**`, `CLAUDE.md`, `/_design`, root-level docs |
| Bastion 🛡️ | `/backend/tests/` | `/backend/src/**`, `/src/**`, `/src/types/index.ts`, `CLAUDE.md`, `/_design`, root-level docs |
| Rune 🔐 | *(none — cross-cutting security reviewer)* | owns nothing; reads all dirs, proposes fixes only — called before PRs touching auth, API key handling, model output rendering, or backend routes |
| Vera ⚖️ | *(none — cross-cutting privacy advisor)* | owns nothing; reads all dirs, proposes fixes only — called when storage formats change, new data fields introduced, exports change, or analytics considered |
| Gauge 👁️ | *(none — cross-cutting code reviewer)* | owns nothing; reads all dirs, proposes fixes only — called on request or before PRs with non-trivial logic changes or refactors |
| Tempo ⚡ | *(none — cross-cutting performance engineer)* | owns nothing; reads all dirs, proposes fixes only — called when bundle size grows, streaming perf changes, or explicitly requested |

Cross-agent communication happens ONLY through the interfaces in `/src/types/index.ts`.
If you need something from another agent's directory, you are doing it wrong —
define or extend an interface instead.

**Exception:** Pure utility functions exported from `/src/models/index.ts`
(e.g. `getSessionTokenUsage()`) may be imported by Aria. Document any such
exception with a comment.

## `/src/types/index.ts` rules

This file is the contract between all agents. It is the most critical file in
the project.

- No agent may modify it unilaterally — `Arch` is the only agent authorized to write to this file
- **Single-PR rule**: all changes to `/src/types/index.ts` ship in exactly one PR at a time, reviewed and approved by all active agents before any agent proceeds with implementation. Concurrent types PRs are forbidden — they produce merge conflicts that break all four agent domains simultaneously.
- No implementation code — types and interfaces only
- Activate `Arch` 🏛️ for any work on this file
- If in doubt, read it before writing any code

## Core rules

- NEVER silently modify files outside your assigned directory
- NEVER skip the branch check before starting work (see SOP step 5)
- NEVER push to remote or close a GitHub issue without explicit user authorization ("ship it")
- Merging the WIP branch into local `main` for dev-server review is permitted at "done" time — push to remote is not
- NEVER update HANDOFF.md before "ship it" — it is written and committed as the first act of the ship step
- Keep HANDOFF.md under ~30 lines — it is a whiteboard, not a log
- Do not introduce new dependencies without noting them in the PR description
- `npm run lint` and `npm run build` must pass before any PR is opened
- **Each agent works exactly one issue per session, then stops and waits for explicit user authorization before starting the next one — no exceptions**
- When an issue presents multiple implementation paths, run `git log --oneline --grep="<keyword>"` for relevant terms before choosing — prior decisions are often in commit messages and are authoritative

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

## Parallel agent execution

When two agents run in parallel, they **must** operate in separate git worktrees.
Agents sharing the same working directory can see each other's uncommitted files,
which causes false-clean builds: agent A sees agent B's unstaged changes and
assumes they are already committed, building logic on top of them. When B finally
commits to its own branch, A's branch is left with a broken build or a stale
dependency on code that never landed there.

**Rule:** Coda must use `isolation: "worktree"` (or manually `git worktree add`)
for every parallel agent spawn. Each agent gets its own checkout; uncommitted
state is never visible across agents.

**Detection:** If a build passes during an agent session but fails on a clean
checkout of the same commit, suspect working-tree cross-contamination from a
parallel agent. Fix: identify which files the other agent left uncommitted,
commit or discard them, then rebase the downstream branch.

### Wave cost optimization

1. **Ada is per-Aria-session, not per-wave.** Ada only runs when Aria ships UI changes. Atlas, Vault, Gate, Luma, Marque, Arch, Quill, Forge, and Bastion sessions never require Ada. A wave with no Aria work skips Ada entirely.

2. **Batch Aria issues.** Aria + Ada is a fixed-cost pair — one Aria session always triggers one Ada audit. Running two small Aria issues in separate waves pays Ada overhead twice. Batch Aria issues into a single wave session where possible (exception: if the issues conflict on the same files).

3. **Scope Ada prompts tightly.** For a new component using existing design token classes (same Tailwind utility classes as already-audited components), Ada should audit keyboard operability, ARIA attributes, and focus visibility only — and explicitly skip the full 7-theme contrast audit. Full contrast audits are warranted only when novel color choices or new token values are introduced.

---

## SOP

Full SOP: `_system/SOP.md` — read at session start.

Key rules (details in SOP.md):
- Session start: pull main, read HANDOFF.md, reconcile open issues, activate agent
- Execution: branch check first, one issue per session, lint + build before PR
- Done: merge to local main, report back, STOP — no push, no issue close, no HANDOFF.md edit
- Flint gate required before "ship it"
- Ship it: rewrite HANDOFF.md, close issue, push main, delete WIP branch

---

## Dev container

See `_system/SOP.md` — "Dev container" section — for security boundaries, network allowlist, and why `--dangerously-skip-permissions` is safe in this environment.
