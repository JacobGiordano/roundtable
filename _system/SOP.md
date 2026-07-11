# Roundtable — Full SOP

Read this at session start. It is the operative procedure for every agent session.

**Always execute directly against the prompt unless the user explicitly requests a plan.**

---

## Session start

1. Pull `main` and check for changes in `HANDOFF.md` before doing anything else.
2. Review `HANDOFF.md` for current phase, active issues, and gotchas.
3. Cross-reference `gh issue list` against `git log main --oneline`: close any
   issues whose work is already merged but still open, then update `HANDOFF.md`
   if stale. Also catch anything closed manually that isn't reflected yet.
4. Activate the appropriate agent for the work at hand (see agent table in `CLAUDE.md`).

## Execution

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

    **Coda-coordinated wave exception:** If Aria was spawned by Coda as a
    subagent (not activated directly by the user), Aria must skip this step
    entirely. Do not activate Ada. Stop after reporting completion back to Coda.
    Coda owns Ada orchestration in wave sessions — it queues Ada after all Aria
    work in the wave is done. Spawning Ada from inside an Aria subagent causes
    Ada to run twice and burns double the usage budget.

## Session close-out (required)

### Step 1 — "done"

14. When the issue is complete: run Scout's smoke test suite (`npm run test:e2e`
    or `npm run test:run` for the full Vitest suite, whichever applies) on the
    WIP branch before merging. If smoke tests fail, diagnose and fix, or file a
    blocking issue — do not merge with a red suite. Then merge the WIP branch
    into local `main` so the user can verify in the dev server. Report back —
    "merged to local main, ready for dev-server review." Stop. Do not push to
    remote, do not close the GitHub issue, do not touch `HANDOFF.md`. Wait for
    explicit authorization to ship.

### Step 1.5 — Flint gate (required before "ship it")

15. Before proceeding to "ship it", activate Flint to verify the work against
    the issue's acceptance criteria and the live app. Flint's sign-off is
    required to proceed. If Flint finds blocker-level issues, fix them and
    re-run Flint. Advisory findings may be filed as issues and deferred.

### Step 2 — "ship it" (requires explicit user authorization)

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

19. Run `git worktree prune` after every wave. Stale worktrees left behind by
    agent sessions contaminate `tsc` — it follows worktree source paths and
    reports type errors from old agent code as if they were in the current
    workspace. Pruning takes one second and prevents false build failures.

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
