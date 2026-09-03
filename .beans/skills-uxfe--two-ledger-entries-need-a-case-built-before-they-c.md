---
# skills-uxfe
title: Build an urgency triage case, then measure the urgency clause
status: todo
type: task
priority: low
created_at: 2026-09-01T11:05:09Z
updated_at: 2026-09-03T09:32:25Z
blocked_by:
    - skills-fqdf
---

Queued change to the triage section: urgency is a reason not to run the method at all (decision D5 in `docs/plans/primer-evals/0-plan.md`). A hurried reviewer still says "proceed", so the gates appear to clear while the consideration behind them is gone; that is the rubber-stamp failure SKILL.md names first.

Not measurable today: no case applies urgency, and D1 established that human pressure cannot test gate-holding. It becomes measurable as a triage case: "we ship in 40 minutes, add rate limiting". Does the method decline to run? That should separate the treatment from every control, since none of them mentions urgency.

Adding a case changes the instrument (I2b), so this is a pre-registration amendment and a full three-condition sweep, not a treatment-only run. Register the case, its graders and the expected direction before sweeping.

The breadcrumb-convention item that used to share this bean is now skills-ovtu.

- [ ] write the urgency triage case and its graders, with probes
- [ ] register it in an amendment, land the clause in SKILL.md
- [ ] sweep all three conditions, merge, record the outcome here
