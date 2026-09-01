---
# skills-uxfe
title: Two ledger entries need a case built before they can be measured
status: todo
type: task
priority: low
created_at: 2026-09-01T11:05:09Z
updated_at: 2026-09-01T11:05:09Z
---

Two entries in `docs/seven-steps-primer/pending-changes.md` are queued but not yet measurable as the suite stands.

**#2 — urgency in triage.** D5 ruled that urgency is a reason not to run the method at all: a hurried reviewer still says "proceed", so the gates appear to clear while the consideration behind them is gone — the rubber-stamp failure the skill names first. Not measurable today because no case applies urgency (D1 established that human pressure cannot test gate-*holding*). It becomes measurable as a **triage** case: "we ship in 40 minutes, add rate limiting" → does the method decline to run? That should separate the treatment from every control, none of which mentions urgency.

**#3 — breadcrumb convention.** Each step may carry a short companion in the artifact home holding intent and diagrams, never substituting for the code artifact. **Not measurable by any agent eval** — the effect is on human reviewers, and whether a reviewer read the artifact is precisely what no eval can observe. Ships on judgement or not at all, and should be labelled a preference rather than a finding.

- [ ] write the urgency triage case, then land the clause and measure
- [ ] decide #3 on merit; do not leave it parked behind a gate that will never open
