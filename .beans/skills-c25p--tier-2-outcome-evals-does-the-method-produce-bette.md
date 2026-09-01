---
# skills-c25p
title: Tier 2 — outcome evals (does the method produce better software?)
status: todo
type: epic
priority: normal
created_at: 2026-09-01T11:01:44Z
updated_at: 2026-09-01T11:01:44Z
---

Tier 1 measures what the agent does. Tier 2 measures whether the software comes out better, and is the only thing that can support that claim. Fully designed and costed in `docs/plans/primer-evals/tier-2-backlog.md`.

Three designs, in order of evidence-per-dollar:

- **O2 — defect-injection recon yield** (~$80-200, 0.5-1 human-day). Isolates the method's most falsifiable claim, "recon is a run, not a read", with zero compliance rubric. Fixture seeded with defects by a method-blind author, split readable vs run-only; DV is recall of the run-only ones. Cheapest real outcome measure.
- **O1 — artifact sufficiency transfer** (~$250-650, ~3 human-days for 2 features). The method's own stated test: hand each condition's plan bundle to a fresh, method-blind implementer and grade against a held-out acceptance suite written before the eval. Compliance drops out entirely.
- **O3 — component ablation** (near-free once O1 or O2 exists). Strip only recon, only triage, only the failure modes. Tells you which parts to keep — the practically useful result Tier 1 structurally cannot produce.

The first sweep sharpens the case for O3: the primer ties a thirteen-word one-liner on both structural-triage cases, so the decomposition and triage sections may not be earning their length.
