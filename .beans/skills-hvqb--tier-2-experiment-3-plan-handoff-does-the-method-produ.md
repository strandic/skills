---
# skills-hvqb
title: 'Tier 2, experiment 3: plan handoff — does a fresh implementer build better software from the method''s plan?'
status: todo
type: task
priority: high
created_at: 2026-09-08T13:41:11Z
updated_at: 2026-09-08T13:41:11Z
parent: skills-c25p
---

The second outcome experiment, and the only one that reaches the method's actual claim: planning is finished when the feature can be built from the artifacts alone. Design and price in docs/plans/primer-evals/tier-2-backlog.md (experiment 3); this bean is the brief for a primer-run session.

Why now: experiment 2 (skills-g1qk) is closed. On the seeded fixture the primer's step 4 named fewer planted defects than the placebo's read-through and no more than no instruction; every run that started the service named nothing. Whether that costs anything in the software that comes out is what this experiment measures, and nothing before it could.

The one question: does software built by a fresh-context implementer from the treatment's plan pass more hidden tests than software built from the placebo's plan, the one-liner's, and no instruction's?

Two stages, from the backlog:
- Stage A, generate plans. Each condition runs on the same feature request against the same fixture with every gate pre-approved, and produces a bundle: the plan documents plus whatever markers it placed in the source. Nothing is scored.
- Stage B, build from the plans. Each bundle goes to a fresh-context agent with one instruction: implement this feature using only the documents in this directory, do not ask questions. A hidden test suite runs against what it built. Its pass rate is the result.

The rule every Tier 2 instrument follows: nothing the judge or the tests see may be written by anyone who has read SKILL.md. The hidden tests are written by an isolated agent that has seen the feature request and the fixture but not the skill or any plan. No condition sees them. Experiment 2's ledger machinery (isolation digests, I9) carries over.

Conditions: treatment, placebo, run-oneliner (or the Tier 1 one-liner; decide at step 0), none. Two features on the notesvc fixture; the backlog says two is too few to generalise from and five or six is defensible, so the registration must say what two features can and cannot support. Sample: about twenty hidden tests per feature, five runs per condition per stage, smallest detectable difference in pass rate about 0.18.

Secondary measures, registered as description: whether the build runs, whether the fixture's existing tests still pass, turns and cost of the implementer.

What step 0 has to settle, and nothing here decides:
1. How "every gate pre-approved" is done. A replayed transcript cannot approve gates the agent has not yet produced. Options: a driver that answers every gate with proceed (a second harness invocation per gate, or a case prompt that pre-approves in advance), or one long run with the approval written into the prompt. Recon must show which one the harness can actually run.
2. How stage B is scored. The harness has no grader that runs a command after the run. The build has to be tested outside the harness (a script over kept sandboxes) or the implementer has to write the test outcome to a file a file_exists or regex grader reads, with the sentinel proving nothing else moved. Either way the merger gains a record kind it does not have.
3. The second feature. Per-user rate limiting is the first (the fixture, the markers and the transcript exist). The second must be a medium structural change on the same service with a fresh hidden suite; candidates in tier-2-backlog.md.
4. Whether stage A reuses the Tier 1 replay transcripts at all, or starts from the feature request alone. Starting from the request measures the whole method; starting from a cleared gate measures one step.

Cost, from the backlog: about 200 runs, $100 to $230, several session-limit windows, half a day per feature to review the hidden tests. Read before step 0: docs/plans/primer-evals/tier-2-backlog.md (experiment 3 and the rules for reporting), evals/seven-steps-primer-defects/PRE-REGISTRATION.md (the group and floor machinery to reuse, and Amendments 1 and 2), docs/plans/primer-evals/RESULTS-2026-09-07-defects.md (what experiment 2 found and did not).

Constraints carried over: pre-register before any run (I2/I8); one registration digest per suite; a sibling suite, nothing added to the two existing ones; the human runs the sweeps from a terminal; records committed under docs/plans/primer-evals/records/; thirty judge or test verdicts checked by hand before the table is read, with the check's independence stated honestly if it is not.
