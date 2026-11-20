---
# skills-6loo
title: 'shawarma-companion: a not-readable plan dir row shows 0 decisions'
status: todo
type: bug
priority: low
tags:
    - shawarma
created_at: 2026-11-20T16:56:42Z
updated_at: 2026-11-20T16:56:42Z
---

From the skills-cm2l plan (Q5, 2026-11-20; attack lane finding A1+). When the plan dir does not list, `rowOf` returns the row with `decisions: 0`, so the band reads `… · 0 decisions · plan dir not readable: <dir>` while decisions.md may hold rulings. The count is unknown, not 0: wrong output. With skills-cm2l (Q4) the row is refreshed each 15 s pass, so after a one-off error it lasts one pass; a lasting error keeps it. Fix: show no count (or a marker for unknown) on a not-readable row; the tests pinning that row (N11 and others with `0 decisions · plan dir not readable`) change.
