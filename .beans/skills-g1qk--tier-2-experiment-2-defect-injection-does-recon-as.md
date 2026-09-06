---
# skills-g1qk
title: 'Tier 2, experiment 2: defect injection — does recon-as-a-run find defects a read does not?'
status: todo
type: task
priority: high
created_at: 2026-09-06T06:46:56Z
updated_at: 2026-09-06T06:46:56Z
parent: skills-c25p
---

The first outcome experiment, scoped to the primer's one unique piece of content. Design and price in docs/plans/primer-evals/tier-2-backlog.md (experiment 2); this bean is the brief for a primer-run session.

Why this one: Tier 1 is exhausted on this fixture (PRE-REGISTRATION.md, results section for ablation 4). On behaviour the primer's content is indistinguishable from its shape; the method's actual claim is about the software, and its unique content, step 4 recon as a run, is reached by no Tier 1 case.

The one question: does the recon section find injected defects that a placebo (same gates, no recon content), a one-liner and no skill do not?

Smallest version that answers it (to be settled at step 0):
- fixture: a service with N injected run-only defects (ones a read cannot see: a seam that fails only at the true input), each with a hidden test
- conditions: treatment, placebo, oneliner, none (the existing four, no ablations)
- score: hidden tests passed after the run, per condition; registered direction treatment > placebo on that score
- runs: enough per cell to clear a floor measured the same way as Tier 1's
- cost: register the estimate before running; the backlog says ~20× a Tier 1 sweep

Constraints carried over: pre-register before any run (I2/I8), one registration digest, the runner's per-case invocations and stop rules, records committed under docs/plans/primer-evals/records/.

- [ ] step 0: plan (fixture, defects, score, cost) — gate
- [ ] steps 1–3: types, signatures, markers in the runner/merger for a Tier 2 record kind
- [ ] step 4: recon — build the fixture and run one condition once
- [ ] pre-registration amendment with the direction and the cost
- [ ] sweep, merge, results section
