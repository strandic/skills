---
# skills-c25p
title: Tier 2 — outcome evals (does the method produce better software?)
status: todo
type: epic
priority: normal
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-08T12:08:06Z
---

Tier 1 measures what the agent does. Tier 2 measures whether the software comes out better, and is the only thing that can support that claim. Designed and costed in `docs/plans/primer-evals/tier-2-backlog.md`; that document is the source for the designs and prices, this bean only orders them.

Three experiments, in the backlog's order:

1. Section ablation on the existing Tier 1 suite: remove one section of SKILL.md at a time, re-sweep, see what moves.
2. Defect injection: does step 4 as a run find defects a read cannot.
3. Plan handoff: build from each condition's artifacts with a fresh implementer, test against a hidden suite.

Why ablation is first: the 2026-09-03 sweep (`docs/plans/primer-evals/RESULTS-2026-09-03.md`) found that a placebo with the primer's structure and none of its content ties the primer on every delta case and beats it on one. So Tier 1 cannot yet attribute any behaviour to the primer's content. Ablation asks which sections, if any, do something Tier 1 can see; the placebo result says to bet on "none of them".

Two blockers first, tracked as skills-zk77 (sweep runtime) and skills-5jso (CLI pin).



Children and order: skills-fqdf (section ablation) first, blocked by skills-ccsx (per-condition digest). Defect injection and plan handoff get beans when ablation has reported.



2026-09-06: experiment 1 (section ablation, skills-fqdf plus the recon cut skills-btt2) is complete and closed; Tier 1 is exhausted on this fixture. Experiment 2 is skills-g1qk, the next thing to spend on. Experiment 3 waits on it.

2026-09-08: experiment 2 (skills-g1qk) is complete and closed: on the seeded fixture the primer's step 4 names fewer planted defects than the placebo's read-through (registered −1, held), as many as a one-line "run it" (registered 0, held), and no more than no instruction (registered +1, not held). RESULTS-2026-09-07-defects.md. Next: the "Later: ablate recon" re-run of the defects suite, then experiment 3.

2026-09-08: the "Later: ablate recon" re-run is done (RESULTS-2026-09-08-defects-no-recon.md). Registered −1, not held: cutting the recon text changes nothing the reported score sees; the cut agent runs the feature and names nothing, like the treatment. Two amendments on the defects registration (the condition; safeguard-refused judge calls unscored). Next: experiment 3, skills-hvqb.
