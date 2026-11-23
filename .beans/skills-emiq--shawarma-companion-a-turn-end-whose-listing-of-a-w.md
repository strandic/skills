---
# skills-emiq
title: 'shawarma-companion: a turn end whose listing of a worktree''s .shawarma folder fails still counts as placed, so the session''s own marker there is lost after 64 calls'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-23T07:37:20Z
updated_at: 2026-11-23T07:37:20Z
---

Found by the skills-oz54 round-6 fix review (docs/plans/2026-11-22-skills-oz54-session-calls-bound/reports/fixreview6/report.md, F1, probe a6.tail.tsx P1). The session's Bash call 1 writes marker k into X (not listed yet), 70 Writes follow, git lists X, and the main turn end's fs.list X/.shawarma rejects. markersOf turns the failure into no markers, so claim never sees k, yet the turn end counts as placed and empties turnFolders/turnWindows. After that k reads `1 run in another worktree` (truth: `other tree: k`). Pre-existing: the code before skills-oz54's W3-R6 reads the same whenever session.usage answers. Candidate fix (unexecuted): count the turn end as placed only if every scanned root's .shawarma listed or is missing (ENOENT); that needs lister to tell missing from failed. Close to skills-3hy6 (a failed .shawarma listing empties the band), but the effect here is a lost claim.
