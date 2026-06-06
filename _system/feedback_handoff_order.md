---
name: feedback_handoff_order
description: Update HANDOFF.md before committing and pushing — not after
metadata:
  type: feedback
---

Always update HANDOFF.md before the final commit and push, not after. If the
push fails, the repo's HANDOFF.md should already reflect the current state.

**Why:** If something goes wrong after pushing the fix but before updating
HANDOFF.md, the repo ends up with a stale handoff document.

**How to apply:** At session close-out, write HANDOFF.md → stage it → commit
(include it in the fix commit or as a chore commit) → push.
