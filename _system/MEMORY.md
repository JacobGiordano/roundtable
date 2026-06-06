# Memory Index

- [HANDOFF.md before pushing](feedback_handoff_order.md) — update HANDOFF.md before the final commit/push, not after
- [Never ship without approval](feedback_shipping.md) — don't merge to main or push until explicitly authorized, even if all tests pass
- [Testing: focused tests only](feedback_testing.md) — run only targeted tests for the feature in work; full suite only when explicitly asked
- [Types file needs all-agent review](feedback_types_review.md) — any change to /src/types/index.ts requires a PR reviewed by all active agents before merge
- [Branch before everything](feedback_branch_check.md) — always run `git branch -a | grep <issue-number>` before creating a branch; stop and report if a match exists
