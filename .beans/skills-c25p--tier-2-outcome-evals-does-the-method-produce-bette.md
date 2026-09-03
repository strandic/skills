---
# skills-c25p
title: Tier 2 — outcome evals (does the method produce better software?)
status: todo
type: epic
priority: normal
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-01T11:01:44Z
---

Tier 1 measures what the agent does. Tier 2 measures whether the software comes out better, and is the only thing that can support that claim. Designed and costed in `docs/plans/primer-evals/tier-2-backlog.md`; that document is the source for the designs and prices, this bean only orders them.

Three experiments, in the backlog's order:

1. Section ablation on the existing Tier 1 suite: remove one section of SKILL.md at a time, re-sweep, see what moves.
2. Defect injection: does step 4 as a run find defects a read cannot.
3. Plan handoff: build from each condition's artifacts with a fresh implementer, test against a hidden suite.

Why ablation is first: the 2026-09-03 sweep (`docs/plans/primer-evals/RESULTS-2026-09-03.md`) found that a placebo with the primer's structure and none of its content ties the primer on every delta case and beats it on one. So Tier 1 cannot yet attribute any behaviour to the primer's content. Ablation asks which sections, if any, do something Tier 1 can see; the placebo result says to bet on "none of them".

Two blockers first, tracked as skills-zk77 (sweep runtime) and skills-5jso (CLI pin).
