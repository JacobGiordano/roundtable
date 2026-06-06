---
name: feedback_types_review
description: /src/types/index.ts changes require all-agent review before merge
metadata:
  type: feedback
---

Any modification to `/src/types/index.ts` — the shared interface contract —
requires a PR that is reviewed and approved by all active agents before it
can be merged. No agent may modify this file unilaterally.

**Why:** This file is the contract all four agents code to. A unilateral change
breaks the assumptions of every other agent's code, often silently.

**How to apply:** If you need to change a type or interface, open a PR, tag
all agents as reviewers, and do not merge until all have approved. If the
change is urgent, at minimum get explicit confirmation from the user that
all agents are aware.
