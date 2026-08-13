# Contributing to Roundtable

Roundtable uses an **agent-based development model** powered by Claude Code.
Each area of the codebase has a dedicated agent with hard ownership boundaries.
Understanding these boundaries is the single most important thing a contributor
needs to know before opening a PR.

## Agent directory ownership

Each agent owns exactly one directory or a defined set of files. These walls are
non-negotiable — a PR that modifies files outside an agent's assigned scope will
be rejected.

| Agent | Owns | Never touches |
|-------|------|---------------|
| **Aria** | `/src/ui` | `/src/models`, `/src/storage`, `/src/auth` |
| **Atlas** | `/src/models` | `/src/ui`, `/src/storage`, `/src/auth` |
| **Vault** | `/src/storage` | `/src/ui`, `/src/models`, `/src/auth` |
| **Gate** | `/src/auth` | `/src/ui`, `/src/models`, `/src/storage` |
| **Marque** | `/_design/brand/` | `/_design/tokens/`, `/_design/themes/`, `/_design/specs/`, `/src/**`, root-level docs, `CLAUDE.md`, `_system/` |
| **Luma** | `/_design` | `/src/**` (specs only — produces no code) |
| **Arch** | `/src/types/index.ts`, `CLAUDE.md` | Everything else |
| **Quill** | `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `LICENSE`, `.github/`, `/docs/` | `/src/**`, `/_design`, `CLAUDE.md`, `_system/` |
| **Scout** | `/src/tests/` | Application code in any agent directory; never fixes bugs, only finds them |
| **Ada** | `/src/tests/a11y/` | Application code in any agent directory; never fixes components, only documents findings |
| **Spark** | *(called by Aria)* | Produces micro-interaction specs; no directory ownership |
| **Coda** | *(coordinator)* | Sequences agents; no directory ownership |
| **Flint** | *(reviewer)* | Read-only phase gate; no directory ownership |
| **Forge** | `.github/workflows/`, `/backend/src/` (security middleware, rate limiting, infrastructure-level concerns only) | `/src/**`, `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md`, root-level docs, `CLAUDE.md` |
| **Bastion** | `/backend/tests/` | `/backend/src/**`, `/src/**`, root-level docs, `CLAUDE.md` |
| **Gauge** | *(cross-cutting reviewer — no directory ownership)* | Reads all dirs; proposes fixes only — never commits |
| **Tempo** | *(cross-cutting performance reviewer — no directory ownership)* | Reads all dirs; proposes fixes only — never commits |
| **Rune** | *(cross-cutting security reviewer — no directory ownership)* | Reads all dirs; proposes fixes only — never commits |
| **Vera** | *(cross-cutting privacy advisor — no directory ownership)* | Reads all dirs; proposes fixes only — never commits |

Cross-agent communication happens **only** through the interfaces defined in
`/src/types/index.ts`. If your change needs something from another agent's
directory, the right move is to define or extend an interface — not to import
across the boundary.

**Exception:** Pure utility functions exported from `/src/models/index.ts`
(e.g. `getSessionTokenUsage()`) may be imported by Aria. Any such exception
must be documented with a comment at the import site.

## `/src/types/index.ts` — the shared contract

This file is the contract between all agents. Changes to it follow a stricter
process:

- **Only Arch may write to this file.**
- **One PR at a time** — no concurrent types PRs. A collision here breaks all
  four agent domains simultaneously.
- Changes require review by all active agents before any agent proceeds with
  implementation.
- No implementation code — types and interfaces only.

If your change requires a new or modified type, open an issue tagged `arch`
and describe the interface need. Arch will produce the PR.

## Setting up with Claude Code agents

Roundtable's agent profiles live in `.claude/agents/` and load automatically
when you open the project in Claude Code. No installation required.

### Prerequisites

- [Claude Code](https://claude.ai/code) (CLI or IDE extension)
- A Claude API key with access to Claude Sonnet or Opus

### Activating an agent

Address the appropriate agent in your prompt based on what you're working on:

```
Activate Aria. Project: Roundtable. Issue: [Aria] <issue title>.
Read _system/ISSUES.md for the full spec and implement it.
```

Agents read `HANDOFF.md` at session start to understand the current phase and
what's in flight. Always check `HANDOFF.md` before starting work.

### Agent profiles

| Agent | Description |
|-------|-------------|
| **Aria** | React components, chat layout, model selector, token display |
| **Atlas** | API integrations, streaming, parallel broadcast, token tracking, self-hosted backend |
| **Vault** | LocalStorage provider, session management, ghost mode, export |
| **Gate** | API key management, theme storage, backend auth, accent color persistence |
| **Marque** | Brand identity: logo mark, app icon grid, brand palette, typography selection — upstream of Luma (no code) |
| **Luma** | Design tokens, theme files, component specs (no code) |
| **Arch** | Cross-agent TypeScript interfaces; `CLAUDE.md` changes |
| **Quill** | Root-level documentation: `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/` templates |
| **Scout** | Integration and regression tests in `/src/tests/`; cross-domain coverage audits; finds bugs and opens tickets — never fixes them |
| **Ada** | WCAG 2.1 AA accessibility audits in `/src/tests/a11y/`; axe-core tests, keyboard navigation, contrast across all themes — finds violations and opens tickets for Aria or Luma |
| **Spark** | Micro-interactions and delight work (called by Aria in Phase 2+) |
| **Coda** | Multi-agent coordination, phase kickoff, dependency sequencing |
| **Flint** | Phase gate validation — verifies acceptance criteria before advancing |
| **Forge** | GitHub Actions workflows and `/backend/src/` infrastructure — lint, build, test, release, docker publish, security middleware, and rate limiting |
| **Bastion** | Backend test suite in `/backend/tests/` — API integration tests, route tests, auth flow tests, database contract tests; counterpart to Scout |
| **Gauge** | Cross-cutting code reviewer — logic bugs, dead code, and correctness checks across all agent domains; called before PRs with non-trivial logic changes |
| **Tempo** | Cross-cutting performance engineer — bundle size, streaming latency, render throughput; called when bundle size grows or streaming behavior changes |
| **Rune** | Cross-cutting security reviewer — OWASP Top 10, secure code review, API key hygiene; called before PRs touching auth flows, key handling, or backend routes |
| **Vera** | Cross-cutting privacy advisor — PII scope, retention posture, ghost session guarantees, export safety; called when storage formats or export features change |

### One issue per agent per session

Each agent works exactly one issue per session, then stops. Do not begin a
second issue without explicit authorization. This prevents scope creep and
cross-agent collisions.

## Contributing without the agent setup

You don't need Claude Code or the agent configuration to contribute. The agent
model is how the maintainer works — it's not required for external PRs.

**Fixing a bug or typo**

1. Identify which directory the code lives in (see the ownership table above)
2. Make your change in a branch
3. Run `npm run lint` and `npm run build` — both must pass
4. Open a PR describing what you changed and why

**Proposing a feature**

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). If
the agent scope field is unclear, just describe what the feature does — the
maintainer will route it.

**Questions**

Open a [GitHub Discussion](../../discussions) or file an issue with the `question`
label.

## Before opening a PR

- `npm run lint` passes (zero warnings)
- `npm run build` passes
- No imports outside your assigned directory (except documented exceptions)
- No modifications to `/src/types/index.ts` without going through Arch

## Branch naming

```
{issue-number}-{agent}-{short-description}
```

Examples: `12-aria-chat-layout`, `5-atlas-claude-integration`

## Commit style

Follow the existing commit message format in `git log`:

```
feat(ui): add directed reply affordance to message bubbles
fix(models): handle streaming timeout for Gemini responses
chore: update handoff for issue #12
```

## Automated commits on main

A GitHub Actions workflow syncs the OpenRouter model catalog to `models.json`
and `public/models.json` every day at 06:00 UTC. When new or updated models are
available, the workflow commits directly to `main` with the message:

```
chore(models): sync models.json from OpenRouter [skip ci]
```

If you have a local branch open when this runs, remote `main` will have a commit
yours doesn't. This is expected and always safe to merge — only those two JSON
files change. Before you push, pull the latest main into your branch:

```
git pull --no-rebase origin main
```

Resolve any conflict in `models.json` or `public/models.json` by accepting the
remote version (it is always the authoritative one). Your feature code is
unaffected.

## Questions

Open an issue or start a discussion. Check `_system/HANDOFF.md` for the current
phase and active work — it is rewritten every session and reflects the live state
of the project.
