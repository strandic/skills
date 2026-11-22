---
# skills-9u5j
title: 'shawarma-companion: while a Bash call waits on a slow working-directory read after a move, reads of the band show the labels from before the move'
status: todo
type: bug
tags:
    - shawarma
created_at: 2026-11-22T14:14:07Z
updated_at: 2026-11-22T14:14:07Z
---

Found by the skills-oz54 fix review (reports/fixreview/report.md and report-c.md, the 3 500-run sweep): 196 band reads, taken while a Bash call whose session.cwd answers late or never is still waiting on its give-ups (up to 6 s), show the rows drawn before a move to another worktree, labelled by the old folder; the all-instant run already shows the new labels. Pre-existing: the code before skills-oz54 reads the same 196. Lag, not a lasting label: the rows are redrawn when the call ends.
