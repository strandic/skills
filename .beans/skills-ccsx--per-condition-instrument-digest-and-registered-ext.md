---
# skills-ccsx
title: Per-condition instrument digest and registered extra conditions
status: completed
type: task
priority: high
created_at: 2026-09-03T09:32:25Z
updated_at: 2026-09-03T12:45:28Z
---

Today every sweep record carries one instrument digest over the whole suite directory, including every condition's SKILL.md. So adding a fourth condition (an ablated treatment, say) changes the digest and voids the three existing records: a $9 experiment costs $36. The merger also hard-codes the three condition ids and refuses a contrast it has no registered direction for.

Change the runner and merger so a new condition can be swept alone against existing controls:

1. Split the digest: a shared part (cases, graders, fixture, transcripts) stamped on every record, and a per-condition part (that condition's SKILL.md) stamped on its own record. I2b compares the shared part across records and against the tree; the per-condition part is compared against the tree for that condition only.
2. Let the merger take extra condition ids from the pre-registration (a registered list, not a code constant), each with its registered contrasts against the controls. The three existing ids and their directions do not move (I8).
3. Keep the refusal for a condition present in the registration but missing from `results/`.

Prerequisite for the section-ablation experiment (skills-c25p, first experiment). Design in `docs/plans/primer-evals/tier-2-backlog.md`.

- [ ] split the digest, with tests that a new condition does not void the others and a grader edit voids all
- [ ] registered condition list in PRE-REGISTRATION.md, read by the merger; amendment
- [ ] a full-suite run of the existing three records still merges unchanged


Done 2026-09-03, Amendment 5 in PRE-REGISTRATION.md. scripts/instrument.mjs now has
`instrumentDigest` (shared: everything except conditions/) and `conditionDigest(suite, id)`;
records carry `instrumentSha` + `conditionSha`; I2b checks the shared half across records and
the per-condition half per record against the tree. The condition list is the registration's
`conditions` array (any `[a-z][a-z0-9-]*` id except `none`), read by both runner and merger;
the parser refuses a condition without a direction for every delta case. README "Adding a
condition" documents the procedure. 347 tests.

Cost note: the re-sweep's records are gone and carried no conditionSha anyway, so ONE full
sweep of the three conditions is required before any added condition can merge. Do it after
skills-ie78's grader corrections (they change the shared digest), not before.

- [x] split the digest, with tests that a new condition does not void the others and a grader edit voids all
- [x] registered condition list in PRE-REGISTRATION.md, read by the merger; amendment (Amendment 5)
- [x] a full-suite run of the existing three records still merges unchanged — the records were deleted with the worktree before this landed, so this was checked on the merger's fixture set (three records + one added condition, all invariants pass), not on real records. The next full sweep is the real check.
