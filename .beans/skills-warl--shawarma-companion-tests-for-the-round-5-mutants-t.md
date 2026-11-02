---
# skills-warl
title: 'shawarma-companion: tests for the round-5 mutants that read outside the tree (Q2, Q13) and change text (Q9, Q14)'
status: todo
type: bug
priority: normal
tags:
    - shawarma
created_at: 2026-11-02T22:27:18Z
updated_at: 2026-11-02T22:27:18Z
---

From the skills-v2tm run, review round 5 (lane-r5 report M2, M3; mutants in the lane's scratch mutants.py). Q2 (drop the kept real path only when the folder is not found, not when unreadable) and Q13 (a kept late record counts as inside) pass the 207-test suite and read outside on the real engine. Q9 (pane writes a late record for any non-ok stat) and Q14 (also for an ok stat) change visible text; Q6, Q7 are conservative. Add a test that kills each.
