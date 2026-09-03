---
# skills-mtgs
title: Measure the Concise restyle of SKILL.md
status: todo
type: task
priority: normal
created_at: 2026-09-01T11:04:48Z
updated_at: 2026-09-01T11:04:48Z
---

SKILL.md was written under Claude Code's default output style; the repo has since moved to Concise. A restyle changes the text while keeping the structure.

What the 2026-09-03 sweep says about the stake: a placebo with the primer's structure and none of its content ties the primer on every delta case and beats it on one (`docs/plans/primer-evals/RESULTS-2026-09-03.md`). So Tier 1 has not yet found a behaviour that depends on the prose. A restyle that keeps the structure is likely invisible to Tier 1, in either direction. That lowers the priority of measuring it and raises the priority of skills-c25p's section ablation, which asks the sharper question.

How to measure it if it is done. The treatment condition is generated from SKILL.md, so a restyle changes the instrument and the merger refuses to mix it with the current records (I2b). The comparison is therefore between two full reports: restyle, regenerate, sweep all three conditions (about $27, three windows), merge, then compare the restyled treatment's per-case means to the current report's, judged against the noise floor. The merger does not compute treatment-vs-treatment; do that comparison by hand and say so.

Sequence with skills-qaaa, which also edits SKILL.md: one change per sweep, or the two cannot be told apart.

- [ ] decide whether this is worth a sweep after the section ablation, given the placebo result
- [ ] if yes: restyle, regenerate, register an amendment, sweep all three, merge
- [ ] record the per-case comparison here, including a regression
