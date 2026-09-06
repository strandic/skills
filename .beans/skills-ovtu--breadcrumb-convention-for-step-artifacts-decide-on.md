---
# skills-ovtu
title: 'Breadcrumb convention for step artifacts: decide on merit'
status: completed
type: task
priority: low
created_at: 2026-09-03T09:11:06Z
updated_at: 2026-09-06T06:42:12Z
---

Proposed: each step may carry a short companion file in the artifact home holding intent and diagrams, never substituting for the code artifact.

Not measurable by any agent eval. The effect is on human reviewers, and whether a reviewer read the artifact is exactly what no eval can observe (the first-listed failure mode in SKILL.md). So this ships on judgement or not at all, and is labelled a preference, not a finding.

Split out of skills-uxfe, which held it behind a measurement gate that will never open.

- [ ] decide on merit
- [ ] if shipped, say in SKILL.md that it is a convention for human readers, with no measured effect



Decided 2026-09-06: dropped. Unmeasurable by design, and the ablations showed every extra instruction in SKILL.md carries a cost the stop rule has to outweigh (results sections for ablations 1–4). Not shipped.
