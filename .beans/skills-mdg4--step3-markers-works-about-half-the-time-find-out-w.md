---
# skills-mdg4
title: step3-markers works about half the time — find out why
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:05:18Z
updated_at: 2026-09-01T11:05:18Z
---

`step3-markers-in-source` is the one behaviour no control produces. In the 2026-09-03 sweep (`docs/plans/primer-evals/RESULTS-2026-09-03.md`) the treatment scores 0.85 and both controls score 0.25 on every run. It is capability evidence (single arm, replayed transcript), and it is the strongest evidence in the suite that the method's specific content does something.

The treatment's runs are 0.75, 1.00, 0.75, 1.00, 0.75. Three of five runs lose the same quarter. Before it is quoted as a headline it is worth knowing which grader fails on those runs and why. The controls' flat 0.25 also says one of the four graders passes without the skill; that grader is measuring the transcript, not the behaviour.

The first sweep (withdrawn, see Amendment 4 in `evals/seven-steps-primer/PRE-REGISTRATION.md`) had this case at 0.47 with two zero runs. Under the corrected `ablation: none` and judge prompts, the instability is smaller and the zeros are gone.

Note, 2026-09-03: the raw records (`results/*.json`, gitignored) were deleted with the feature worktree after the merge. The committed report keeps per-run scores but not per-grader verdicts. The harness's per-run trace directories may survive under the system temp dir (`claude-eval-*`); otherwise the first item needs a treatment-only sweep of this case (`--condition treatment`, about $2), which is not mergeable on its own but is enough to read the verdicts.

- [ ] read the three 0.75 runs: which grader fails, and is it the skill, the replay transcript, or a grader too strict about `not-a-doc-list`
- [ ] identify the grader the controls pass at 0.25 and decide whether it should be a with-only indicator
- [ ] if it is the skill, record it as a finding about step 3 and open a bean for the change
