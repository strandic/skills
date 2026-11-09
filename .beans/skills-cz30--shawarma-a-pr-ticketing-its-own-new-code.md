---
# skills-cz30
title: 'shawarma: a PR ticketing its own new code'
status: completed
type: task
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-09T16:18:17Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private).

Several runs filed follow-up tickets against code the same PR added (hardening of its own new gate, trigger kinds its own new script misses). The method counts TICKET rows but never limits or rules on ones aimed at the PR's own lines. Decide: such a row is a RULING, or a finding to fix before the gate.

## Summary of Changes

A ticket on the PR's own new lines is a DEFAULT at the gate; check_pr P10 fails a known limit with no ticket (round 10 D10). Shipped in v0.10.0.
