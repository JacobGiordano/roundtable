---
name: feedback_branch_check
description: Always check for existing branches before creating a new one
metadata:
  type: feedback
---

Before creating a branch for any issue, run:

```bash
git branch -a | grep <issue-number>
```

If a match exists, stop immediately and report it to the user. Another agent
may already be working that issue. Do not proceed without explicit confirmation.

**Why:** Two agents creating branches for the same issue will produce conflicting
work and a messy merge situation, especially given the parallel agent model.

**How to apply:** Make this the first git operation of every session, before
any file changes or branch creation.
