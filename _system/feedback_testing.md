---
name: feedback_testing
description: Run focused tests only — full suite only when explicitly asked
metadata:
  type: feedback
---

When work is complete, run only the tests that cover the feature or files
changed. Do not run the full test suite unless the user asks for it or the
scope of changes clearly warrants it.

**Why:** Full suite runs are slow and surface pre-existing failures unrelated
to the current work, which creates noise and wastes time.

**How to apply:** After completing work, assess which test file(s) are relevant,
run those, and report. Offer to run the full suite — don't do it automatically.
