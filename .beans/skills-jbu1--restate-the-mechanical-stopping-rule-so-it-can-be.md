---
# skills-jbu1
title: Restate the 'mechanical' stopping rule so it can be met
status: todo
type: task
priority: normal
created_at: 2026-09-03T09:11:06Z
updated_at: 2026-09-03T09:11:06Z
---

The skill says planning is finished when implementation has become mechanical: "the feature buildable from the artifacts alone". Step 6 adds that a design decision surfacing during the build is a defect in an earlier artifact. Taken literally, you never stop.

Evidence, from running the method on itself: two cold step-6 forks (ten fresh contexts each) built the eval suite from the committed artifacts alone. Round 1 surfaced 76 places the artifacts left an answer open; every blocking and material one was fixed. Round 2 surfaced 92. Per builder the rate was flat (10.9 to 11.5). It does not converge, because every ruling exposes the next question at a finer grain. What changed between rounds was the kind of question: round 1's suite could not run, round 2's ran and passed. The count is not the signal; whether the open decisions change if it works is.

Full record: `docs/plans/primer-evals/6-cold-fork-register.md` (the two rounds and the counts). This is the only queued change to SKILL.md with direct empirical backing, and a change without a falsifiable prediction is a preference, not a finding.

Candidate wording: replace "buildable from the artifacts alone" as the stopping test with one a builder can satisfy: the remaining open decisions no longer change whether it works.

Prediction: not measurable by Tier 1. The falsifiable form is a third fork under the revised rule; builders should be able to say "nothing still open changes whether this works" and be right. If round-3 builders still surface blocking items, the revision is wrong.

- [ ] write the revised stopping rule into SKILL.md (step 5/6 wording)
- [ ] run a third cold fork on a real feature and count blocking items
- [ ] record the outcome here and in a pre-registration amendment
