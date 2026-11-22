---
# skills-5w5c
title: 'shawarma-companion: a long call''s span can be dropped before a check lists its marker, hiding the session''s own run'
status: in-progress
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-22T14:30:00Z
---

A background subagent's long call writes its marker partway through, while the main session ends a turn (clears turnWindows) and makes 64 writing calls (evicts the span from windows). If the 15 s check lists the marker in that time, it enters lastSeen unclaimed; re-remembering the span at the call's end (Q7 N1) is too late. The own run reads '1 run in another worktree' for the session. Same on d5ce6ef. Possible fix: keep open spans in a list nothing evicts until the call closes them. Test B1 (F1). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.

## Plan paused: 1 question (2026-11-22)

Plan dir: docs/plans/2026-11-22-skills-5w5c-open-span-eviction/. Triage: not trivial, not settled (the ticket's fix is a possibility, unruled) → design interview. Research: reports/research/report.md (engine 2.1.330: interrupt, deny and tool error all settle `next(e)`; nothing documents a call left pending forever, nor rules it out; the mod's `.finally` awaits `$.clock.now()` before closing the span).

Readings, `claude plugin test` on a scratch copy of the mod at 00cb95a with the s6qg final lane's tests plus O1, O2:
- B1 (the bug): base fails, `during`/`after` = `["main-1 · trivial", "1 run in another worktree"]`; option A (open spans in a set nothing evicts, released first in the call's clean-up) passes.
- O1 (a call that never ends, then a turn end and 64 writes, then another session's marker): base `1 run in another worktree`; A `other tree: other-1 · trivial` (over-claim lasts the session).
- O2 (a call that rejects mid-way): passes on both.

Q1 RULING asked: A (reco) · B, A plus an age limit N · C, no change, a stated limit.
