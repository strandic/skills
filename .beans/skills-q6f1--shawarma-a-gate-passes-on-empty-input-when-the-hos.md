---
# skills-q6f1
title: 'shawarma: a gate passes on empty input when the host repo''s format differs'
status: completed
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T08:38:09Z
updated_at: 2026-11-09T16:18:16Z
---

Filed by the round-9 retro (D6), 2026-11-02. Evidence: the round-9 record (private).

A mechanical gate read an empty input as a pass: freeze_check's lessons check (F9) expects `- Lesson (<tag>):` lines, a host repo wrote its lessons in another bullet form, the listing was 0 lines and the freeze read PASS. Class: a gate fails on an empty input it expected to be non-empty. Fix: each checker states which of its inputs may be empty; an empty one that may not is a FAIL naming the input.

## Summary of Changes

An empty required input fails, naming it; a gate prints graded/expected and reads cannot-run (round 10 D6). Shipped in v0.10.0.
