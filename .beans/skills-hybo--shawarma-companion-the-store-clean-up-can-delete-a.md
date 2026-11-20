---
# skills-hybo
title: 'shawarma-companion: the store clean-up can delete an entry its owner rewrote between the read and the delete'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T17:19:15Z
updated_at: 2026-11-20T17:19:15Z
---

The prune reads another session's entry, judges it expired, then deletes it. If the owner rewrites it in between, the delete removes a live entry, and a later --resume loses its claims. A delete given up on at the 2 s deadline can still land. The store has no compare-and-set. Pre-existing; skills-bnbu narrows it (probe: 2 such entries deleted on the base, 1 on the sketch). Found by the skills-bnbu plan attack lane, line A4 (docs/plans/2026-11-20-skills-bnbu-store-cleanup-bound/reports/attack/report.md). Accepted as a residual by skills-bnbu Q3.
