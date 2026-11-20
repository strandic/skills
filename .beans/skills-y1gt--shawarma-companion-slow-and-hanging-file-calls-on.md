---
# skills-y1gt
title: 'shawarma-companion: slow and hanging file calls on plan folders cost each update'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-02T22:27:19Z
updated_at: 2026-11-02T22:27:19Z
---

From the skills-v2tm run, review round 5 (lane-r5 report L3, L4). R5 (a) drops the kept real path of an unreadable folder, so a slow real-path stat (1.5 s) is paid on every refresh (~1510 ms per tool call vs ~4 ms before). $.fs.exists in the 15 s check, the refresh and the pane has no 2 s limit: a hanging exists left the check unanswered past 5 s (engine skipped the hook at 10 s). The README does not state either cost.

## Note from skills-cm2l (2026-11-20, lane finding A8)

A decisions.md read that never answers, over 120 s with 1 or 20 rows: 8 check passes, 8 hung reads (one more each 15 s, no limit), and the band keeps the old `1 decision` while the read is pending. The same on the base and on the skills-cm2l sketch: that change adds no hung call.
