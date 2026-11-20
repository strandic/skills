---
# skills-79iv
title: 'shawarma-companion: a late store write can leave stored claims short (old id after /clear, or after the last refresh)'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-20T15:08:57Z
---

The Q7 read-back guards only the current id: a write given up on under id1 that lands after /clear leaves id1 short for good, so a --resume of the pre-/clear conversation folds a run (B2, F2). A late write after the last refresh stays short if the session ends or nothing is drawn (B4a, F3; the 15 s check repairs it while a row is drawn, B4b). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.
