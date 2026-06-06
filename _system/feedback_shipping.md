---
name: feedback_shipping
description: Never merge to main or push without explicit user authorization
metadata:
  type: feedback
---

Do not merge the WIP branch into main, push to the repo, or delete the WIP
branch without the user explicitly saying so — even if all tests pass and the
work looks complete.

**Why:** The user may want to review the diff, run it locally, or batch it with
other work before it goes to main.

**How to apply:** At session close-out, report what's done and wait for
explicit "go ahead" before any git operations that affect main or the remote.
