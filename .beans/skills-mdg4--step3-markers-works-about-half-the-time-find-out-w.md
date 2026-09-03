---
# skills-mdg4
title: step3-markers works about half the time — find out why
status: completed
type: task
priority: high
created_at: 2026-09-01T11:05:18Z
updated_at: 2026-09-03T09:53:49Z
---

`step3-markers-in-source` is the one behaviour no control produces. In the 2026-09-03 sweep (`docs/plans/primer-evals/RESULTS-2026-09-03.md`) the treatment scores 0.85 and both controls score 0.25 on every run. It is capability evidence (single arm, replayed transcript), and it is the strongest evidence in the suite that the method's specific content does something.

The treatment's runs are 0.75, 1.00, 0.75, 1.00, 0.75. Three of five runs lose the same quarter. Before it is quoted as a headline it is worth knowing which grader fails on those runs and why. The controls' flat 0.25 also says one of the four graders passes without the skill; that grader is measuring the transcript, not the behaviour.

The first sweep (withdrawn, see Amendment 4 in `evals/seven-steps-primer/PRE-REGISTRATION.md`) had this case at 0.47 with two zero runs. Under the corrected `ablation: none` and judge prompts, the instability is smaller and the zeros are gone.

Note, 2026-09-03: the raw records (`results/*.json`, gitignored) were deleted with the feature worktree after the merge. The committed report keeps per-run scores but not per-grader verdicts. The harness's per-run trace directories may survive under the system temp dir (`claude-eval-*`); otherwise the first item needs a treatment-only sweep of this case (`--condition treatment`, about $2), which is not mergeable on its own but is enough to read the verdicts.

- [ ] read the three 0.75 runs: which grader fails, and is it the skill, the replay transcript, or a grader too strict about `not-a-doc-list`
- [ ] identify the grader the controls pass at 0.25 and decide whether it should be a with-only indicator
- [ ] if it is the skill, record it as a finding about step 3 and open a bean for the change

Read on 2026-09-03 with a treatment-only run of the case ($1.40). Full write-up:
docs/plans/primer-evals/step3-read-2026-09-03.md, raw verdicts beside it.

Result: both file graders passed 5 of 5; the lost quarter is the `not-a-doc-list` judge
every time. Two causes: (1) two runs hit the 14-turn cap mid-verification and the judge
saw a fragment; (2) two runs reported the placed markers as a per-file list and the judge
read a list as the failure mode. The controls' 0.25 is `skill-fired` (the seed turn names
the skill, so it fires under every condition). Not a defect in step 3 of the skill.

Fixes are instrument changes (judge criteria, max_turns 20, skill-fired weight) and are
tracked in a new bean, to be bundled with the next amendment.

- [x] read the three 0.75 runs: which grader fails, and is it the skill, the replay transcript, or a grader too strict about not-a-doc-list — the judge grader, two causes, neither is the skill
- [x] identify the grader the controls pass at 0.25 — skill-fired; with-only is a no-op under ablation none, so weight 0 or removal
- [x] if it is the skill, record it as a finding about step 3 and open a bean for the change — it is not the skill; instrument bean opened instead
