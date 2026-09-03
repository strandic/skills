---
# skills-fqdf
title: 'Section ablation: which parts of SKILL.md move a Tier 1 score'
status: todo
type: task
priority: high
created_at: 2026-09-03T09:32:25Z
updated_at: 2026-09-03T09:32:25Z
parent: skills-c25p
blocked_by:
    - skills-ccsx
---

Tier 2's first experiment (`docs/plans/primer-evals/tier-2-backlog.md`, experiment 1). The 2026-09-03 sweep found a same-shape placebo ties the primer on every delta case and beats it on one, so Tier 1 cannot yet attribute any behaviour to the primer's content. This experiment removes one section at a time and re-runs the existing suite to see which sections, if any, move a Tier 1 score outside the noise floor (0.12). The placebo result says to bet on "none".

Conditions, each the treatment with one section deleted:

- triage section (skip / decompose / run it)
- failure-modes list
- setup section (artifact home, worktree, checkpoints)

Each is one sweep of that condition alone, about $9 and 45 minutes from a terminal, once skills-ccsx lands. Register each condition and its expected directions in an amendment before sweeping. Read the result per case against the current treatment column in `docs/plans/primer-evals/RESULTS-2026-09-03.md`.

- [ ] generate the three ablated conditions from SKILL.md (a script, so they track the source like the treatment mirror does)
- [ ] register them, with directions, in an amendment
- [ ] sweep each, merge, write up
