---
# skills-2fzi
title: 'shawarma-companion: a plan folder swapped for a link out between two updates is read through the kept real path'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T22:27:18Z
updated_at: 2026-11-02T22:27:18Z
---

From the skills-v2tm run, review round 5 (lane report docs/plans/2026-11-02-skills-v2tm-per-ticket-markers/reports/lane-r5/report.md, M1, A1). An inside plan folder is replaced by a symlink to a folder outside the tree, with the marker unchanged and no update seeing it missing in between. The 15 s check lists through the link, sees new times and refreshes; the refresh trusts the real path kept for that marker and reads the outside plan.md and decisions.md (band OUTSIDE TITLE, pane OUTSIDE SECRET). The README states it as a limit. Options: re-check the kept real path when the folder's listing changes, or keep real paths for one turn only.
