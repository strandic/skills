---
# skills-4yek
title: 'shawarma-companion: one unnamed test failure in 22 suite runs at skills-cm2l head'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-22T07:51:13Z
updated_at: 2026-11-22T07:51:13Z
---

Seen in the skills-cm2l run (2026-11-22). A fix-review lane ran `claude-personal plugin test` on a copy of the mod at a651a69 ten times: run 1 read 291 pass / 1 fail, the test not captured; runs 2–10 read 292 / 0. The orchestrator then ran it 12 times in the worktree at fd422fe: 292 pass / 0 fail each. Possibly the timing-dependent teardown rejection lane 3b saw on the base (`a rejection nothing handled: … $.state.get refused: no hooks module of that name is loaded`), or a clock-sensitive test. To do: loop the suite until a failure is captured, name the test.
