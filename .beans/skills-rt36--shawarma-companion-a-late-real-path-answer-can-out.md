---
# skills-rt36
title: 'shawarma-companion: a late real-path answer can outlive its turn, and labels a not-found row outside'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-02T22:27:18Z
updated_at: 2026-11-02T22:27:18Z
---

From the skills-v2tm run, review round 5 (lane-r5 report L1, L2, L5). A pane real-path stat still waiting at turn end writes its late record after the turn-end clear, so it lasts one more turn (the refresh's late write can race the same way). A pane-only late answer also turns a not-found row into 'plan dir outside its tree', which claims more than the mod knows. The comments and README say 'until the turn ends' and '2 seconds once per turn'.
