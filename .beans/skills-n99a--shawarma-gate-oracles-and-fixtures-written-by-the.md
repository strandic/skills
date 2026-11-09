---
# skills-n99a
title: 'shawarma: gate oracles and fixtures written by the same agent as the code'
status: completed
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-09T16:18:17Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private). (R16: P16 dropped, class ticketed for round 10.)

The same-author problem showed up through gate oracles (a leak check sharing the code's normalisation) and test fixtures (fakes carrying a field the live reply omits), not through §4 expected values. Most briefs ship orchestrator-written tests and sketch patches.

## Summary of Changes

The attack lane flags a test's expected value not independent of the sketch (round 10 D9). Shipped in v0.10.0.
