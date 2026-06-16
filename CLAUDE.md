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
└── _system/          ← HANDOFF.md, MEMORY.md, this file
```

## Agents

Project-local agent profiles live in `.claude/agents/`. Claude Code loads them
automatically — no installation required.

**Invoke the correct agent for every task — do not work without one.**

| Work type | Agent |
|-----------|-------|
| UI work (`/src/ui`) | `Aria` |
| Model integrations (`/src/models`) | `Atlas` |
| Storage (`/src/storage`) | `Vault` |
| Auth & settings (`/src/auth`) | `Gate` |
| Design system (`/_design`) | `Luma` |
| Brand work (`/_design/brand/`) | `Marque` |
| Whimsy & micro-interactions | `Spark` (called by Aria in Phase 2+) |
| `/src/types/index.ts` changes | `Arch` 🏛️ |
| `CLAUDE.md` changes | `Arch` 🏛️ |
| New phase kickoff | `Coda` |
| Multi-agent coordination | `Coda` |
| Pre-"ship it" gate review (required before every ship) | `Flint` |
| Backend (`/backend`) | `Atlas` |
| Documentation (`README.md`, `CONTRIBUTING.md`, `/docs/`) | `Quill` 🪶 |
| Integration & regression tests — smoke suite must be green at "done" time | `Scout` 🔭 |
| Accessibility audits — required after every Aria session before merging to local main | `Ada` ♿ |
| GitHub Actions workflows (`.github/workflows/`) | `Forge` ⚙️ |
| Backend tests (`/backend/tests/`) | `Bastion` 🛡️ |

Example activation prompt:
> "Activate Aria. Project: Roundtable. Issue: [Aria] Chat interface layout.
> Read `_system/ISSUES.md` for the full spec for this issue and implement it."

## Agent boundary rules — NON-NEGOTIABLE

Most agents own exactly one directory; a few (Arch, Quill) own a defined set of files instead. These are hard walls. Test agents (Scout, Ada) own test directories and read application code freely but must never write application code:

| Agent | Owns | Must never touch |
|-------|------|--------------------|
| Aria  | `/src/ui` | `/src/models`, `/src/storage`, `/src/auth` |
| Atlas | `/src/models` | `/src/ui`, `/src/storage`, `/src/auth` |
| Vault | `/src/storage` | `/src/ui`, `/src/models`, `/src/auth` |
| Gate  | `/src/auth` | `/src/ui`, `/src/models`, `/src/storage` |
| Luma  | `/_design` | `/src/**` (specs only — no code) |
| Marque | `/_design/brand/` | `/src/**`, `/_design/tokens/`, `/_design/themes/`, `/_design/specs/` |
| Arch 🏛️ | `/src/types/index.ts`, `CLAUDE.md` | `/src/ui`, `/src/models`, `/src/storage`, `/src/auth`, `/_design` |
| Spark | *(none — called by Aria)* | owns nothing; produces specs Aria applies |
| Coda  | *(none — coordinates)* | owns nothing; sequences agents, no implementation |
| Flint | *(none — reviews live app)* | owns nothing; read-only phase gate verification |
| Quill 🪶 | `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `/docs/` | `/src/ui`, `/src/models`, `/src/storage`, `/src/auth`, `/_design`, `/src/types/index.ts`, `CLAUDE.md`, `_system/HANDOFF.md` |
| Scout 🔭 | `/src/tests/` (excluding `/src/tests/a11y/`) | application code in any agent directory, `/src/types/index.ts`, `CLAUDE.md`, `/_design`, root-level docs |
| Ada ♿ | `/src/tests/a11y/` | application code in any agent directory, `/src/models`, `/src/storage`, `/src/auth`, `/src/types/index.ts`, `CLAUDE.md`, root-level docs |
| Forge ⚙️ | `.github/workflows/` | `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, `/src/**`, `/backend/src/**`, `CLAUDE.md`, `/_design`, root-level docs |
| Bastion 🛡️ | `/backend/tests/` | `/backend/src/**` (Atlas owns), `/src/**`, `/src/types/index.ts`, `CLAUDE.md`, `/_design`, root-level docs |

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
- NEVER skip the branch check before starting work (see SOP step 4)
- NEVER push to remote or close a GitHub issue without explicit user authorization ("ship it")
- Merging the WIP branch into local `main` for dev-server review is permitted at "done" time — push to remote is not
- NEVER update HANDOFF.md before "ship it" — it is written and committed as the first act of the ship step
- Keep HANDOFF.md under ~30 lines — it is a whiteboard, not a log
- Do not introduce new dependencies without noting them in the PR description
- `npm run lint` and `npm run build` must pass before any PR is opened
- **Each agent works exactly one issue per session, then stops and waits for explicit user authorization before starting the next one — no exceptions**

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

**Always follow this SOP. Skip asking about planning — execute directly unless
the user explicitly requests a plan.**

### Session start

1. Pull `main` and check for changes in `HANDOFF.md` before doing anything else.
2. Review `HANDOFF.md` for current phase, active issues, and gotchas.
3. Cross-reference `gh issue list` against `git log main --oneline`: close any
   issues whose work is already merged but still open, then update `HANDOFF.md`
   if stale. Also catch anything closed manually that isn't reflected yet.
4. Activate the appropriate agent for the work at hand (see table above).

### Execution

5. Before creating a branch for an issue, run `git branch -a | grep <issue-number>`.
   If a match exists, stop and tell the user — another agent may already be on it.
   Do not proceed without explicit confirmation.
6. Assess if a new branch is necessary and create it. A new branch is almost
   always preferred. Branch naming: `{issue-number}-{agent}-{short-description}`
   e.g. `12-aria-chat-layout`.
7. **The scope of a session is exactly one issue.** Complete it fully, then stop. Do not begin a second issue without explicit user authorization — even if the next issue is obviously unblocked and small.
8. Execute directly against the prompt (skip planning unless explicitly requested).
9. If planning is requested: plan the implementation and request confirmation
   before proceeding.
10. Before opening a PR, verify:
    - `npm run lint` passes
    - `npm run build` passes
    - No imports outside your assigned directory (except permitted exceptions)
    - No modifications to `/src/types/index.ts` without cross-agent review
11. Give a brief honest assessment of whether testing is worthwhile for the work done.
    Then ask if testing is desired. If yes, create and run tests with Vitest.
    Only run the full suite if asked or if the work warrants it.
12. If bugs are found, recap them and ask if fixing is desired. Iterate until
    tests pass.
13. **UI sessions only (any Aria session):** activate Ada to audit every changed
    component against WCAG 2.1 AA before declaring done. Ada reads the changed
    files and the live DOM (via dev server if needed). Her report must be reviewed
    before merging the WIP branch to local main. Blocker-level findings must be
    fixed in the same session. Advisory findings must be filed as issues before
    moving on.

### Session close-out (required)

#### Step 1 — "done"

14. When the issue is complete: run Scout's smoke test suite (`npm run test:e2e`
    or `npm run test:run` for the full Vitest suite, whichever applies) on the
    WIP branch before merging. If smoke tests fail, diagnose and fix, or file a
    blocking issue — do not merge with a red suite. Then merge the WIP branch
    into local `main` so the user can verify in the dev server. Report back —
    "merged to local main, ready for dev-server review." Stop. Do not push to
    remote, do not close the GitHub issue, do not touch `HANDOFF.md`. Wait for
    explicit authorization to ship.

#### Step 1.5 — Flint gate (required before "ship it")

15. Before proceeding to "ship it", activate Flint to verify the work against
    the issue's acceptance criteria and the live app. Flint's sign-off is
    required to proceed. If Flint finds blocker-level issues, fix them and
    re-run Flint. Advisory findings may be filed as issues and deferred.

#### Step 2 — "ship it" (requires explicit user authorization)

16. **Rewrite `HANDOFF.md` first** — not append. Replace the entire contents
    with:
    - Last updated date
    - Current phase
    - Active agent for next session
    - Last issue closed and outcome
    - Decisions made this session that affect future work
    - Next issue(s) in priority order
    - Any live gotchas or blockers

    Stage `HANDOFF.md` and commit as `chore: update handoff` (or include it in
    the final fix commit if one is needed).

17. Close the GitHub issue: `gh issue close <n> --comment "..."` — include the
    merge commit hash, decisions made, and anything the next agent needs to know.

18. Push `main` to remote and delete the WIP branch. No PRs needed for solo
    work. Changes to `/src/types/index.ts` require a PR reviewed and approved by
    all active agents — agents handle this review with each other; the user does
    not need to be in the approval loop.

**The rule:** `HANDOFF.md` is a whiteboard. Erase and rewrite at ship time.
Git is the log.

---

## Dev container

This project runs inside a VS Code dev container (`.devcontainer/`). The
container provides a sandboxed environment where `claude --dangerously-skip-permissions`
is safe to use.

### Security boundaries

- **No secrets on the filesystem.** Agents must never write API keys,
  credentials, or tokens to any file. The container has no host credential
  mounts (no `~/.ssh`, no `~/.aws`).
- **API keys via browser localStorage only.** Model provider keys (Anthropic,
  OpenAI, etc.) are handled exclusively by Gate through browser `localStorage`.
  Never pass them via environment variables, `.env` files, or any other
  filesystem path.
- **Network allowlist.** The firewall (`init-firewall.sh`) restricts outbound
  traffic to the following domains only:
  - `api.anthropic.com`
  - `api.openai.com`
  - `api.github.com`
  - `registry.npmjs.org`
  - `github.com`
  - `raw.githubusercontent.com`

  If an agent's work requires a domain not on this list, it must flag it to the
  user rather than assuming network access will succeed. Do not add domains to
  the firewall script without user authorization.

  **Gotcha — OpenAI CDN IP drift:** `api.openai.com` is CDN-backed. The
  firewall resolves it to a set of IPs at container start time and bakes them
  into ipset. Those IPs can rotate mid-session, causing intermittent connection
  failures to OpenAI that look like network errors. Fix: restart the container
  (this re-runs `init-firewall.sh` and re-resolves). No code change needed.

### Why `--dangerously-skip-permissions` is safe here

The container + iptables firewall + Claude Code sandbox config (`allowedDomains`,
`denyRead`) together enforce the same isolation that permission prompts provide
interactively. Agents operate on the workspace volume only; host files are
never in scope.
