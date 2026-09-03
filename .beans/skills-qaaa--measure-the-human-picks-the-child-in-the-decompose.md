---
# skills-qaaa
title: Measure 'the human picks the child' in the Decompose band
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:04:58Z
updated_at: 2026-09-03T09:32:25Z
blocked_by:
    - skills-fqdf
---

SKILL.md's Decompose band says "Split it, then run the method on a single child". It prescribes the sequence but not who chooses. An agent that splits an epic and starts on the child it picked has made the run's most consequential scoping decision while appearing to comply.

Candidate: "Split it, present the split, and run the method on the child the human picks."

What the 2026-09-03 sweep says (`docs/plans/primer-evals/RESULTS-2026-09-03.md`): on `triage-decompose-epic` the primer beats no instruction (+0.24) and ties both the one-liner and the placebo at 0.00. So on today's graders the decomposition section buys nothing over "present a plan and wait", or over a same-shape document with no method content.

How to measure the clause. Adding a grader is an instrument change, and a fourth grader changes the per-run score denominator (thirds to quarters), so the current 0.73 is not comparable to a four-grader score. The plan:

1. Write the grader and its probes; register it in a pre-registration amendment with its own expected direction, before any sweep (an unregistered grader breaks the digest I2 checks).
2. Land the clause in SKILL.md.
3. Sweep all three conditions ($27), merge.
4. Read the new grader's own pass rate per condition from `results/<condition>.json` (each record keeps per-grader verdicts; the merged report does not). That per-grader contrast is the measurement, not the case mean.

Sequence with skills-mtgs: one SKILL.md change per sweep.

- [ ] write the grader, register it, land the clause
- [ ] sweep all three, merge, read the grader's pass rate per condition from the records
- [ ] if it does not separate treatment from the controls, that is evidence the decomposition guidance is not earning its length
