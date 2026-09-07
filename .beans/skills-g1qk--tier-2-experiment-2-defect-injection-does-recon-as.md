---
# skills-g1qk
title: 'Tier 2, experiment 2: defect injection — does recon-as-a-run find defects a read does not?'
status: in-progress
type: task
priority: high
created_at: 2026-09-06T06:46:56Z
updated_at: 2026-09-07T07:30:46Z
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

- [x] step 0: plan (fixture, defects, score, cost) — gate cleared 2026-09-06; docs/plans/primer-evals/defect-injection/0-plan.md on worktree feat/defect-injection
- [x] steps 1–3: types, signatures, markers — gates 1, 2, 3 cleared 2026-09-06/07 (a sibling suite, grader groups and a declared replay case rather than a new record kind)
- [x] step 4: recon — gate 4 cleared 2026-09-07; 4-recon.md. Finding: on this fixture no defect is run-only (three cold readers named every one) and a faithful step-4 run meets none of them; ruled option 1 — one registered group, directions as the evidence predicts (−1 vs placebo)
- [x] the registration — evals/seven-steps-primer-defects/PRE-REGISTRATION.md, cleared for its own proceed 2026-09-07; the Tier 1 file is not amended
- [x] step 6: the cold build — gate 6 cleared 2026-09-07; 6-cold-fork-register.md (42 entries, 6 blocking, none re-opening a gate); 505 tests green, no drift, frozen artifacts untouched
- [ ] step 7: sweep, merge, results section



2026-09-06: gate 0 cleared. Rulings: sibling suite evals/seven-steps-primer-defects/; replay through gate 3 written for both methods; conditions treatment, placebo, run one-liner (the Tier 1 one-liner is inert here); grader groups with a registered headline row and a per-group floor; 10 runs per condition both arms; the instrument gets its own gate at step 4 and the registration its own proceed. The 'pre-registration amendment' item below is the new suite's own PRE-REGISTRATION.md; the Tier 1 file is not amended.



2026-09-07: step 5 (I9–I13) cleared; step 6 running cold — a fresh context building from the artifacts alone. Step 7 is the sweep from a terminal (~10 h, ~$30–75), merge, records, results section, 30 hand-labelled verdicts, the read-only diagnostic, sandbox cleanup.


2026-09-07: gate 6 cleared. The cold build's register is the step-6 artifact; the owner fixed the two fixture READMEs the build left unwritten. Step 7 next: confirmation runs, then the human runs the sweep from a terminal.
