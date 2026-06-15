# All-Hands Audit — Template & Runbook

Use this to repeat the all-hands process. Run it when the issue queue clears, after a major phase ships, or when the team needs a shared map of the current state before deciding what to tackle next.

**Last run:** 2026-06-15 (see `2026-06-15-all-hands.md`)
**Cost:** Most of a 5-hour usage window. Budget accordingly — this is not a cheap operation.

---

## Coda Activation Prompt

Paste this verbatim to start the session:

```
You are Coda.

Please call an all-agent meeting. I'd like for everyone to weigh in on current
state vs future state and where each agent feels there's a delta. I want to
identify optimizations, ways to make the code more DRY and composable, UX and
UI improvements, longterm gains, shortterm gains, and missing features.
```

Coda will launch all agents in parallel automatically. If any agent is missed,
prompt: `including you, I should have 15 agents. did someone get left out?`

The agents most commonly missed are **Spark**, **Flint**, and **Bastion** — they
have no directory ownership and are easy to overlook when building the parallel
launch list.

---

## Per-Agent Brief Structure

Each agent receives a brief with this shape. The six output categories are
the same for every agent; only the domain and files change.

```
You are [Agent], Roundtable's [role]. You own [directory/files].

This is an all-hands meeting called by Coda. Your task: audit your domain and
produce a structured report covering:

1. **Current state** — what exists and how it's built
2. **[Domain-specific framing]** — [tailored to the agent's concerns]
3. **Code quality / DRY / composable** — duplication, abstractions, extraction opportunities
4. **Short-term wins** — things that could be done in a session or two
5. **Long-term gains** — larger architectural or feature investments
6. **Missing features** — things users or contributors would reasonably expect

Read [primary files] carefully. Also check /src/types/index.ts to understand the
full interface surface. Check HANDOFF.md at /_system/HANDOFF.md for current phase context.

Report back in structured markdown. Be specific — name files, line numbers where
relevant. This is a planning input, not implementation — read only, no edits.
```

### Domain-specific category 2 framings by agent

| Agent | Category 2 framing |
|---|---|
| Aria | UX/UI improvements — things that feel incomplete, confusing, or clunky for the end user |
| Atlas | Optimizations — performance, streaming efficiency, error handling gaps |
| Vault | Optimizations — performance, reliability, data integrity improvements |
| Gate | Security posture — risks, gaps, things that should be hardened |
| Scout | Coverage gaps — paths, components, or behaviors that have no tests or thin coverage |
| Ada | Known gaps — components or interactions with suspected or confirmed WCAG 2.1 AA issues |
| Luma | Design system gaps — tokens or components that are missing or inconsistently defined |
| Arch | Type system gaps — missing types, overly broad types, types that leak implementation details |
| Quill | Accuracy gaps — docs that are stale, incomplete, or misleading |
| Forge | Coverage gaps — things that aren't being validated automatically |
| Marque | Completeness — what's missing or undefined in the brand identity |
| Bastion | Coverage gaps — backend routes, auth flows, or database operations with no tests |
| Spark | Gaps in feedback — interactions that are silent or abrupt when they should have a response |
| Flint | Gate gaps — features or behaviors that are partially implemented or feel incomplete |

---

## Launch Checklist

- [ ] Start a fresh Coda session
- [ ] Pull main, check HANDOFF.md
- [ ] Confirm issue queue is clear (or note any in-flight work)
- [ ] Paste the activation prompt above
- [ ] Wait — all agents run in parallel, but the full set takes 15–30 minutes to complete
- [ ] If any agent is missing, Coda will catch it and launch the stragglers
- [ ] Once all 14 reports are in, ask Coda to synthesize
- [ ] Save synthesis to `_system/audits/YYYY-MM-DD-all-hands.md` and commit

---

## What Made the 2026-06-15 Run Effective

**Parallel launch, read-only, no implementation.** Every agent read files but made no edits. This eliminated the risk of one agent's uncommitted changes affecting another's observations.

**Consistent output structure across all agents.** Six categories per report meant the synthesis could be done systematically. When every agent uses the same headings, cross-cutting patterns (e.g., "three agents independently flagged the BuiltInModelId duplication") are easy to spot.

**Flint as the integrator view.** Flint's report is the most valuable for surfacing gaps that fall between domain boundaries — things that exist in the codebase but aren't wired together, or behaviors that multiple agents assumed another agent had handled. Always include Flint.

**Spark for the subjective layer.** Spark caught things no other agent would name — the chunk-entering CSS being dead at runtime, the missing streaming shimmer variants, the absence of an Outrun entry flash. Motion and delight gaps are invisible to domain agents focused on correctness.

**Arch for the type system cross-section.** Arch is the only agent who reads every domain's usage of the type file. The SendMessageFn narrowness finding (public contract narrower than implementation) would not have been found by any single domain agent.

---

## Synthesis Prompt

After all reports are in, ask Coda:

```
Please synthesize all reports into a single document organized by:
- Critical (fix before new features)
- Short-term wins (highest ROI, 1-2 sessions)
- Architecture & DRY
- Missing user-facing features
- Long-term investments
- Process & infrastructure
- Design system
Include a per-agent summary table at the end.
```

Then save the output to `_system/audits/YYYY-MM-DD-all-hands.md` and commit.

---

## Suggested Cadence

| Trigger | Rationale |
|---|---|
| Issue queue hits zero | Natural inflection point; team needs direction |
| End of a major phase | Good retrospective + forward-planning moment |
| Before a new contributor joins | Gives them an honest map of the codebase |
| ~3 months since last run | Enough has changed that a fresh audit is worth it |

Do not run this in the middle of active feature work — the cost is high and the
timing creates noise. Wait for a clean queue.
