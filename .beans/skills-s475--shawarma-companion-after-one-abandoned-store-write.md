---
# skills-s475
title: 'shawarma-companion: after one abandoned store write, every claim reads the store back for the rest of the process'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T15:08:57Z
updated_at: 2026-11-20T15:08:57Z
---

isStoreUncertain is never cleared. Each claim (every tool call, turn end and 15 s check) then costs one more store.get; with slow reads, each refresh waits 2 s. Clear it once a read-back finds the entry complete. Test B3 (F4). Found by the skills-s6qg run review, final lane (docs/plans/2026-11-20-skills-s6qg-session-scoped-rows/reports/run/lane-3a-final/report.md); reproduction in final.test.tsx there.
