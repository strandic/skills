---
# skills-5w5c
title: 'shawarma-companion: a long call''s span can be dropped before a check lists its marker, hiding the session''s own run'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-20T15:08:57Z
---

A background subagent's long call writes its marker partway through, while the main session ends a turn (clears turnWindows) and makes 64 writing calls (evicts the span from windows). If the 15 s check lists the marker in that time, it enters lastSeen unclaimed; re-remembering the span at the call's end (Q7 N1) is too late. The own run reads '1 run in another worktree' for the session. Same on d5ce6ef. Possible fix: keep open spans in a list nothing evicts until the call closes them. Test B1 (F1). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.
