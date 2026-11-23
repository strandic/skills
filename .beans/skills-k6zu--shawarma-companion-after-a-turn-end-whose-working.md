---
# skills-k6zu
title: 'shawarma-companion: after a turn end whose working-directory read fails, a worktree another session wrote during an old call span can be claimed as the session''s own'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-23T06:49:57Z
updated_at: 2026-11-23T06:49:57Z
---

Found by the skills-oz54 round-4 fix review (docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview4/report.md, F2, probe a4.tail.tsx A4). During this session's Bash call 1 another session writes /repo/.worktrees/y/.shawarma/active-y; 70 Bash calls follow, then a main turn end whose session.cwd read rejects or never answers, then git lists y. With skills-oz54 (W3-R4/W3-R5) the turn end keeps its call spans, so y is claimed: the band reads `other tree: y` where the all-instant run reads `1 run in another worktree` after the turn end. Inside one turn the mod already claims such a marker (README: 'A marker another session writes at that same moment is claimed too'); the lost turn end stretches that window across turns. Low: options are a README note, or capping kept spans by age.
